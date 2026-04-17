/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';

import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  typingSpeed,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForExtensionsActivated,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';
import packageNls from '../../../package.nls.json';

/** Close suggest widget so its DOM is not merged into editor reads. */
const dismissEditorOverlays = async (page: Page): Promise<void> => {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page
    .locator('.suggest-widget')
    .waitFor({ state: 'hidden', timeout: 3000 })
    .catch(() => {});
};

test('Apex snippets: isb completion applies String.isBlank', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for Salesforce project workspace and Apex extension', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    // Apex activates on workspaceContains:sfdx-project.json; wait until nothing is still "Activating", then assert palette command exists.
    await waitForExtensionsActivated(page);
    await verifyCommandExists(page, packageNls.apex_language_server_restart, 60_000);
    await saveScreenshot(page, 'apex-snippets.workspace-ready.png');
  });

  await test.step('open Anonymous.apex under scripts/apex (same default as SFDX: Create Anonymous Apex Script)', async () => {
    // Explorer leaves nested folders collapsed, so the file treeitem is not always findable; Quick Open does not require expanding folders.
    await openFileByName(page, 'Anonymous.apex');
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'apex-snippets.editor-open.png');
  });

  await test.step('type isb and accept snippet completion', async () => {
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();
    await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type('isb', { delay: typingSpeed });
    const completionRow = page
      .locator('div.monaco-list-row.show-file-icons')
      .filter({ hasText: /isb|String\.isBlank/i })
      .first();
    await expect(completionRow).toBeVisible({ timeout: 300_000 });
    await completionRow.click();
    await dismissEditorOverlays(page);
    await saveScreenshot(page, 'apex-snippets.after-completion.png');
  });

  await test.step('save and assert snippet body', async () => {
    await dismissEditorOverlays(page);
    await executeCommandWithCommandPalette(page, 'File: Save');
    const editor = page.locator(EDITOR_WITH_URI).first();
    const text = await editor.textContent();
    expect(text).toBeTruthy();
    expect(text).toContain('String.isBlank');
    expect(text).toContain('inputString');
    await saveScreenshot(page, 'apex-snippets.saved.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
