/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect } from '@playwright/test';
import { createProjectTest as test } from '../fixtures/desktopFixtures';
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  saveScreenshot,
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';

const PROJECT_NAME = `TestProject${Date.now()}`;

test('Create Project: standard project via command palette', async ({ page, workspaceDir }) => {
  test.setTimeout(120_000);

  const targetDir = path.dirname(workspaceDir);

  await test.step('close workspace to reach empty state', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await executeCommandWithCommandPalette(page, 'Workspaces: Close Workspace');
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'createProject.01-empty-workspace.png');
  });

  await test.step('verify Create Project command available', async () => {
    await verifyCommandExists(page, packageNls.project_generate_text, 120_000);
  });

  await test.step('run Create Project, select Standard template', async () => {
    await executeCommandWithCommandPalette(page, packageNls.project_generate_text);
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 45_000 });

    const standardRow = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: /Standard/ });
    await standardRow.waitFor({ state: 'visible', timeout: 20_000 });
    await standardRow.click();
    await saveScreenshot(page, 'createProject.02-standard-selected.png');
  });

  await test.step('enter project name', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(PROJECT_NAME);
    await saveScreenshot(page, 'createProject.03-name-entered.png');
    await page.keyboard.press('Enter');
  });

  await test.step('select folder in simple dialog', async () => {
    // files.simpleDialog.enable=true replaces native OS dialog with VS Code quick-input folder picker
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'createProject.04-folder-dialog.png');

    // Triple-click to select all existing path text (Control+a doesn't select-all on mac)
    const input = quickInput.locator('input.input');
    await input.click({ clickCount: 3 });
    await page.keyboard.type(targetDir);

    // Wait for dialog to validate the path
    await expect(quickInput.getByText('path does not exist')).not.toBeVisible({ timeout: 5000 });
    await saveScreenshot(page, 'createProject.05-folder-path-set.png');

    // Click "Create Project" button (openLabel from extension's showOpenDialog call)
    const createButton = quickInput.getByRole('button', { name: 'Create Project' });
    await createButton.click();
  });

  await test.step('verify project files on disk', async () => {
    const projectDir = path.join(targetDir, PROJECT_NAME);

    // Poll for sfdx-project.json (project generation may take a moment)
    await expect(async () => {
      await fs.access(path.join(projectDir, 'sfdx-project.json'));
    }).toPass({ timeout: 60_000 });

    await fs.access(path.join(projectDir, 'force-app'));
    await saveScreenshot(page, 'createProject.06-verified.png');
  });
});
