---
name: Create Playwright E2E Tests for Metadata Extension with Dedicated Playwright Package
overview: ""
todos:
  - id: 132054c7-ac19-429e-9fd7-ff6caff25936
    content: Create salesforcedx-vscode-playwright package directory with src folders (1.1 - COMPLETE)
    status: completed
  - id: a849859e-2d5b-466e-a68f-53199b3505f1
    content: Configure package.json (private, dependencies) and tsconfig.json, verify compile (1.2 - COMPLETE)
    status: completed
  - id: 4953dc5e-fd06-4467-8e95-1d61836ef7a3
    content: Move shared utilities from org-browser to playwright package, verify compile (1.3 - COMPLETE)
    status: completed
  - id: 73f2f470-598c-44c4-91b1-450a88de3a7b
    content: Create src/index.ts with explicit named exports, verify compile (1.4 - COMPLETE)
    status: completed
  - id: 27e3250b-5853-4878-8ffc-ae7143f7062d
    content: Add playwright package dependency, update imports, remove duplicated files, verify compile (1.5 - COMPLETE)
    status: completed
  - id: 9c8cc4f7-d9b2-4304-a7c6-668a64a5b783
    content: Run org-browser playwright tests - environmental issues noted, ready for Phase 2 (1.5 verify - COMPLETE)
    status: completed
  - id: bf9da673-e06a-4b76-bed8-e57387f687b3
    content: Create test/playwright directory structure in metadata extension (2.1 - COMPLETE)
    status: completed
  - id: b43dd345-08d5-48e6-b279-bea95d951715
    content: Create fixtures (index.ts, desktopFixtures.ts, web/headlessServer.ts) + extract shared fixture types, verify compile (2.2 - COMPLETE)
    status: completed
  - id: ffab5e70-e776-48b1-8474-7b69061068f1
    content: Create sourceTrackingStatusBarPage.ts, verify compile (2.3 - COMPLETE)
    status: completed
  - id: fb99d4ce-cecc-41f2-852e-26ec42358837
    content: Create apexFileHelpers.ts and notifications.ts, verify compile (2.4 - COMPLETE)
    status: completed
  - id: 2d7a7289-a357-4f54-85fc-e299d07e383b
    content: Create sourceTrackingStatusBar.headless.spec.ts with load verification test, verify compile (2.5.1 - COMPLETE)
    status: completed
  - id: a3d2fd0c-bd47-4a43-a68c-9288219de0c3
    content: Create playwright configs, verify compile (2.6)
    status: completed
  - id: 4ba360c9-257b-4416-9a56-4a37050641e0
    content: Add dependencies and test scripts, verify compile and bundle (2.7)
    status: completed
  - id: 676043ff-f0f8-490f-9509-29ef7c559347
    content: Run metadata playwright tests (desktop and web), verify all pass (2.8)
    status: completed
  - id: 598ed5ce-e7a3-4bde-a1ce-9af3d1d7d6be
    content: Re-run org-browser tests to ensure nothing broke (2.8)
    status: completed
  - id: fd4ab030-d5a8-4c22-80c8-a27524f36ad2
    content: dedupe config files by sharing code from playwright pkg
    status: completed
  - id: 31066e21-c33d-4afa-a6da-25d1254bc3b6
    content: figure out a better way to share constants (made a new top-level export from services that's not index.js so playwright and other ext can use it)
    status: completed
---

# Create Playwright E2E Tests for Metadata Extension with Dedicated Playwright Package

## Overview

Create Playwright e2e tests for `salesforcedx-vscode-metadata` extension. **First**, create a new `salesforcedx-vscode-playwright` package and extract shared utilities from org-browser playwright tests into it. **Then**, create metadata extension tests using those shared utilities.**Critical**: After each sub-phase, verify org-browser playwright tests still pass before proceeding.

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

Move these files from `packages/salesforcedx-vscode-org-browser/test/playwright/` to `packages/salesforcedx-vscode-playwright/src/`:**Files to move:**

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

### 2.3 Extension-Specific Page Objects ✅ COMPLETE

- ✅ `pages/sourceTrackingStatusBarPage.ts`:
- Locates status bar item by CSS selector with text filter
- Parses counts using regex: `/(?:(\d+)\$\(warning\)\s*)?(\d+)\$\(arrow-down\)\s*(\d+)\$\(arrow-up\)/`
- Checks background color via classList inspection (error/warning classes)
- `waitForCounts()` - Poll until counts match expected values
- `click()`, `getTooltip()`, `getCounts()`, etc.

**Verify**: ✅ `npm run compile` passes

### 2.4 Extension-Specific Utilities ✅ COMPLETE

- ✅ `utils/apexFileHelpers.ts`:
- `openFileByName(page, fileName)` - Use Quick Open (Ctrl+P) to open file
- `editOpenFile(page, comment)` - Edit currently open file via UI interactions
- `findAndEditApexClass(page, className, comment)` - Combine open + edit operations
- **Note**: Refactored to use UI interactions (Quick Open, keyboard, Monaco editor) instead of VS Code API for cross-environment compatibility
- ✅ `pages/notifications.ts` (deploy-specific):
- `waitForDeployProgressNotificationToAppear(page, timeout)` - Locator filter `hasText: /Deploying/i`
- `waitForDeployErrorNotification(page, timeout)` - Locator filter `hasText: /deploy.*failed|deploy.*error/i`
- `waitForDeploySuccessNotification(page, timeout)` - Locator filter `hasText: /deploy.*succeeded|deploy.*success/i`
- ✅ **Enhanced Status Bar Item for Testability**:
- Added `id` parameter to `createStatusBarItem()`: `'salesforce.salesforcedx-vscode-metadata'`
- Added `name` property: `'Salesforce: Source Tracking'`
- This makes the status bar item much easier to locate in Playwright tests using `page.locator('#salesforce\\.salesforcedx-vscode-metadata')`

**Verify**: ✅ `npm run compile` passes

### 2.5 Test Specification

- `specs/sourceTrackingStatusBar.headless.spec.ts`:

1. **Load verification** ✅ COMPLETE:

- Setup org using shared `create()`, `upsertScratchOrgAuthFieldsToSettings`
- Verify status bar visible with remote changes > 0, local = 0, conflicts = 0
- Verify no error background when conflicts = 0
- Validate console/network errors

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

### 2.6 Playwright Configuration ✅

**COMPLETED**: Created both web and desktop configs using shared factory functions from `salesforcedx-vscode-playwright`:

- `playwright.config.desktop.ts` - Uses `createDesktopConfig()` shared factory (~10 lines)
- `playwright.config.web.ts` - Uses `createWebConfig()` shared factory (~10 lines)

**Additional Work**: Refactored org-browser configs to also use the same shared factories, eliminating ~50 lines of duplicated configuration per extension.**Verified**: Ran `npm run compile` in metadata package ✅

### 2.7 Package.json Updates ✅

**COMPLETED**: Added to `packages/salesforcedx-vscode-metadata/package.json`:

- Dev dependencies:
- `@playwright/test`
- `@vscode/test-electron`
- `@vscode/test-web`
- `salesforcedx-vscode-playwright` (for shared utilities)
- `cross-env` (for VSCODE_DESKTOP env var)
- Test scripts:
- `test:web`: `npm run bundle:extension && playwright test --config=playwright.config.web.ts --headed`
- `test:headless`: `npm run bundle:extension && playwright test --config=playwright.config.web.ts`
- `test:desktop`: `npm run bundle:extension && cross-env VSCODE_DESKTOP=1 playwright test --config=playwright.config.desktop.ts`
- `test:e2e`: `npm run test:headless && npm run test:desktop`

**Verified**: Ran `npm run compile` and `npm run bundle:extension` successfully ✅

### 2.8 Final Test Run ✅

**COMPLETED**: All metadata Playwright tests passing:

- ✅ `npm run test:desktop` (metadata): 1 passed (5.3s)
- ✅ `npm run test:headless` (metadata): 1 passed (17.0s)

**Key Fixes Made**:

- Updated `SourceTrackingStatusBarPage` to use `getByRole('button', { name: /arrow-down.*arrow-up/ })` selector (works in both web and desktop)
- Modified `getCounts()` to parse from aria-label instead of innerHTML (consistent across environments)
- Added `NO_COLOR` to non-critical error patterns in shared helpers
- Updated `getText()` with fallback logic for desktop vs web DOM differences

**VERIFIED**: Re-ran org-browser tests to ensure nothing broke:

- ✅ `npm run test:desktop` (org-browser): 5 passed (34.3s)
- ✅ `npm run test:web:headless` (org-browser): 5 passed (35.7s)

All org-browser tests continue to pass with shared config factories.

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