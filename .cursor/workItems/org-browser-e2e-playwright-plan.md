### Goal

Add a parallel, headless-capable Playwright e2e suite for the `salesforcedx-vscode-org-browser` extension that runs locally and in CI, without modifying or removing existing CDP/headed tests.

### Constraints

- Do not change existing tests or their configs; new tests live alongside them.
- Must run headless by default and be CI-friendly.
- Keep extension bundling and dependencies intact; reuse current build steps.
- Follow repo rules: run from monorepo root, use `-w` workspace flags; avoid port 3000 conflicts (org-browser currently uses 3001).
- New tests do not perform build or bundle checks; bundling is handled by scripts/CI, not inside tests.

### Scope

- The headless Playwright tests will not validate build artifacts (no `dist` checks) and will not perform bundling.
- Scripts/CI may invoke existing `bundle:extension` prior to running tests; tests themselves will not assert build state.

### Reference Architecture (from apex-language-support)

- Central Playwright config with CI-tuned defaults and `webServer` integration to start VS Code Web server.
  - see `apex-language-support/e2e-tests/playwright.config.ts` lines 16–33, 64–73 for headless, retries, reporter, webServer, and baseURL choices.

```16:33:/Users/shane.mclaughlin/eng/forcedotcom/apex-language-support/e2e-tests/playwright.config.ts
export default defineConfig({
  testDir: './tests',
  fullyParallel: !process.env.DEBUG_MODE,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI || process.env.DEBUG_MODE ? 1 : undefined,
  reporter: process.env.CI
    ? [['html'], ['line'], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : 'html',
  use: { baseURL: 'http://localhost:3000', trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry', screenshot: process.env.CI ? 'on' : 'only-on-failure', video: process.env.CI ? 'on' : 'retain-on-failure', actionTimeout: 15000 },
```

```64:73:/Users/shane.mclaughlin/eng/forcedotcom/apex-language-support/e2e-tests/playwright.config.ts
  webServer: {
    command: 'npm run test:e2e:server',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: process.cwd().endsWith('e2e-tests') ? '..' : '.',
  },
  timeout: process.env.CI ? 120_000 : 60_000,
});
```

- VS Code Web server launched via `@vscode/test-web` with headless browser and fixed port, verifying extension dist artifacts exist before serving.
  - see `apex-language-support/e2e-tests/test-server.js` lines 33–61 (dist checks) and 113–143 (runTests config).

```33:61:/Users/shane.mclaughlin/eng/forcedotcom/apex-language-support/e2e-tests/test-server.js
    const distPath = path.join(extensionDevelopmentPath, 'dist');
    const packageJsonPath = path.join(distPath, 'package.json');
    const extensionJsPath = path.join(distPath, 'extension.js');
    const extensionWebJsPath = path.join(distPath, 'extension.web.js');
    if (!fs.existsSync(distPath)) { throw new Error('Extension dist directory not found: ' + distPath); }
    if (!fs.existsSync(packageJsonPath)) { throw new Error('Extension package.json not found in dist: ' + packageJsonPath); }
    if (!fs.existsSync(extensionJsPath)) { throw new Error('Extension main file not found: ' + extensionJsPath); }
    if (!fs.existsSync(extensionWebJsPath)) { console.warn('⚠️ Extension web file not found: ' + extensionWebJsPath); }
```

```113:143:/Users/shane.mclaughlin/eng/forcedotcom/apex-language-support/e2e-tests/test-server.js
    await runTests({
      extensionDevelopmentPath,
      folderPath: workspacePath,
      headless: true,
      browserType: 'chromium',
      version: 'stable',
      printServerLog: true,
      verbose: true,
      extensionTestsPath: undefined,
      port: 3000,
      launchOptions: { args: ['--disable-web-security', '--disable-features=VizDisplayCompositor', '--enable-logging=stderr', '--log-level=0', '--v=1', ...(process.env.CI ? ['--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding'] : [])] }
    });
```

- Reusable helpers to: start VS Code web, monitor console/network errors with allow-lists, verify workbench/outline presence, and open files to activate the extension.
  - see `apex-language-support/e2e-tests/utils/test-helpers.ts` lines 130–186 (start VS Code), 194–208 (verify explorer files), 215–259 (activate), 266–294 (wait for LSP), 301–307 (stability), 317–364 (verify editor content), and error filters in `utils/constants.ts` lines 39–67.

### Current org-browser web tests (baseline)

- Playwright config uses `vscode-test-web` on port 3001 with CDP-enabled, headed browser.
  - see `packages/salesforcedx-vscode-org-browser/playwright.web.config.ts` lines 26–43 and 53–58.

```26:43:/Users/shane.mclaughlin/eng/forcedotcom/salesforcedx-vscode/packages/salesforcedx-vscode-org-browser/playwright.web.config.ts
use: {
  baseURL: 'http://localhost:3001',
  trace: 'on-first-retry',
  screenshot: 'on',
  video: 'on',
  actionTimeout: 10000,
  navigationTimeout: 30000,
  launchOptions: { args: ['--disable-web-security','--disable-features=VizDisplayCompositor','--allow-running-insecure-content','--disable-site-isolation-trials','--remote-debugging-port=9222','--no-first-run','--no-default-browser-check'], devtools: true }
}
```

