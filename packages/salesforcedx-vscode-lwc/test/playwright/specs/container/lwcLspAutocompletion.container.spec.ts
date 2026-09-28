/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for LWC LSP HTML autocompletion (ADR 0022). The web twin
 * (lwcLspAutocompletion.headless.spec.ts) proves completion works against a plain Page; this proves the
 * same completions come from the LWC language server running inside the Code Builder image, where the
 * LWC extension runs in the Node host alongside the full installed extension set. Pure local editing —
 * no org needed — so it is a deterministic signal that the LSP activated and indexed in the container.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  DIRTY_EDITOR,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  goToLineCol,
  saveFile,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { createLwc, openLwcFile, waitForLwcLspReady } from '../../utils/lwcUtils';
import { disableDeployOnSaveWeb } from '../../utils/lwcWebScratchAuth';

test('LWC LSP provides autocompletion for lightning-* base components in HTML templates (Code Builder)', async ({
  page
}) => {
  test.setTimeout(3 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Shared persistent workbench: unique suffix prevents collisions across specs/re-runs.
  const componentName = `autoComp${Date.now()}`;
  const htmlFile = `${componentName}.html`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await disableDeployOnSaveWeb(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'lwcAutocompletion.container.01-ready.png');
  });

  await test.step('create Lightning Web Component', async () => {
    await createLwc(page, componentName);
  });

  await test.step('wait for LWC LSP to finish indexing', async () => {
    await openLwcFile(page, htmlFile);
    await waitForLwcLspReady(page);
  });

  await test.step('position cursor inside the template body to type a new element', async () => {
    // Default template: line 1 "<template>", line 2 "</template>"
    // Move to line 1 end and insert a new line to type in
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${htmlFile}"]`);
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
    await saveFile(page);
    await expect(
      page.locator(DIRTY_EDITOR).first(),
      'HTML editor should be saved after inserting suggestion'
    ).not.toBeVisible({
      timeout: 5000
    });

    // The inserted line should contain the accepted component name
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${htmlFile}"]`);
    await expect(editor).toContainText('lightning-accordion', { timeout: 5000 });
    await saveScreenshot(page, 'lwcAutocompletion.container.02-inserted.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
