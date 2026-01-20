---
name: E2E Tests for Playwright VSCode Extension
overview: Create comprehensive end-to-end tests for the playwright-vscode-ext package that verify all foundational actions work correctly on Mac, Windows, and Web platforms without requiring an org or specific project setup.
todos: []
---

# E2E Tests for Playwright VSCode Extension

## Overview

Create foundational e2e tests for `packages/playwright-vscode-ext` to verify core utilities work correctly across Mac, Windows, and Web platforms. These tests should run without an org or specific project/workspace setup.

## Foundational Actions to Test

Based on the exported functions from `packages/playwright-vscode-ext/src/index.ts`, we need to test:

1. **Command Palette** (`executeCommandWithCommandPalette`)
   - Opening command palette with F1
   - Typing and executing commands
   - Windows fallback behavior (Ctrl+Shift+P)

2. **File Operations** (`createFileWithContents`, `openFileByName`, `editOpenFile`)
   - Creating new files with content
   - Opening files via Quick Open (Ctrl+P)
   - Editing open files
   - Saving files (Ctrl+S)

3. **Settings** (`openSettingsUI`, `upsertSettings`)
   - Opening settings UI
   - Searching for settings
   - Modifying textbox settings
   - Modifying checkbox settings

4. **Output Channel** (`ensureOutputPanelOpen`, `selectOutputChannel`, `waitForOutputChannelText`, `outputChannelContains`, `clearOutputChannel`)
   - Opening output panel
   - Selecting output channels
   - Waiting for text to appear
   - Checking if text exists
   - Clearing output

5. **Context Menus** (`executeEditorContextMenuCommand`, `executeExplorerContextMenuCommand`)
   - Editor context menu (skip on Mac desktop)
   - Explorer context menu (skip on Mac desktop)

6. **Helper Functions** (`closeWelcomeTabs`, `waitForWorkspaceReady`, `waitForVSCodeWorkbench`)
   - Closing welcome tabs
   - Waiting for workspace to be ready
   - Waiting for workbench to load

## Test Structure

### Directory Structure

```
packages/playwright-vscode-ext/
├── test/
│   ├── playwright/
│   │   ├── fixtures/
│   │   │   ├── index.ts          # Export test fixture (web/desktop)
│   │   │   └── desktopFixtures.ts # Desktop-specific fixtures
│   │   ├── pages/                # Page objects (if needed)
│   │   ├── specs/
│   │   │   ├── commandPalette.headless.spec.ts
│   │   │   ├── fileOperations.headless.spec.ts
│   │   │   ├── settings.headless.spec.ts
│   │   │   ├── outputChannel.headless.spec.ts
│   │   │   ├── contextMenu.headless.spec.ts
│   │   │   └── helpers.headless.spec.ts
│   │   └── web/
│   │       └── headlessServer.ts # Web server setup
│   ├── playwright.config.web.ts
│   └── playwright.config.desktop.ts
```

### Test Files

#### 1. `commandPalette.headless.spec.ts`

- Test opening command palette with F1
- Test executing a simple command (e.g., "View: Close All Editors")
- Test Windows fallback to Ctrl+Shift+P
- Verify command execution completes

#### 2. `fileOperations.headless.spec.ts`

- Test creating a new file with content
- Test opening file via Quick Open (Ctrl+P)
- Test editing an open file
- Test saving file (Ctrl+S)
- Verify file appears in editor tabs

#### 3. `settings.headless.spec.ts`

- Test opening settings UI
- Test searching for a setting
- Test modifying a textbox setting
- Test modifying a checkbox setting
- Verify settings are saved

#### 4. `outputChannel.headless.spec.ts`

- Test opening output panel
- Test selecting an output channel
- Test waiting for text in output
- Test checking if text exists in output
- Test clearing output channel

#### 5. `contextMenu.headless.spec.ts`

- Test editor context menu (skip on Mac desktop)
- Test explorer context menu (skip on Mac desktop)
- Verify menu items are clickable

#### 6. `helpers.headless.spec.ts`

- Test closing welcome tabs
- Test waiting for workspace ready
- Test waiting for workbench to load

## Implementation Details

### Fixtures

Create `test/playwright/fixtures/index.ts` similar to org-browser:

- Export `test` based on `VSCODE_DESKTOP` env var
- Support both web and desktop fixtures
- Add debug mode support

Create `test/playwright/fixtures/desktopFixtures.ts`:

- Use `createDesktopTest` from playwright-vscode-ext
- Pass `fixturesDir: __dirname`

### Web Server

Create `test/playwright/web/headlessServer.ts`:

- Use `createHeadlessServer` from playwright-vscode-ext
- Extension name: "Playwright VSCode Ext"
- Caller dirname: `__dirname`

### Playwright Configs

Create `playwright.config.web.ts`:

- Use `createWebConfig()` from playwright-vscode-ext

Create `playwright.config.desktop.ts`:

- Use `createDesktopConfig()` from playwright-vscode-ext

### Package.json Updates

Add scripts:

- `"test:web": "wireit"`
- `"test:web:ui": "DEBUG_MODE=1 npm run test:web -- --headed"`
- `"test:web:debug": "npm run test:web -- --debug"`
- `"test:desktop": "wireit"`
- `"test:desktop:debug": "npm run test:desktop -- --debug"`

Add wireit configs for `test:web` and `test:desktop`:

- Depend on `compile` and `../playwright-vscode-ext:compile`
- Command: `playwright test --config=playwright.config.{web|desktop}.ts`
- Files: `test/playwright/**/*.ts`, `playwright.config.{web|desktop}.ts`

## GitHub Actions Workflow

Create `.github/workflows/playwrightVscodeExtE2E.yml`:

```yaml
name: Playwright VSCode Ext E2E

on:
  workflow_dispatch:
  pull_request:
    paths:
      - 'packages/playwright-vscode-ext/**'
      - '.github/workflows/playwrightVscodeExtE2E.yml'

jobs:
  e2e-web:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - Checkout
      - Setup Node.js
      - Install dependencies (npm ci)
      - Install Playwright browsers
      - Run web tests (npm run test:web -w playwright-vscode-ext)
      - Upload Playwright reports

  e2e-desktop-mac:
    runs-on: macos-latest
    timeout-minutes: 30
    steps:
      - Checkout
      - Setup Node.js
      - Install dependencies
      - Install Playwright browsers
      - Run desktop tests (VSCODE_DESKTOP=1 npm run test:desktop -w playwright-vscode-ext)
      - Upload Playwright reports

  e2e-desktop-windows:
    runs-on: windows-latest
    timeout-minutes: 30
    steps:
      - Checkout
      - Setup Node.js
      - Install dependencies
      - Install Playwright browsers
      - Run desktop tests (VSCODE_DESKTOP=1 npm run test:desktop -w playwright-vscode-ext)
      - Upload Playwright reports
```

## Test Requirements

### Platform Support

- All tests must run on Mac, Windows, and Web
- Context menu tests skip on Mac desktop (use `isMacDesktop()` check)
- Use `test.skip()` for platform-specific skips

### Test Isolation

- Each test should be independent
- No shared state between tests
- Use minimal workspace (empty or minimal project)

### Assertions

- Use clear error messages in `expect()` assertions
- Import `expect` from `@playwright/test`
- Fail early, avoid fallbacks/retries

### Code Style

- Use `test.step()` to organize sequential tests
- Prefer `getByRole` over CSS selectors
- Use `Control` for all shortcuts (not `ControlOrMeta`)
- Never use `waitForTimeout` - wait for specific elements
- Never use Node.js fs/path or VS Code API - use UI interactions only

## Files to Create/Modify

### New Files

- `packages/playwright-vscode-ext/test/playwright/fixtures/index.ts`
- `packages/playwright-vscode-ext/test/playwright/fixtures/desktopFixtures.ts`
- `packages/playwright-vscode-ext/test/playwright/web/headlessServer.ts`
- `packages/playwright-vscode-ext/test/playwright/specs/commandPalette.headless.spec.ts`
- `packages/playwright-vscode-ext/test/playwright/specs/fileOperations.headless.spec.ts`
- `packages/playwright-vscode-ext/test/playwright/specs/settings.headless.spec.ts`
- `packages/playwright-vscode-ext/test/playwright/specs/outputChannel.headless.spec.ts`
- `packages/playwright-vscode-ext/test/playwright/specs/contextMenu.headless.spec.ts`
- `packages/playwright-vscode-ext/test/playwright/specs/helpers.headless.spec.ts`
- `packages/playwright-vscode-ext/playwright.config.web.ts`
- `packages/playwright-vscode-ext/playwright.config.desktop.ts`
- `.github/workflows/playwrightVscodeExtE2E.yml`

### Modified Files

- `packages/playwright-vscode-ext/package.json` (add test scripts and wireit configs)
- `packages/playwright-vscode-ext/tsconfig.json` (ensure test files are included)

## Testing Strategy

1. Start with web tests locally
2. Verify desktop tests locally (Mac first, then Windows)
3. Create GitHub Actions workflow
4. Run in CI and fix platform-specific issues
5. Iterate: remove fallbacks, consolidate locators, increase DRY

## Success Criteria

- All tests pass on Mac, Windows, and Web
- Tests run without requiring an org or specific project
- Tests follow coding-playwright-tests.mdc rules
- Tests follow iterating-playwright-tests.mdc sequence
- GitHub Actions workflow runs successfully
- No flaky tests or platform-specific failures