```53:58:/Users/shane.mclaughlin/eng/forcedotcom/salesforcedx-vscode/packages/salesforcedx-vscode-org-browser/playwright.web.config.ts
webServer: {
  command: 'npm run start:web:test',
  url: 'http://localhost:3001',
  timeout: 120 * 1000,
  reuseExistingServer: !process.env.CI
}
```

- Tests and fixtures lean on CDP connection to a real Chrome instance, then fall back to isolated Playwright.
  - see `test/web/fixtures/cdpFixture.ts` lines 41–58 (CDP first) and 58–106 (fallback capture).

### Plan: Add headless Playwright e2e path (no changes to existing tests)

1. New server script (web, headless):

- Create `test/web/headless-server.js` that mirrors apex-language-support’s `test-server.js`, but targets the org-browser extension and port 3001 (to match existing baseURL). Do not perform `dist` validation; assume bundling occurs via scripts/CI. Launch with `headless: true` and CI flags.

2. New Playwright config for headless CI:

- Add `playwright.config.ts` alongside `playwright.config.ts` with:
  - `use.launchOptions.headless = true`, remove `devtools`/CDP flags.
  - `workers: process.env.CI ? 1 : undefined`, `retries: process.env.CI ? 2 : 0`.
  - `reporter`: include `junit` in CI.
  - `webServer.command: node test/web/headless-server.js` and `url: http://localhost:3001`.

3. Test utilities (minimal, reuse existing page object):

- Introduce `test/web/utils/headless-helpers.ts` with equivalents to:
  - start VS Code web and wait for `.monaco-workbench` (analogous to `startVSCodeWeb`).
  - console/network error capture with allow-lists inspired by `apex-language-support/e2e-tests/utils/constants.ts` lines 39–67. Keep lists small and specific to org-browser (resource 404s, sourcemaps).
  - guard rails for stability checks (status bar/sidebar visible).
  - NOTE: follow repo Playwright rule to avoid `waitForTimeout`; wait on concrete selectors.

4. Add 1–2 smoke tests in a new `test/web/headless/` folder:

- `orgBrowser.load.smoke.spec.ts`: open VS Code web, switch to Org Browser activity, assert key selectors are visible, verify no disallowed console/network errors.
  - Prefer using existing `OrgBrowserPage` page object for navigation (open activity, ensure types loaded) to keep parity with current CDP tests.
- `orgBrowser.retrieve.ui.smoke.spec.ts`: open Org Browser tree, assert retrieve button presence and progress notification lifecycle (without requiring real auth). Use existing `OrgBrowserPage` methods where possible for consistency.

5. Scripts and workspace wiring:

- In `packages/salesforcedx-vscode-org-browser/package.json`, add scripts:
  - `test:web:headless`: `npm run bundle:extension && playwright test --config=playwright.config.ts`.
  - `test:web:headless:ci`: same with `CI=1` and persistent artifacts.
- At repo root, mirror apex-language-support pattern if needed: `npm run test -w salesforcedx-vscode-org-browser -- test:web:headless`.

6. CI integration:

- Add CI job to run `npm run compile && npm run test:web:headless -w salesforcedx-vscode-org-browser` on linux with Chromium deps. Store HTML + JUnit reports and screenshots/videos on failure.

7. Documentation:

- Update `packages/salesforcedx-vscode-org-browser/README.md` testing section with a new “Headless e2e (CI)” subsection describing commands and expectations. Clarify CDP tests remain and are unchanged.

### Acceptance Criteria

- `npm run test:web:headless -w salesforcedx-vscode-org-browser` runs locally headless and passes smoke tests.
- Same command passes in CI with retries=2, workers=1, and produces JUnit + HTML reports.
- Existing CDP tests (`test:web`) remain functional and unchanged.
  - When DEBUG_MODE is set: disable Playwright timeouts, force single worker, open Chromium DevTools.

### Guiding Principle

- When in doubt on design or implementation details for the headless e2e path, refer directly to `apex-language-support`’s Playwright e2e code and mirror the working patterns (config shape, webServer usage, helpers, selectors, CI options) rather than inventing new ones.

### Risk & Mitigations

- If extension is not built, the server will fail to load; CI/scripts must run bundling before tests. Tests will not check builds.
- Flakiness: use selector-based waits and allow-list filtering; enable retries in CI like apex-language-support.
- Port conflicts: reuse `3001` to match existing config; CI step ensures port is free.

### Citations (code)

- apex-language-support Playwright config and webServer:
  - `e2e-tests/playwright.config.ts` lines 16–33, 64–73.
- apex-language-support VS Code Web headless server:
  - `e2e-tests/test-server.js` lines 33–61, 113–143.
- apex-language-support helpers (startup, activation, stability, error filters):
  - `e2e-tests/utils/test-helpers.ts` lines 130–186, 194–208, 215–259, 266–294, 301–307, 317–364; `utils/constants.ts` lines 39–67.
- org-browser current Playwright web config (CDP, headed):
  - `packages/salesforcedx-vscode-org-browser/playwright.web.config.ts` lines 26–43, 53–58.
- org-browser CDP-first fixtures:
  - `test/web/fixtures/cdpFixture.ts` lines 41–106.
