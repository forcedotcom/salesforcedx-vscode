---
name: Migrate SOQL E2E Playwright
overview: Migrate the SOQL E2E test from vscode-extension-tester (in `salesforcedx-vscode-automation-tests`) to the Playwright framework (in `salesforcedx-vscode-soql`), following the established patterns used by other packages like `salesforcedx-vscode-metadata`.
todos:
  - id: add-deps-scripts
    content: Add @salesforce/playwright-vscode-ext devDependency and wireit test:web/test:desktop scripts to salesforcedx-vscode-soql/package.json
    status: completed
  - id: create-configs
    content: Create playwright.config.web.ts and playwright.config.desktop.ts using createWebConfig/createDesktopConfig
    status: completed
  - id: create-fixtures
    content: Create test/playwright/fixtures/index.ts and desktopFixtures.ts with web/desktop switching
    status: completed
  - id: create-headless-server
    content: Create test/playwright/web/headlessServer.ts with createHeadlessServer for SOQL + core extensions
    status: completed
  - id: write-spec
    content: Write test/playwright/specs/soqlBuilder.headless.spec.ts migrating the 3 active tests as test.step blocks
    status: completed
  - id: update-workflow
    content: Rewrite .github/workflows/soqlE2E.yml to use Playwright pattern (try-run, parallel, retry, artifacts)
    status: completed
  - id: remove-old-test
    content: Delete packages/salesforcedx-vscode-automation-tests/test/specs/soql.e2e.ts
    status: completed
  - id: verify-compile
    content: Run npm run compile, lint, vscode:bundle for salesforcedx-vscode-soql
    status: completed
  - id: verify-test-web
    content: Run npm run test:web -w salesforcedx-vscode-soql -- --retries 0 locally
    status: completed
  - id: verify-test-desktop
    content: Run npm run test:desktop -w salesforcedx-vscode-soql -- --retries 0 locally
    status: completed
  - id: verify-knip-dupes
    content: Run npx knip and npm run check:dupes to check for dead code and duplicates
    status: completed
isProject: false
---

# Migrate SOQL E2E Test to Playwright

## Context

The current SOQL E2E test lives in `[packages/salesforcedx-vscode-automation-tests/test/specs/soql.e2e.ts](packages/salesforcedx-vscode-automation-tests/test/specs/soql.e2e.ts)` and uses the legacy `vscode-extension-tester` (Selenium/ChromeDriver) framework via `@salesforce/salesforcedx-vscode-test-tools`. The workflow at `[.github/workflows/soqlE2E.yml](.github/workflows/soqlE2E.yml)` calls the shared `runE2ETest.yml` reusable workflow for this older framework.

The target is to rewrite it using Playwright via `@salesforce/playwright-vscode-ext`, following the same patterns as other migrated packages (e.g., `salesforcedx-vscode-metadata`).

**Key simplification:** The current test has `isOrgRequired: false` -- no scratch org is needed, which makes the workflow significantly simpler than packages like metadata or apex-testing.

## What the current test does (3 active tests)

1. **Create Query in SOQL Builder** -- runs `SFDX: Create Query in SOQL Builder` via command palette, verifies active tab is `untitled.soql`
2. **Toggle SOQL Builder/Text Editor (from builder)** -- clicks the "Switch Between SOQL Builder and Text Editor" editor action, verifies tab state
3. **Toggle SOQL Builder/Text Editor (from file)** -- reloads window, verifies the toggle button exists

There are also 3 `it.skip` tests that will be omitted from the migration.

## File structure to create

All new files go under `packages/salesforcedx-vscode-soql/`:

```
packages/salesforcedx-vscode-soql/
├── playwright.config.web.ts          (new)
├── playwright.config.desktop.ts      (new)
└── test/playwright/
    ├── fixtures/
    │   ├── index.ts                  (new)
    │   └── desktopFixtures.ts        (new)
    ├── specs/
    │   └── soqlBuilder.headless.spec.ts  (new)
    └── web/
        └── headlessServer.ts         (new)
```

