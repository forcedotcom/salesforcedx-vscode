<!-- cf89dbd9-d4ea-475d-a760-d847bab30fd4 b8251dda-3cc9-4dfe-bf60-7b829166b06d -->
# Add Source Tracking Test for Apex Class Creation and Push

## Overview

Add a new test to `salesforcedx-vscode-metadata` that:

1. Creates a new Apex class via UI/file system
2. Asserts local change count goes up by 1
3. Edits the class
4. Verifies local count stays at 1 (editing doesn't add another change)
5. Pushes changes via `sf.metadata.deploy.start`
6. Asserts local change count returns to 0

## Implementation

### Add Deploy Command Constant

**File**: `packages/salesforcedx-vscode-metadata/src/constants.ts`

Add constant for deploy command title (from package.nls.json):

```typescript
export const DEPLOY_COMMAND_TITLE = 'BETA: Push Source to Default Org';
```

### New Shared Utility Function

**File**: `packages/salesforcedx-vscode-playwright/src/utils/fileHelpers.ts` (new file)

Create generic file creation utility using the simpler Quick Open approach:

```typescript
import type { Page } from '@playwright/test';

/** Create a new file with contents via Quick Open (works in both web and desktop) */
export const createFileWithContents = async (page: Page, filePath: string, contents: string): Promise<void> => {
  // Open Quick Open (Ctrl+P)
  await page.keyboard.press('Control+p');
  await page.locator('.quick-input-widget').waitFor({ state: 'visible', timeout: 10_000 });
  
  // Type the file path directly - VS Code will create it if it doesn't exist
  await page.keyboard.type(filePath);
  await page.keyboard.press('Enter');
  
  // Wait for editor to open
  await page.locator('.monaco-editor').waitFor({ state: 'visible', timeout: 10_000 });
  
  // Type the file contents
  await page.keyboard.type(contents);
  
  // Save file (Ctrl+S)
  await page.keyboard.press('Control+s');
  
  // Wait for save to complete (dirty indicator disappears)
  await page.waitForSelector('.monaco-editor.dirty', { state: 'detached', timeout: 5000 }).catch(() => {
    // Ignore timeout - file might save instantly
  });
};
```

**Export from**: `packages/salesforcedx-vscode-playwright/src/index.ts`

Add export:

```typescript
export { createFileWithContents } from './utils/fileHelpers';
```

### Test File

**Location**: `packages/salesforcedx-vscode-metadata/test/playwright/specs/sourceTrackingStatusBar.headless.spec.ts`

Add new test case after existing "load verification" test:

```typescript
test('create and push apex class: local changes tracked correctly', async ({ page }) => {
  // Setup (same as existing test)
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const createResult = await create();
  await waitForVSCodeWorkbench(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  const statusBarPage = new SourceTrackingStatusBarPage(page);
  await statusBarPage.waitForVisible(120_000);
  
  // Get initial counts (should have local=0 after org setup)
  const initialCounts = await statusBarPage.getCounts();
  expect(initialCounts.local).toBe(0);
  
  // Create new Apex class via Quick Open
  const className = `TestClass${Date.now()}`;
  const apexClassContent = `public class ${className} {
    public ${className}() {
        // Constructor
    }
}`;
  await createFileWithContents(page, `force-app/main/default/classes/${className}.cls`, apexClassContent);
  
  // Wait for local count to increment by 1
  await statusBarPage.waitForCounts({ 
    local: 1
  }, 60_000);
  
  // Edit the class (add a comment)
  await editOpenFile(page, 'Modified for testing');
  
  // Verify local count stays the same (editing existing change doesn't increment)
  const afterEditCounts = await statusBarPage.getCounts();
  expect(afterEditCounts.local).toBe(1);
  
  // Push changes using command palette
  await executeCommandWithCommandPalette(page, DEPLOY_COMMAND_TITLE);
  
  // Wait for deploy progress notification to appear
  await waitForDeployProgressNotificationToAppear(page, 30_000);
  
  // Wait for deploy progress notification to disappear (indicates completion)
  const deployingNotification = page
    .locator('.monaco-workbench .notification-list-item')
    .filter({ hasText: /Deploying/i })
    .first();
  await expect(deployingNotification).not.toBeVisible({ timeout: 120_000 });
  
  // Verify local count returns to 0
  await statusBarPage.waitForCounts({ local: 0 }, 60_000);
  
  // Validate no critical errors
  const criticalConsole = filterErrors(consoleErrors);
  const criticalNetwork = filterNetworkErrors(networkErrors);
  expect(criticalConsole).toHaveLength(0);
  expect(criticalNetwork).toHaveLength(0);
});
```

**Update imports**:

```typescript
import { 
  executeCommandWithCommandPalette, 
  createFileWithContents 
} from 'salesforcedx-vscode-playwright';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { editOpenFile } from '../utils/apexFileHelpers';
import { DEPLOY_COMMAND_TITLE } from '../../src/constants';
```

### Update Notification Helper

**File**: `packages/salesforcedx-vscode-metadata/test/playwright/pages/notifications.ts`

Remove `waitForDeploySuccessNotification` and `waitForDeployErrorNotification` functions (there are no success/error notifications, only progress notifications that disappear on completion).

## Key Considerations

- **Unique class names**: Use `Date.now()` to ensure each test run creates a unique class (avoids conflicts in parallel/retry runs)
- **Wait times**: Source tracking may take time to detect file changes (polling interval), use generous timeouts
- **Command title**: Uses `DEPLOY_COMMAND_TITLE` constant that matches `metadata_deploy_start_text` from package.nls.json ("BETA: Push Source to Default Org")
- **File path**: Must follow SFDX project structure (`force-app/main/default/classes/`)
- **Both environments**: Test must work in web and desktop (using UI interactions only, no fs/path imports)
- **Simpler approach**: Uses Quick Open directly with file path - VS Code prompts to create if file doesn't exist