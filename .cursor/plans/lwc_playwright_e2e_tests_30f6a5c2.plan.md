---
name: LWC Playwright E2E Tests
overview: Move `runLwcTests.e2e.ts` from the automation-tests extension into `salesforcedx-vscode-lwc` and rewrite it as two Playwright desktop-only spec files.
todos:
  - id: read-prereqs
    content: Read createTestWorkspace, createLwc test-tools source, and package.nls.json to get exact templates and command keys
    status: pending
  - id: pkg-json
    content: 'Update salesforcedx-vscode-lwc/package.json: add playwright-vscode-ext devDep, test:desktop/test:e2e wireit scripts, test:compile tsconfig'
    status: pending
  - id: config
    content: "Create playwright.config.desktop.ts (createDesktopConfig({ testDir: './specs' }))"
    status: pending
  - id: fixtures
    content: Create fixtures/desktopFixtures.ts (createDesktopTest + workspaceDir override writing LWC files + execSync npm install) and fixtures/index.ts
    status: pending
  - id: spec-command-palette
    content: Create runLwcTestsCommandPalette.desktop.spec.ts with LSP indexing, run-all, run-current-file, toolbar, and code lens steps
    status: pending
  - id: spec-sidebar
    content: Create runLwcTestsSidebar.desktop.spec.ts with refresh, run-all, run-single-file, run-single-case, and navigate steps
    status: pending
  - id: verify
    content: Run check:dupes, test:compile, and test:desktop locally; fix any errors
    status: pending
isProject: false
---

# LWC Playwright E2E Tests

## New file layout inside `packages/salesforcedx-vscode-lwc/`

```
test/playwright/
├── playwright.config.desktop.ts          (createDesktopConfig({ testDir: './specs' }))
├── fixtures/
│   ├── index.ts                          (export test; desktop when VSCODE_DESKTOP=1)
│   └── desktopFixtures.ts               (createDesktopTest + workspaceDir override)
├── contants.ts                           (TEST_RUN_TIMEOUT)
└── specs/
    ├── runLwcTestsCommandPalette.desktop.spec.ts
    └── runLwcTestsSidebar.desktop.spec.ts
```

## Fixture: `desktopFixtures.ts`

- Calls `createDesktopTest({ fixturesDir, orgAlias: undefined, additionalExtensionDirs: [], disableOtherExtensions: false })`
- Extends it with a custom `workspaceDir` override (replaces the default):
  - Calls `createTestWorkspace(undefined)` to get base SF project dir
  - Writes LWC1 + LWC2 component files (`lwc1.html`, `lwc1.js`, `lwc1.js-meta.xml`, `__tests__/lwc1.test.js`) — **replicates what `createLwc` does in test-tools** (check [`@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components`](node_modules/@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components.js) for exact template)
  - Writes `package.json` with `@salesforce/sfdx-lwc-jest` devDependency
  - Runs `execSync('npm install', { cwd: dir })` before VS Code launches (once per test, acceptable)
  - Returns dir via `await use(dir)`

## Spec 1: `runLwcTestsCommandPalette.desktop.spec.ts`

Single `test()` with these `test.step()` blocks:

1. **verify LSP indexing** — open `lwc1.html` via Quick Open, `getByLabel('Editor Language Status')`, assert `aria-label` contains `'Indexing complete'`
2. **run all from command palette** — `executeCommandWithCommandPalette(page, packageNls['lightning_lwc_test_run_all_text'])`, wait for LWC Tests tree items to show passing icon
3. **run current file from command palette** — open `lwc1.test.js`, `executeCommandWithCommandPalette(page, ...)`, verify lwc1 tree items green
4. **run current file from main toolbar** — switch to `lwc2.test.js`, click toolbar button (aria label from nls), verify lwc2 tree items green
5. **run all via code lens** — `(isMacDesktop() || isWindowsDesktop()) ? test.step(...) : test.step.skip(...)`, click `Run All Tests` code lens in `lwc1.test.js`, verify tree icons
6. **run single via code lens** — same platform guard, click `Run Test` code lens in `lwc2.test.js`, verify specific test case icon

**Verification pattern** (no terminal text — icons only):

```typescript
const lwcTestPanel = page.locator('[id="workbench.view.extension.test"]');
await lwcTestPanel
  .locator('[role="treeitem"]')
  .filter({ hasText: 'lwc1' })
  .locator('.codicon-testing-passed-icon')
  .waitFor({ timeout: 60_000 });
```

> Exact icon CSS class must be confirmed by inspecting the DOM during implementation. The LWC test explorer uses `vscode.ThemeIcon('testPass')` — resolve actual codicon name from VS Code source or runtime inspection.

## Spec 2: `runLwcTestsSidebar.desktop.spec.ts`

Single `test()` with these `test.step()` blocks:

1. **open LWC Tests view** — `executeCommandWithCommandPalette(page, 'Testing: Focus on LWC Tests View')`
2. **refresh and verify tree structure** — `executeCommandWithCommandPalette(page, packageNls['lightning_lwc_test_refresh_text'])`, assert tree has items: `lwc1`, `lwc2`, `displays greeting`, `is defined`
3. **run all via sidebar action button** — click the `SFDX: Run All Lightning Web Component Tests` action on the section header (aria label), wait for all top-level items to show passing icon
4. **refresh resets icons** — re-run refresh command, verify top-level items show `testNotRun` icon
5. **run single file via sidebar** — hover `lwc1` tree item, click `SFDX: Run Lightning Web Component Test File` inline action, verify lwc1 items green
6. **run single case via sidebar** — hover `displays greeting` item, click `SFDX: Run Lightning Web Component Test Case`, verify that item green
7. **navigate to test** — verify active editor tab title is `lwc1.test.js` (clicking the test case opened the file — no reload needed)

## `package.json` changes

- Add `"@salesforce/playwright-vscode-ext": "*"` to `devDependencies`
- Add wireit scripts:

```json
"test:desktop": {
  "command": "playwright test --config=test/playwright/playwright.config.desktop.ts",
  "env": { "VSCODE_DESKTOP": "1", "PLAYWRIGHT_WORKERS": { "external": true } },
  "dependencies": [
    "vscode:bundle",
    "../salesforcedx-vscode-services:vscode:bundle",
    "../salesforcedx-vscode-services:spans:server",
    "../playwright-vscode-ext:compile"
  ],
  "files": ["test/playwright/**/*.ts", "package*.json"],
  "output": []
},
"test:e2e": { "dependencies": ["test:desktop"] }
```

- Add `test:compile` coverage for `test/playwright/tsconfig.json` (mirror apex-testing pattern)

## Key unknowns to resolve during implementation

- Exact codicon class for `testPass` / `testNotRun` theme icons (inspect DOM at runtime)
- What `createTestWorkspace(undefined)` creates (check [`desktopWorkspace.ts`](packages/playwright-vscode-ext/src/fixtures/desktopWorkspace.ts)) — may already include `sfdx-project.json`; LWC subdirs to be added on top
- Exact LWC file template (check test-tools `createLwc` source for html/js/test.js content)
- `package.nls.json` keys for LWC commands (check [`packages/salesforcedx-vscode-lwc/package.nls.json`](packages/salesforcedx-vscode-lwc/package.nls.json))

## Verification steps (after implementation)

- `npm run check:dupes` — no duplicate exports
- `npm run test:compile -w salesforcedx-vscode-lwc` — no TypeScript errors
- `npm run test:desktop -w salesforcedx-vscode-lwc` — both spec files pass locally