## Step-by-step plan

### 1. Add Playwright dependency and scripts to SOQL package.json

In `[packages/salesforcedx-vscode-soql/package.json](packages/salesforcedx-vscode-soql/package.json)`:

- Add `@salesforce/playwright-vscode-ext` as a devDependency (use `"*"` like other packages)
- Add wireit scripts: `test:web`, `test:desktop`, `test:e2e`, plus convenience scripts `test:web:ui`, `test:web:debug`, `test:desktop:debug`
- `test:web` wireit config:
  - `command`: `playwright test --config=playwright.config.web.ts`
  - `dependencies`: `["vscode:bundle", "../salesforcedx-vscode-services:vscode:bundle", "../salesforcedx-vscode-services:spans:server", "../playwright-vscode-ext:compile"]`
  - `files`: `["playwright.config.web.ts", "test/playwright/**/*.ts", "package*.json"]`
- `test:desktop` wireit config:
  - `command`: `playwright test --config=playwright.config.desktop.ts`
  - `env`: `{ "VSCODE_DESKTOP": "1" }`
  - `dependencies`: `["vscode:bundle", "../salesforcedx-vscode-services:vscode:bundle", "../playwright-vscode-ext:compile"]`
  - `files`: `["playwright.config.desktop.ts", "test/playwright/**/*.ts", "package*.json"]`

### 2. Create Playwright config files

`**playwright.config.web.ts**` -- follows pattern from metadata:

```typescript
import { createWebConfig } from '@salesforce/playwright-vscode-ext';
export default createWebConfig();
```

`**playwright.config.desktop.ts**`:

```typescript
import { createDesktopConfig } from '@salesforce/playwright-vscode-ext';
export default createDesktopConfig();
```

### 3. Create fixtures

`**test/playwright/fixtures/index.ts**` -- switches between web and desktop test:

```typescript
import { test as webTest } from '@playwright/test';
import { desktopTest } from './desktopFixtures';

const isDesktop = process.env.VSCODE_DESKTOP === '1';

webTest.afterEach(async ({ page }, testInfo) => {
  if (process.env.DEBUG_MODE && testInfo.status !== 'passed') {
    console.log('\nDEBUG_MODE: Test failed - pausing.');
    await page.pause();
  }
});

export const test = isDesktop ? desktopTest : webTest;
```

`**test/playwright/fixtures/desktopFixtures.ts**` -- since SOQL depends on `salesforcedx-vscode-core`, we need core (and core depends on services, which is auto-added):

```typescript
import { createDesktopTest } from '@salesforce/playwright-vscode-ext';
export const desktopTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core']
});
```

### 4. Create headless server

`**test/playwright/web/headlessServer.ts**`:

```typescript
import { createHeadlessServer, setupSignalHandlers } from '@salesforce/playwright-vscode-ext';
if (require.main === module) {
  void createHeadlessServer({
    extensionName: 'SOQL',
    callerDirname: __dirname,
    additionalExtensionDirs: ['salesforcedx-vscode-core']
  });
  setupSignalHandlers();
}
```

Note: `salesforcedx-vscode-services` is always loaded automatically by `createHeadlessServer`.

### 5. Write the Playwright spec

`**test/playwright/specs/soqlBuilder.headless.spec.ts**` -- one test file with `test.step` for sequential steps:

Imports to use:

- `test` from `../fixtures`
- `expect` from `@playwright/test`
- `executeCommandWithCommandPalette`, `waitForVSCodeWorkbench`, `assertWelcomeTabExists`, `closeWelcomeTabs`, `ensureSecondarySideBarHidden`, `setupConsoleMonitoring`, `setupNetworkMonitoring`, `validateNoCriticalErrors`, `saveScreenshot` from `@salesforce/playwright-vscode-ext`
- `QUICK_INPUT_WIDGET`, `TAB` from `@salesforce/playwright-vscode-ext`
- `packageNls` from `../../../package.nls.json` (for command titles: `soql_builder_open_new` = "SFDX: Create Query in SOQL Builder", `soql_builder_toggle` = "Switch Between SOQL Builder and Text Editor")

