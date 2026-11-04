/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  isDesktop,
  resetContainerWorkbench,
  saveScreenshot,
  selectQuickInputOption,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedProjectTargetTest as test } from '../fixtures';

const PROJECT_NAME = `TestProject${Date.now()}`;

// On Code Builder this runs in the test:container:noproject phase, whose seeded folder has no
// sfdx-project.json.
if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test.afterEach(({ projectTarget }) => {
  projectTarget.removeProject(PROJECT_NAME);
});

(isDesktop() || isContainer ? test : test.skip.bind(test))(
  'Create Project: standard project via command palette',
  async ({ page, projectTarget }) => {
    test.setTimeout(120_000);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('open a non-project workspace', async () => {
      // Salesforce Services requires a workspace folder. The fixture has no
      // sfdx-project.json, so project-generation commands remain eligible while
      // their shared dependency can activate normally.
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      if (!isContainer) {
        await waitForVSCodeWorkbench(page);
      }
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await expect(page.getByRole('tree', { name: /Files Explorer/i })).toBeVisible({ timeout: 30_000 });
      await saveScreenshot(page, 'createProject.01-non-project-workspace.png');
    });

    await test.step('verify Create Project command available', async () => {
      await verifyCommandExists(page, packageNls.project_generate_text, 120_000);
    });

    await test.step('run Create Project, select Standard template', async () => {
      await executeCommandWithCommandPalette(page, packageNls.project_generate_text);
      await selectQuickInputOption(page, /Standard/, {
        quickInputVisibleTimeout: 30_000,
        optionVisibleTimeout: 15_000,
        retryTimeout: 60_000,
        timeout: 20_000
      });
      await saveScreenshot(page, 'createProject.02-standard-selected.png');
    });

    await test.step('enter project name', async () => {
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await page.keyboard.type(PROJECT_NAME);
      await saveScreenshot(page, 'createProject.03-name-entered.png');
      await page.keyboard.press('Enter');
    });

    await test.step('select folder in simple dialog', async () => {
      // files.simpleDialog.enable=true replaces native OS dialog with VS Code quick-input folder picker
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
      await saveScreenshot(page, 'createProject.04-folder-dialog.png');

      // Use .fill() to set path directly (avoids autocomplete issues with keyboard.type).
      // Trailing sep forces the simple dialog to navigate INTO the directory immediately.
      // Without it, Windows shows the parent dir with the folder highlighted, then auto-navigates
      // after a debounce - clicking "Create Project" during that transition doesn't register.
      const input = quickInput.locator('input.input');
      const { dialogDir, dialogSep } = projectTarget;
      await input.fill(`${dialogDir}${dialogSep}`);

      // Wait for dialog to show the directory contents (not just highlight the folder name)
      await expect(quickInput.getByText('path does not exist')).not.toBeVisible({ timeout: 5000 });
      const escapedDialogDir = dialogDir.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
      await expect(input).toHaveValue(new RegExp(`${escapedDialogDir}[/\\\\]$`), { timeout: 5000 });
      await saveScreenshot(page, 'createProject.05-folder-path-set.png');

      // Click "Create Project" button (openLabel from extension's showOpenDialog call)
      const createButton = quickInput.getByRole('button', { name: 'Create Project' });
      await createButton.click();
    });

    await test.step('verify project files on disk', async () => {
      // Poll via host node:fs: on Code Builder the extension's trailing vscode.openFolder navigates the
      // page away, but this check doesn't depend on the page.
      const projectDir = path.join(projectTarget.hostDir, PROJECT_NAME);

      // Poll for sfdx-project.json (project generation may take a moment)
      await expect(async () => {
        await fs.access(path.join(projectDir, 'sfdx-project.json'));
      }).toPass({ timeout: 120_000 });

      await fs.access(path.join(projectDir, 'force-app'));
      await saveScreenshot(page, 'createProject.06-verified.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
