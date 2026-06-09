/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  executeCommandWithCommandPalette,
  prepareNoFolderOpenForPaletteTests,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  isDesktop,
  saveScreenshot,
  verifyCommandExists,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { emptyWorkspaceDesktopTest as test } from '../fixtures';

const PROJECT_NAME = `TestManifestProject${Date.now()}`;

(isDesktop() ? test : test.skip.bind(test))(
  'Create Project With Manifest: standard project via command palette',
  async ({ page, workspaceDir }) => {
    test.setTimeout(120_000);

    const targetDir = path.dirname(workspaceDir);

    await test.step('close workspace to reach empty state', async () => {
      await prepareNoFolderOpenForPaletteTests(page);
      await saveScreenshot(page, 'createProjectWithManifest.01-empty-workspace.png');
    });

    await test.step('verify Create Project with Manifest command available', async () => {
      await verifyCommandExists(page, packageNls.project_generate_with_manifest_text, 120_000);
    });

    await test.step('run Create Project with Manifest, select Standard template', async () => {
      await executeCommandWithCommandPalette(page, packageNls.project_generate_with_manifest_text);
      await waitForQuickInputFirstOption(page, {
        quickInputVisibleTimeout: 30_000,
        optionVisibleTimeout: 15_000,
        retryTimeout: 60_000
      });

      const standardRow = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: /Standard/ });
      await standardRow.waitFor({ state: 'visible', timeout: 20_000 });
      await standardRow.click();
      await saveScreenshot(page, 'createProjectWithManifest.02-standard-selected.png');
    });

    await test.step('enter project name', async () => {
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await page.keyboard.type(PROJECT_NAME);
      await saveScreenshot(page, 'createProjectWithManifest.03-name-entered.png');
      await page.keyboard.press('Enter');
    });

    await test.step('select folder in simple dialog', async () => {
      // files.simpleDialog.enable=true replaces native OS dialog with VS Code quick-input folder picker
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
      await saveScreenshot(page, 'createProjectWithManifest.04-folder-dialog.png');

      // Use .fill() to set path directly (avoids autocomplete issues with keyboard.type).
      // Trailing sep forces the simple dialog to navigate INTO the directory immediately.
      // Without it, Windows shows the parent dir with the folder highlighted, then auto-navigates
      // after a debounce - clicking "Create Project" during that transition doesn't register.
      const input = quickInput.locator('input.input');
      const targetPath = `${targetDir}${path.sep}`;
      await input.fill(targetPath);

      // Wait for dialog to show the directory contents (not just highlight the folder name)
      await expect(quickInput.getByText('path does not exist')).not.toBeVisible({ timeout: 5000 });
      await expect(input).toHaveValue(
        new RegExp(`${targetDir.replaceAll('\\', '\\\\').replaceAll('.', '\\.')}[/\\\\]$`),
        { timeout: 5000 }
      );
      await saveScreenshot(page, 'createProjectWithManifest.05-folder-path-set.png');

      // Click "Create Project" button (openLabel from extension's showOpenDialog call)
      const createButton = quickInput.getByRole('button', { name: 'Create Project' });
      await createButton.click();
    });

    await test.step('verify project files on disk', async () => {
      const projectDir = path.join(targetDir, PROJECT_NAME);

      // Poll for project files (project generation may take a moment)
      await expect(async () => {
        await fs.access(path.join(projectDir, 'sfdx-project.json'));
        await fs.access(path.join(projectDir, 'force-app'));
        await fs.access(path.join(projectDir, 'manifest', 'package.xml'));
      }).toPass({ timeout: 120_000 });
      await saveScreenshot(page, 'createProjectWithManifest.06-verified.png');
    });
  }
);
