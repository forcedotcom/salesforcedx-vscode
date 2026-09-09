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

    // The command drives a five-prompt sequence (no template pick when the workspace has no custom
    // apextrigger templates): name -> sObject -> events -> output dir. Each prompt reuses the same
    // quick-input widget, so we can't key off widget visibility alone (it never hides between
    // prompts). Instead wait for each prompt's own placeholder text before sending keystrokes, so
    // container latency (browser round-trip + Node host + org describe) can't make us type into a
    // not-yet-ready widget.
    const quickInput = page.locator(QUICK_INPUT_WIDGET);

    // 1) Trigger name (InputBox).
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await quickInput.getByText(messages.apex_trigger_name_prompt).waitFor({ state: 'visible', timeout: 30_000 });
    await saveScreenshot(page, 'createApexTrigger.container.03-name-prompt-visible.png');
    await page.keyboard.type(triggerName);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'createApexTrigger.container.04-after-type-name.png');

    // 2) sObject. The command runs `MetadataDescribeService.listSObjects()` against the boot org
    // before showing this prompt — a describe round-trip that is far slower in the container. Wait
    // for the sObject prompt's placeholder (only rendered once the describe resolved and the
    // QuickPick opened) with a generous timeout before typing, then pick the "Case" standard object.
    await quickInput
      .getByText(messages.apex_trigger_sobject_prompt)
      .waitFor({ state: 'visible', timeout: 90_000 });
    await saveScreenshot(page, 'createApexTrigger.container.05-sobject-prompt-visible.png');
    await page.keyboard.type('Case');
    // Live QuickPick when the org returned sObjects; text InputBox fallback when the describe was empty.
    const hasSObjectList = await page.locator('.quick-input-list').isVisible();
    if (hasSObjectList) {
      await waitForQuickInputFirstOption(page);
    }
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'createApexTrigger.container.06-after-select-sobject.png');

    // 3) Trigger events (multi-select QuickPick). On open, "before insert" (item 0) is pre-checked and
    // active. Deselect it, then check "after insert" (item 3) and "after update" (item 4) so the
    // scaffolded trigger declares `(after insert, after update)`.
    await quickInput.getByText(messages.apex_trigger_events_prompt).waitFor({ state: 'visible', timeout: 30_000 });
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'createApexTrigger.container.07-events-prompt-visible.png');

    // Deselect the pre-checked "before insert" (active row on open).
    await page.keyboard.press('Space');

    // Move to "after insert" (item 3: before insert, before update, before delete, after insert) and check it.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');

    // Move to "after update" (item 4) and check it.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');

    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'createApexTrigger.container.08-after-select-events.png');

    // 4) Output directory (QuickPick) — accept the default `triggers` folder.
    await quickInput.getByText(messages.output_dir_prompt).waitFor({ state: 'visible', timeout: 30_000 });
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'createApexTrigger.container.09-directory-prompt-visible.png');
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'createApexTrigger.container.10-after-accept-directory.png');

    // Scaffolding writes the file then opens it; in the container that round-trip is slower, so give
    // the editor more room to appear than the desktop/headless 5s. Target the scaffolded `.trigger`
    // by URI so a stale editor can't satisfy the wait.
    await page
      .locator(`${EDITOR_WITH_URI}[data-uri*="${triggerName}.trigger"]`)
      .first()
      .waitFor({ state: 'visible', timeout: 60_000 });
    await saveScreenshot(page, 'createApexTrigger.container.11-editor-opened.png');
  });

  await test.step('verify trigger was created correctly', async () => {
    // Timeouts are generous vs. the desktop twin: the scaffold file write + explorer tree refresh
    // lag behind the editor opening in the container.
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${triggerName}\\.trigger`, 'i') });
    await expect(editorTab).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'createApexTrigger.container.12-tab-visible.png');

    const explorerTrigger = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${triggerName}\\.trigger$`, 'i') })
      .first();
    await expect(explorerTrigger).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'createApexTrigger.container.13-trigger-in-explorer.png');

    await expect(
      page.getByRole('treeitem', { name: new RegExp(`${triggerName}\\.trigger-meta\\.xml$`, 'i') })
    ).toBeVisible({ timeout: 10_000 });

    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText(`trigger ${triggerName} on Case (after insert, after update)`, {
      timeout: 10_000
    });
    await expect(editorText).toContainText('}', { timeout: 10_000 });
    await saveScreenshot(page, 'createApexTrigger.container.14-trigger-content-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
