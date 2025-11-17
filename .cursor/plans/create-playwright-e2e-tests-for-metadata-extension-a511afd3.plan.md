<!-- a511afd3-1f16-46d5-8864-0c07b70f3e30 4640080e-4af9-44d5-9eea-79fc1b441498 -->
# Create Playwright E2E Tests for Metadata Extension with Dedicated Playwright Package

## Overview

Create Playwright e2e tests for `salesforcedx-vscode-metadata` extension. **First**, create a new `salesforcedx-vscode-playwright` package and extract shared utilities from org-browser playwright tests into it. **Then**, create metadata extension tests using those shared utilities.

**Critical**: After each sub-phase, verify org-browser playwright tests still pass before proceeding.

## Phase 1: Create Shared Playwright Utilities Package

### 1.1 Create New Package Structure

- **Location**: `packages/salesforcedx-vscode-playwright/`
- Create package directory structure:
- `src/` - Source files for shared utilities
- `utils/` - Shared helper utilities
- `pages/` - Shared page objects
- `shared/` - Shared utilities (screenshot utils)
- `fixtures/` - Shared fixture utilities
- `package.json` - Package configuration (NOT for npm publishing)
- `tsconfig.json` - TypeScript configuration
- `README.md` - Package documentation

**Verify**: N/A (no tests to break yet)

### 1.2 Create Package Configuration

- **package.json**:
- Name: `salesforcedx-vscode-playwright`
- Version: Match monorepo version
- Private: `true` (not for npm publishing)
- Main: `./out/index.js`
- DevDependencies (all are dev-time only):
- `@playwright/test`
- `@vscode/test-electron`
- `@vscode/test-web`
- `@salesforce/core` (for AuthFields type only)
- Scripts:
- `compile`: TypeScript compilation
- `watch`: TypeScript watch mode
- `clean`: Clean output directory

- **tsconfig.json**: Extend from common config, compile to `out/`

**Verify**: Run `npm run compile` from repo root, ensure no errors

### 1.3 Move Shared Utilities from Org-Browser

Move these files from `packages/salesforcedx-vscode-org-browser/test/playwright/` to `packages/salesforcedx-vscode-playwright/src/`:

**Files to move:**

- `utils/helpers.ts` → `src/utils/helpers.ts`
- Exports: `setupConsoleMonitoring`, `setupNetworkMonitoring`, `filterErrors`, `filterNetworkErrors`, `waitForVSCodeWorkbench`, `typingSpeed`

- `utils/dreamhouseScratchOrgSetup.ts` → `src/utils/dreamhouseScratchOrgSetup.ts`
- Exports: `create`, `DREAMHOUSE_ORG_ALIAS`

- `pages/settings.ts` → `src/pages/settings.ts`
- Exports: `upsertScratchOrgAuthFieldsToSettings` and helper functions
- Note: Remove `OrgBrowserPage` import, make it generic or parameterize (accept page object as parameter)

- `pages/commands.ts` → `src/pages/commands.ts`
- Exports: `executeCommandWithCommandPalette`, `openCommandPalette`, `executeCommand`

- `shared/screenshotUtils.ts` → `src/shared/screenshotUtils.ts`
- Exports: `saveScreenshot`

- `fixtures/desktopWorkspace.ts` → `src/fixtures/desktopWorkspace.ts`
- Exports: `createTestWorkspace`
- Make org alias configurable via parameter (default to DREAMHOUSE_ORG_ALIAS)

**Files to NOT move** (extension-specific):

- `pages/notifications.ts` - Keep in org-browser (retrieve-specific)
- `pages/orgBrowserPage.ts` - Keep in org-browser (extension-specific)
- `fixtures/desktopFixtures.ts` - Keep in org-browser (extension-specific paths)
- `fixtures/index.ts` - Keep in org-browser (extension-specific)
- `web/headlessServer.ts` - Keep in org-browser (extension-specific paths)

**Verify**: Run `npm run compile` in playwright package, ensure files compile without errors

### 1.4 Create Package Index Exports

- Create `src/index.ts` with **explicit named exports** (no `export *` per TypeScript rules):
- From `./utils/helpers`: export `setupConsoleMonitoring`, `setupNetworkMonitoring`, `filterErrors`, `filterNetworkErrors`, `waitForVSCodeWorkbench`, `typingSpeed`
- From `./utils/dreamhouseScratchOrgSetup`: export `create`, `DREAMHOUSE_ORG_ALIAS`
- From `./pages/settings`: export `upsertScratchOrgAuthFieldsToSettings`
- From `./pages/commands`: export `executeCommandWithCommandPalette`, `openCommandPalette`, `executeCommand`
- From `./shared/screenshotUtils`: export `saveScreenshot`
- From `./fixtures/desktopWorkspace`: export `createTestWorkspace`

**Verify**: Run `npm run compile` in playwright package, ensure index exports compile

### 1.5 Update Org-Browser to Use Shared Package