Test structure:

```typescript
test('SOQL Builder: create query and toggle between builder and text editor', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup workbench', async () => {
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('create query in SOQL Builder', async () => {
    await executeCommandWithCommandPalette(page, packageNls.soql_builder_open_new);
    // Wait for untitled.soql tab to appear
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: 'untitled.soql' });
    await expect(soqlTab).toBeVisible({ timeout: 20_000 });
  });

  await test.step('toggle from SOQL Builder to Text Editor', async () => {
    const toggleButton = page.getByRole('button', { name: packageNls.soql_builder_toggle });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();
    // After toggling, a second untitled.soql tab opens (text editor view alongside builder)
    const soqlTabs = page.locator('[role="tab"]').filter({ hasText: 'untitled.soql' });
    await expect(soqlTabs).toHaveCount(2, { timeout: 10_000 });
  });

  await test.step('toggle from Text Editor back to SOQL Builder', async () => {
    // We are now in the text editor view; toggle should switch back to the builder
    const toggleButton = page.getByRole('button', { name: packageNls.soql_builder_toggle });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();
    // Verify the toggle navigated back (tab count may change or active editor switches)
    // The active tab should still be untitled.soql with the builder view
    const activeTab = page.locator('[role="tab"].active').filter({ hasText: 'untitled.soql' });
    await expect(activeTab).toBeVisible({ timeout: 10_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
```

Key differences from the old test:

- No `pause(Duration.seconds(20))` -- wait for specific elements instead
- Use `packageNls` keys instead of hardcoded command strings
- Use `test.step` instead of separate `it()` blocks (Playwright pattern: one test, many steps)
- Use Playwright `expect` with auto-retry instead of chai
- Both toggle directions are tested: builder-to-text-editor and text-editor-to-builder (the old test used `reloadWindow` between these; the Playwright version tests them sequentially in the same session)

### 6. Update the GitHub Actions workflow

Replace `[.github/workflows/soqlE2E.yml](.github/workflows/soqlE2E.yml)` with a Playwright-style workflow following the pattern in `metadataE2E.yml`, but simplified (no org needed):

- **Trigger**: `workflow_dispatch` + `push` on non-main/develop branches (like other Playwright workflows)
- **Jobs**: `e2e-web` on ubuntu-latest (start with web only; desktop can be added later)
- **Steps**:
  1. Checkout, Node 22, wireit cache, `npm install`
  2. Try E2E (`continue-on-error: true`, `E2E_NO_RETRIES: 1`): `npm run test:web -w salesforcedx-vscode-soql`
  3. If try-run fails: install Playwright browsers (`npx playwright install chromium --with-deps`)
  4. Parallel run: `npm run test:web -w salesforcedx-vscode-soql`
  5. Retry failed tests sequentially (`--last-failed`, `E2E_SEQUENTIAL: 1`)
  6. Upload `playwright-report` and `test-results` artifacts

No org setup steps are needed since the SOQL test doesn't require an org.

### 7. Remove or mark the old test as migrated

- Delete `[packages/salesforcedx-vscode-automation-tests/test/specs/soql.e2e.ts](packages/salesforcedx-vscode-automation-tests/test/specs/soql.e2e.ts)` (or add a comment noting it was migrated, depending on team preference)
- The old `runE2ETest.yml` reusable workflow remains for other non-migrated tests

### 8. Verification

- `npm run compile -w salesforcedx-vscode-soql` -- ensure new files compile
- `npm run lint -w salesforcedx-vscode-soql` -- no lint errors
- `npm run vscode:bundle -w salesforcedx-vscode-soql` -- bundle still works
- `npm run test:web -w salesforcedx-vscode-soql -- --retries 0` -- run Playwright web tests locally
- `npm run test:desktop -w salesforcedx-vscode-soql -- --retries 0` -- run Playwright desktop tests locally
- `npx knip` -- check for dead code
- `npm run check:dupes` -- no duplicated code flagged
