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
  QUICK_INPUT_WIDGET,
  resetContainerWorkbench,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { isContainer, noOrgTest, test as containerTest } from '../fixtures';

// Desktop/web run with no org, so the sObject prompt is the text InputBox fallback. The container's org
// is always boot-authed, so there the same prompt is a live QuickPick of the org's sObjects — one spec
// covers both branches of promptForSObject.
const test = isContainer ? containerTest : noOrgTest;

/**
 * The command's prompt. InputBox prompts render as a visible text node; QuickPick `placeHolder`s render
 * ONLY as the input's `placeholder` attribute. Each step must wait for its own prompt: the quick-input
 * widget is reused between prompts (it never hides), and a stale list from the previous QuickPick can
 * satisfy waitForQuickInputFirstOption before the next prompt renders, so keystrokes land on the old list.
 */
const quickInputPrompt = (page: Page, prompt: string) =>
  page.locator(QUICK_INPUT_WIDGET).getByText(prompt).or(page.getByPlaceholder(prompt)).first();

// Runs against a fresh desktop/web instance and against the one shared, serial container workbench
// alike: waitForVSCodeWorkbench is a no-op once ready, and resetContainerWorkbench's cleanup is a
// harmless best-effort on a fresh instance.
test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await resetContainerWorkbench(page);
});

test('Apex Generate Trigger: creates new Apex trigger via command palette', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique name so repeated runs on the shared container workbench never collide with a prior scaffold.
  const triggerName = `GenerateTriggerTest${Date.now()}`;
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  const triggerTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${triggerName}\\.trigger$`, 'i') });

  await test.step('setup', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.apex_generate_trigger_text, 120_000);
  });

  await test.step('cancel trigger name input', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_trigger_text);
    await quickInputPrompt(page, messages.apex_trigger_name_prompt).waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.press('Escape');
    await expect(quickInput).not.toBeVisible({ timeout: 5000 });
    await expect(triggerTab).not.toBeVisible();
  });

  await test.step('cancel trigger sObject input', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_trigger_text);
    await quickInputPrompt(page, messages.apex_trigger_name_prompt).waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(`  ${triggerName}  `);
    await page.keyboard.press('Enter');
    // With an org, the command describes its sObjects before showing this prompt — slow in the container
    await quickInputPrompt(page, messages.apex_trigger_sobject_prompt).waitFor({ state: 'visible', timeout: 90_000 });
    await page.keyboard.press('Escape');
    await expect(quickInput).not.toBeVisible({ timeout: 5000 });
    await expect(triggerTab).not.toBeVisible();
  });

  await test.step('create Apex trigger via command palette', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_trigger_text);
    await saveScreenshot(page, 'step1.after-command.png');

    // Enter trigger name
    await quickInputPrompt(page, messages.apex_trigger_name_prompt).waitFor({ state: 'visible', timeout: 30_000 });
    await saveScreenshot(page, 'step1.name-prompt-visible.png');
    await page.keyboard.type(`  ${triggerName}  `);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-type-name.png');

    // Select sObject — QuickPick when an org is connected, text InputBox fallback otherwise
    await quickInputPrompt(page, messages.apex_trigger_sobject_prompt).waitFor({ state: 'visible', timeout: 90_000 });
    await saveScreenshot(page, 'step1.sobject-prompt-visible.png');
    const hasSObjectList = await page.getByPlaceholder(messages.apex_trigger_sobject_prompt).isVisible();
    // The InputBox path trims its value, so pad it; the QuickPick path returns the picked label
    await page.keyboard.type(hasSObjectList ? 'Case' : '  Case  ');
    if (hasSObjectList) {
      await waitForQuickInputFirstOption(page);
    }
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-select-sobject.png');

    // Select trigger events (multi-select QuickPick)
    // Default pre-checked: "before insert". Deselect it, then select "after insert" and "after update".
    await quickInputPrompt(page, messages.apex_trigger_events_prompt).waitFor({ state: 'visible', timeout: 30_000 });
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'step1.events-prompt-visible.png');

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
    await saveScreenshot(page, 'step1.after-select-events.png');

    // Select output directory
    await quickInputPrompt(page, messages.output_dir_prompt).waitFor({ state: 'visible', timeout: 30_000 });
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'step1.directory-prompt-visible.png');
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-accept-directory.png');

    // Target the scaffolded `.trigger` by URI so a stale editor can't satisfy the wait
    await page
      .locator(`${EDITOR_WITH_URI}[data-uri*="${triggerName}.trigger"]`)
      .first()
      .waitFor({ state: 'visible', timeout: 60_000 });
    await saveScreenshot(page, 'step1.editor-opened.png');
  });

  await test.step('verify trigger was created correctly', async () => {
    // Timeouts cover the container, where the explorer tree refresh lags behind the editor opening
    await expect(triggerTab).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'step2.tab-visible.png');

    const explorerTrigger = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${triggerName}\\.trigger$`, 'i') })
      .first();
    await expect(explorerTrigger).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'step2.trigger-in-explorer.png');

    await expect(
      page.getByRole('treeitem', { name: new RegExp(`${triggerName}\\.trigger-meta\\.xml$`, 'i') })
    ).toBeVisible({ timeout: 10_000 });

    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText(`trigger ${triggerName} on Case (after insert, after update)`, {
      timeout: 10_000
    });
    await expect(editorText).toContainText('}');
    await saveScreenshot(page, 'step2.trigger-content-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
