---
name: Deploy E2E Tests
overview: Create comprehensive e2e tests for deploySourcePath and deployManifest commands covering all entry points (command palette, editor context menu, explorer context menu on file/directory). Shared helpers in playwright-vscode-ext.
todos:
  - id: create-context-menu-helpers
    content: Create context menu helpers (editor + explorer) in playwright-vscode-ext
    status: pending
  - id: move-file-helpers
    content: Move openFileByName, editOpenFile to playwright-vscode-ext and add createManifestFile
    status: pending
  - id: update-exports
    content: Export new helpers from playwright-vscode-ext/src/index.ts
    status: pending
  - id: update-apex-helpers
    content: Update metadata's apexFileHelpers to import from playwright-vscode-ext
    status: pending
  - id: create-deploy-source-test
    content: Create deploySourcePath.headless.spec.ts with 4 scenarios
    status: pending
  - id: create-deploy-manifest-test
    content: Create deployManifest.headless.spec.ts with 2 scenarios
    status: pending
---

# Deploy Source Path and Deploy Manifest E2E Tests

## Overview

Create comprehensive e2e tests for `deploySourcePath` and `deployManifest` commands covering **all entry points**. Shared helpers will be added to `playwright-vscode-ext` for reuse across future tests.

## Test Scenarios

### Deploy Source Path (`sf.deploy.source.path` / `sf.deploy.current.source.file`)

| # | Entry Point | Trigger |

|---|-------------|---------|

| 1 | Command palette (active editor) | F1 → "SFDX: Deploy This Source to Org" |

| 2 | Editor context menu | Right-click in editor → "SFDX: Deploy This Source to Org" |

| 3 | Explorer context menu (file) | Right-click file in sidebar → "SFDX: Deploy This Source to Org" |

| 4 | Explorer context menu (directory) | Right-click folder in sidebar → "SFDX: Deploy This Source to Org" |

### Deploy Manifest (`sf.deploy.in.manifest`)

| # | Entry Point | Trigger |

|---|-------------|---------|

| 1 | Editor context menu | Right-click in editor (manifest open) → "SFDX: Deploy Source in Manifest to Org" |

| 2 | Explorer context menu (file) | Right-click manifest file in sidebar → "SFDX: Deploy Source in Manifest to Org" |

## Key Decisions

1. **Test all entry points** - each represents a distinct code path
2. **Disable deploy-on-save for both web and desktop** to avoid interference
3. **Use minimal org** for faster test execution
4. **Create reusable context menu helpers** in playwright-vscode-ext for future tests
5. **Single test file per command** with multiple `test.step` blocks for each scenario

## Context Menu Implementation

VS Code context menus are triggered via right-click (`button: 'right'`) and render as `.monaco-menu` elements.

### Editor Context Menu

```typescript
const editor = page.locator(EDITOR_WITH_URI).first();
await editor.click({ button: 'right' });
const contextMenu = page.locator(CONTEXT_MENU);
await contextMenu.getByRole('menuitem', { name: /Deploy This Source/i }).click();
```

### Explorer Context Menu

```typescript
// Focus explorer and find item
await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
const treeItem = page.getByRole('treeitem', { name: /MyClass\.cls/ });
await treeItem.click({ button: 'right' });
const contextMenu = page.locator(CONTEXT_MENU);
await contextMenu.getByRole('menuitem', { name: /Deploy This Source/i }).click();
```

This works cross-platform because VS Code renders its own context menus (not native OS menus).

## Files to Create/Modify

### 1. Create context menu helpers in playwright-vscode-ext

[`packages/playwright-vscode-ext/src/pages/contextMenu.ts`](packages/playwright-vscode-ext/src/pages/contextMenu.ts) (new file):

```typescript
import type { Page, Locator } from '@playwright/test';
import { EDITOR_WITH_URI, CONTEXT_MENU } from '../utils/locators';
import { executeCommandWithCommandPalette } from './commands';

/** Opens context menu on the currently focused editor */
export const openEditorContextMenu = async (page: Page): Promise<Locator> => {
  const editor = page.locator(EDITOR_WITH_URI).first();
  await editor.click({ button: 'right' });
  const contextMenu = page.locator(CONTEXT_MENU);
  await contextMenu.waitFor({ state: 'visible', timeout: 5_000 });
  return contextMenu;
};

/** Opens context menu on a file/folder in the explorer sidebar */
export const openExplorerContextMenu = async (
  page: Page,
  itemName: string | RegExp
): Promise<Locator> => {
  await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
  const treeItem = page.getByRole('treeitem', { name: itemName });
  await treeItem.waitFor({ state: 'visible', timeout: 10_000 });
  await treeItem.click({ button: 'right' });
  const contextMenu = page.locator(CONTEXT_MENU);
  await contextMenu.waitFor({ state: 'visible', timeout: 5_000 });
  return contextMenu;
};

/** Selects an item from an open context menu by name */
export const selectContextMenuItem = async (
  page: Page,
  itemName: string | RegExp
): Promise<void> => {
  const contextMenu = page.locator(CONTEXT_MENU);
  await contextMenu.getByRole('menuitem', { name: itemName }).click();
};

/** Opens editor context menu and selects an item */
export const executeEditorContextMenuCommand = async (
  page: Page,
  itemName: string | RegExp
): Promise<void> => {
  await openEditorContextMenu(page);
  await selectContextMenuItem(page, itemName);
};

/** Opens explorer context menu on item and selects a command */
export const executeExplorerContextMenuCommand = async (
  page: Page,
  explorerItemName: string | RegExp,
  menuItemName: string | RegExp
): Promise<void> => {
  await openExplorerContextMenu(page, explorerItemName);
  await selectContextMenuItem(page, menuItemName);
};
```

