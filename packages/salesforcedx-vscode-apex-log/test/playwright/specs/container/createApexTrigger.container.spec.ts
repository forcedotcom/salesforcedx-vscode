/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for Apex trigger scaffolding. The web twin
 * (createApexTrigger.headless.spec.ts) proves the command palette flow against a plain Page; this
 * proves the trigger template actually lands a `.trigger` file (plus meta) in the workspace from
 * inside the Code Builder image. With the container's boot-authed org, the sObject prompt resolves to
 * a live QuickPick, which web mode cannot cover.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

// Shared persistent workbench: reset editors + notifications between specs so scaffolding assertions
// start from a known state.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Apex Generate Trigger (Code Builder): creates a trigger via command palette', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique name so repeated runs on the shared workbench never collide with a prior scaffold.
  const triggerName = `GenerateTriggerTest${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'createApexTrigger.container.01-ready.png');
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.apex_generate_trigger_text, 120_000);
  });

  await test.step('create Apex trigger via command palette', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_trigger_text);
    await saveScreenshot(page, 'createApexTrigger.container.02-after-command.png');

    // Enter trigger name
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 5000 });
    await quickInput.getByText(messages.apex_trigger_name_prompt).waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'createApexTrigger.container.03-name-prompt-visible.png');
    await page.keyboard.type(triggerName);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'createApexTrigger.container.04-after-type-name.png');

    // Select sObject — QuickPick when org is connected, text input fallback otherwise
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'createApexTrigger.container.05-sobject-prompt-visible.png');
    await page.keyboard.type('Case');
    const hasSObjectList = await page.locator('.quick-input-list').isVisible();
    if (hasSObjectList) {
      await waitForQuickInputFirstOption(page);
    }
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'createApexTrigger.container.06-after-select-sobject.png');

    // Select trigger events (multi-select QuickPick)
    // Default pre-checked: "before insert". Deselect it, then select "after insert" and "after update".
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'createApexTrigger.container.07-events-prompt-visible.png');

    // "before insert" is first and focused — deselect it
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');

    // Navigate down to "after insert" (4th item: before insert, before update, before delete, after insert)
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');

    // Navigate down to "after update" (5th item)
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');

    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'createApexTrigger.container.08-after-select-events.png');

    // Select output directory
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'createApexTrigger.container.09-directory-prompt-visible.png');
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'createApexTrigger.container.10-after-accept-directory.png');

    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 5000 });
    await saveScreenshot(page, 'createApexTrigger.container.11-editor-opened.png');
  });

  await test.step('verify trigger was created correctly', async () => {
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${triggerName}\\.trigger`, 'i') });
    await expect(editorTab).toBeVisible({ timeout: 1000 });
    await saveScreenshot(page, 'createApexTrigger.container.12-tab-visible.png');

    const explorerTrigger = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${triggerName}\\.trigger$`, 'i') })
      .first();
    await expect(explorerTrigger).toBeVisible({ timeout: 2000 });
    await saveScreenshot(page, 'createApexTrigger.container.13-trigger-in-explorer.png');

    await expect(
      page.getByRole('treeitem', { name: new RegExp(`${triggerName}\\.trigger-meta\\.xml$`, 'i') })
    ).toBeVisible({ timeout: 2000 });

    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText(`trigger ${triggerName} on Case (after insert, after update)`, {
      timeout: 100
    });
    await expect(editorText).toContainText('}', { timeout: 100 });
    await saveScreenshot(page, 'createApexTrigger.container.14-trigger-content-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