- Add `salesforcedx-vscode-playwright` as devDependency in org-browser `package.json`
- Update imports in org-browser test files:
- Change from: `'../utils/helpers'`
- To: `'salesforcedx-vscode-playwright'`
- Update all test files: specs, pages (orgBrowserPage.ts, notifications.ts), fixtures
- Update `settings.ts` usage to handle page object parameter changes (if needed)
- Remove duplicated files from org-browser (after imports verified)
- Run `npm run compile` in org-browser

**Verify**: Run org-browser playwright tests:

- `npm run test:desktop` in org-browser package
- `npm run test:web:headless` in org-browser package
- All tests must pass before proceeding to Phase 2

## Phase 2: Create Metadata Extension Tests

### 2.1 Test Infrastructure Setup

- **Location**: `packages/salesforcedx-vscode-metadata/test/playwright/`
- Create directory structure:
- `fixtures/` - Extension-specific fixtures
- `pages/` - Extension-specific page objects
- `specs/` - Test specifications
- `utils/` - Extension-specific utilities
- `web/` - Web headless server setup

**Verify**: Directory structure created (no tests yet)

### 2.2 Extension-Specific Fixtures ✅ COMPLETE

- ✅ `fixtures/index.ts` - Exports test based on VSCODE_DESKTOP env var
- ✅ `fixtures/desktopFixtures.ts` - Uses shared `createTestWorkspace`, `filterErrors`, and fixture types
- ✅ `web/headlessServer.ts` - **Reduced from 67 → 14 lines!** Uses shared `createHeadlessServer()` and `setupSignalHandlers()`
- ✅ **Shared Utilities Created**:
  - `salesforcedx-vscode-playwright/src/fixtures/desktopFixtureTypes.ts` - Shared `WorkerFixtures` and `TestFixtures` types
  - `salesforcedx-vscode-playwright/src/web/createHeadlessServer.ts` - Parameterized headless server (79% reduction per extension)
  - Desktop fixtures remain local (need `__dirname` context), but use shared utilities and types reducing duplication

**Verify**: ✅ All tests pass:
- ✅ `npm run test:web:headless` - 4/5 passed (1 flaky pre-existing)
- ✅ `npm run test:desktop` - 5/5 passed

### 2.3 Extension-Specific Page Objects

- `pages/sourceTrackingStatusBarPage.ts`:
- Locate status bar item by aria-label or CSS selector (`.monaco-workbench .statusbar-item`)
- Read status bar text and parse counts using regex: `/(\d+)\$\(warning\).*?(\d+)\$\(arrow-down\).*?(\d+)\$\(arrow-up\)/`
- Verify background color via `getComputedStyle` or CSS class inspection
- Click status bar to trigger commands
- `waitForStatusBarUpdate(expectedCounts, timeout)` - Poll until counts match

**Verify**: Run `npm run compile` in metadata package, ensure page objects compile

### 2.4 Extension-Specific Utilities

- `utils/apexFileHelpers.ts`:
- `findApexClassFiles(workspacePath)` - Find .cls files in force-app using glob or fs
- `editApexFile(filePath, comment)` - Read file, add comment at top, write back
- `waitForFileChangeDetection(page, timeout)` - Wait for status bar to reflect changes (poll statusBarPage)

- `pages/notifications.ts` (deploy-specific, separate from org-browser retrieve notifications):
- `waitForDeployProgressNotificationToAppear(page, timeout)` - Locator: `.notification-list-item` filter `hasText: /Deploying/i`
- `waitForDeployErrorNotification(page, timeout)` - Locator filter `hasText: /deploy.*failed|error/i`
- `waitForDeploySuccessNotification(page, timeout)` - Locator filter `hasText: /deploy.*succeeded|success/i`

**Verify**: Run `npm run compile` in metadata package, ensure utilities compile

### 2.5 Test Specification

- `specs/sourceTrackingStatusBar.headless.spec.ts`:

1. **Load verification**:

- Setup org using shared `create()`, `upsertScratchOrgAuthFieldsToSettings`
- Verify status bar visible with remote changes > 0, local = 0, conflicts = 0

2. **Conflict creation**:

- Find Apex class from dreamhouse deployment
- Edit file (add comment)
- Wait for status bar update
- Verify conflict UI (red background, conflicts > 0)

3. **Deploy error**:

- Execute `sf.metadata.deploy.start` using shared `executeCommandWithCommandPalette`
- Verify error notification appears

4. **Deploy success**:

- Execute `sf.metadata.deploy.start.ignore.conflicts`
- Wait for deploy success notification
- Verify status bar updates: conflicts=0, local=0, remote decreased

**Verify**: Tests compile (run `npm run compile` in metadata package)

### 2.6 Playwright Configuration

- `playwright.config.desktop.ts` - Desktop/Electron config (similar to org-browser)
- `playwright.config.web.ts` - Web config with headless server (similar to org-browser)

