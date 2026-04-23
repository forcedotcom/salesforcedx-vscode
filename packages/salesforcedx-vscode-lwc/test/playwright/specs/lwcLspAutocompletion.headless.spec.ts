/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import {
  DIRTY_EDITOR,
  EDITOR_WITH_URI,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  setupConsoleMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import { createLwc, goToLineCol, openLwcFile, waitForLwcLspReady } from '../utils/lwcUtils';
import { applyLwcWebScratchAuth } from '../utils/lwcWebScratchAuth';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await applyLwcWebScratchAuth(page);
  await ensureSecondarySideBarHidden(page);
});

test('LWC LSP provides autocompletion for lightning-* base components in HTML templates', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, 'autoComp');
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    await openLwcFile(page, 'autoComp.html');
    await waitForLwcLspReady(page);
  });

  await test.step('position cursor inside the template body to type a new element', async () => {
    // Default template: line 1 "<template>", line 2 "</template>"
    // Move to line 1 end and insert a new line to type in
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="autoComp.html"]`);
    await editor.click();
    await goToLineCol(page, 1, 11); // end of "<template>"
    await page.keyboard.press('Enter');
  });

  await test.step('type a partial lightning component tag and trigger autocompletion', async () => {
    await page.keyboard.type('<lightnin');
    // VS Code autocomplete appears automatically after a short delay; wait for it
    const autocompleteList = page.locator('.editor-widget.suggest-widget .monaco-list-row');
    await autocompleteList.first().waitFor({ state: 'visible', timeout: 15_000 });
  });

  await test.step('verify lightning-accordion appears in the suggestion list', async () => {
    // The first suggestion should include a lightning-* component; confirm lightning-accordion is present
    const suggestions = page.locator('.editor-widget.suggest-widget .monaco-list-row');
    const suggestionTexts = await suggestions.allTextContents();
    const hasLightningAccordion = suggestionTexts.some(t => t.toLowerCase().includes('lightning-accordion'));
    expect(
      hasLightningAccordion,
      `Expected "lightning-accordion" in suggestions, got: ${suggestionTexts.slice(0, 5).join(' | ')}`
    ).toBe(true);
  });

  await test.step('select the lightning-accordion suggestion and verify it is inserted', async () => {
    // Click the lightning-accordion row directly
    const accordionRow = page
      .locator('.editor-widget.suggest-widget .monaco-list-row')
      .filter({ hasText: /^lightning-accordion/ });
    await accordionRow.first().click();

    // Close the tag and save
    await page.keyboard.type('>');
    await executeCommandWithCommandPalette(page, 'File: Save');
    await expect(
      page.locator(DIRTY_EDITOR).first(),
      'HTML editor should be saved after inserting suggestion'
    ).not.toBeVisible({
      timeout: 5000
    });

    // The inserted line should contain the accepted component name
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="autoComp.html"]`);
    await expect(editor).toContainText('lightning-accordion', { timeout: 5000 });
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