### 2. Update locators

[`packages/playwright-vscode-ext/src/utils/locators.ts`](packages/playwright-vscode-ext/src/utils/locators.ts):

Add:

```typescript
/** VS Code context menu container */
export const CONTEXT_MENU = '.monaco-menu';
```

### 3. Add file helpers to playwright-vscode-ext

[`packages/playwright-vscode-ext/src/utils/fileHelpers.ts`](packages/playwright-vscode-ext/src/utils/fileHelpers.ts):

Add:

- `openFileByName(page, fileName)` - opens file via Quick Open (Ctrl+P)
- `editOpenFile(page, comment)` - adds comment to open file and saves

### 4. Export from index

[`packages/playwright-vscode-ext/src/index.ts`](packages/playwright-vscode-ext/src/index.ts):

Add exports:

- `CONTEXT_MENU`
- `openEditorContextMenu`
- `openExplorerContextMenu`
- `selectContextMenuItem`
- `executeEditorContextMenuCommand`
- `executeExplorerContextMenuCommand`
- `openFileByName`
- `editOpenFile`

### 5. Create deploySourcePath test

[`packages/salesforcedx-vscode-metadata/test/playwright/specs/deploySourcePath.headless.spec.ts`](packages/salesforcedx-vscode-metadata/test/playwright/specs/deploySourcePath.headless.spec.ts):

```typescript
test.describe('Deploy Source Path', () => {
  test('deploys via all entry points', async ({ page }) => {
    // Setup: minimal org, disable deploy-on-save, wait for status bar

    await test.step('1. Command palette (active editor)', async () => {
      // Create apex class
      // Verify local count = 1
      // F1 → "SFDX: Deploy This Source to Org"
      // Verify notification appears/disappears
      // Verify local count = 0
    });

    await test.step('2. Editor context menu', async () => {
      // Edit class to create new local change
      // Verify local count = 1
      // Right-click editor → "SFDX: Deploy This Source to Org"
      // Verify local count = 0
    });

    await test.step('3. Explorer context menu (file)', async () => {
      // Edit class again
      // Verify local count = 1
      // Right-click file in explorer → "SFDX: Deploy This Source to Org"
      // Verify local count = 0
    });

    await test.step('4. Explorer context menu (directory)', async () => {
      // Edit class again
      // Verify local count = 1
      // Right-click "classes" folder → "SFDX: Deploy This Source to Org"
      // Verify local count = 0
    });

    // Validate no critical errors
  });
});
```

### 6. Create deployManifest test

[`packages/salesforcedx-vscode-metadata/test/playwright/specs/deployManifest.headless.spec.ts`](packages/salesforcedx-vscode-metadata/test/playwright/specs/deployManifest.headless.spec.ts):

```typescript
test.describe('Deploy Manifest', () => {
  test('deploys via all entry points', async ({ page }) => {
    // Setup: minimal org, disable deploy-on-save, wait for status bar
    // Create apex class (so manifest has something to deploy)
    // Create manifest/package.xml with ApexClass wildcard

    await test.step('1. Editor context menu', async () => {
      // Open manifest file
      // Edit apex class to create local change
      // Verify local count = 1
      // Right-click editor → "SFDX: Deploy Source in Manifest to Org"
      // Verify local count = 0
    });

    await test.step('2. Explorer context menu (file)', async () => {
      // Edit apex class again
      // Verify local count = 1
      // Right-click manifest in explorer → "SFDX: Deploy Source in Manifest to Org"
      // Verify local count = 0
    });

    // Validate no critical errors
  });
});
```

### 7. Update metadata's apexFileHelpers

[`packages/salesforcedx-vscode-metadata/test/playwright/utils/apexFileHelpers.ts`](packages/salesforcedx-vscode-metadata/test/playwright/utils/apexFileHelpers.ts):

- Remove `openFileByName` and `editOpenFile` (now imported from playwright-vscode-ext)
- Keep only `findAndEditApexClass` which composes those helpers

## Manifest Content

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <version>65.0</version>
</Package>
```

## Test Configuration

Both tests will:

- Use `test` from `../fixtures` (handles web vs desktop)
- Disable deploy-on-save via settings to control deploy timing
- Use `SourceTrackingStatusBarPage.waitForCounts({ local: 0 })` to verify deploy success
- Use `waitForDeployProgressNotificationToAppear` from existing notifications page
- Run as single test with multiple `test.step` blocks (shares setup, faster execution)