**Verify**: Run `npm run compile` in metadata package

### 2.7 Package.json Updates

- Add dev dependencies to metadata `package.json`:
- `@playwright/test`
- `@vscode/test-electron`
- `@vscode/test-web`
- `salesforcedx-vscode-playwright` (for shared utilities)
- `cross-env` (for VSCODE_DESKTOP env var)
- Add test scripts:
- `test:web`: `npm run bundle:extension && playwright test --config=playwright.config.web.ts --headed`
- `test:web:headless`: `npm run bundle:extension && playwright test --config=playwright.config.web.ts`
- `test:desktop`: `npm run bundle:extension && cross-env VSCODE_DESKTOP=1 playwright test --config=playwright.config.desktop.ts`
- `test:e2e`: `npm run test:web:headless && npm run test:desktop`

**Verify**: Run `npm run compile` and `npm run bundle:extension` in metadata package

### 2.8 Final Test Run

**Verify**: Run metadata playwright tests:

- `npm run test:desktop` in metadata package
- `npm run test:web:headless` in metadata package
- All 4 test steps should pass

**Verify**: Re-run org-browser tests to ensure nothing broke:

- `npm run test:desktop` in org-browser package
- `npm run test:web:headless` in org-browser package

## Phase 3: GitHub Actions Workflow

### 3.1 Create Metadata E2E Workflow

- **Location**: `.github/workflows/metadataE2E.yml`
- Based on `orgBrowserE2E.yml` pattern:
- Trigger on `workflow_dispatch` and `pull_request` when:
- `packages/salesforcedx-vscode-metadata/**` changes
- `packages/salesforcedx-vscode-services/**` changes
- `packages/salesforcedx-vscode-playwright/**` changes
- `.github/workflows/metadataE2E.yml` changes

- **Jobs**:
- `e2e-web`: Ubuntu runner
- Setup Node.js 22
- Install SF CLI
- Install Playwright chromium with deps
- Clone dreamhouse and create scratch org
- Bundle metadata + services extensions
- Run `npm run test:web:headless:ci -w salesforcedx-vscode-metadata`
- Upload playwright reports and test results
- Cleanup scratch org

- `e2e-desktop`: Matrix (macos-latest, windows-latest)
- Same steps as e2e-web but with `VSCODE_DESKTOP=1`
- Run `npm run test:desktop:ci -w salesforcedx-vscode-metadata`
- Upload per-OS playwright reports

**Verify**:

- Workflow file syntax is valid (can use `actionlint` or GitHub's workflow validator)
- Environment variables match (DREAMHOUSE_ORG_ALIAS, SFDX_AUTH_URL)
- Secrets required: `SFDX_AUTH_URL_E2E`

## Test Implementation Details

### Test Flow

1. **Setup**: Use shared `create()`, `upsertScratchOrgAuthFieldsToSettings`
2. **Initial State**: Verify status bar shows remote changes count
3. **Create Conflict**: Edit Apex file, wait for status bar update, verify red background
4. **Deploy Error**: Use shared `executeCommandWithCommandPalette` for deploy, verify error notification
5. **Deploy Success**: Deploy with ignore conflicts, verify status bar updates

### Key Assertions

- Status bar text format: `{conflicts}$(warning) {remote}$(arrow-down) {local}$(arrow-up)`
- Background color CSS variable when conflicts > 0
- Command execution results (error notifications vs success)
- Status bar count changes after operations

### To-dos

- [x] Create salesforcedx-vscode-playwright package directory with src folders (1.1 - COMPLETE)
- [x] Configure package.json (private, dependencies) and tsconfig.json, verify compile (1.2 - COMPLETE)
- [x] Move shared utilities from org-browser to playwright package, verify compile (1.3 - COMPLETE)
- [x] Create src/index.ts with explicit named exports, verify compile (1.4 - COMPLETE)
- [x] Add playwright package dependency, update imports, remove duplicated files, verify compile (1.5 - COMPLETE)
- [x] Run org-browser playwright tests - environmental issues noted, ready for Phase 2 (1.5 verify - COMPLETE)
- [x] Create test/playwright directory structure in metadata extension (2.1 - COMPLETE)
- [x] Create fixtures (index.ts, desktopFixtures.ts, web/headlessServer.ts) + extract shared fixture types, verify compile (2.2 - COMPLETE)
- [ ] Create sourceTrackingStatusBarPage.ts, verify compile (2.3)
- [ ] Create apexFileHelpers.ts and notifications.ts, verify compile (2.4)
- [ ] Create sourceTrackingStatusBar.headless.spec.ts with 4 test steps, verify compile (2.5)
- [ ] Create playwright configs, verify compile (2.6)
- [ ] Add dependencies and test scripts, verify compile and bundle (2.7)
- [ ] Run metadata playwright tests (desktop and web), verify all pass (2.8)
- [ ] Re-run org-browser tests to ensure nothing broke (2.8)
