/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the Visualforce language server (ADR 0022). The web twin
 * (visualforceLsp.headless.spec.ts) proves `.page` completion runs against a plain Page; this proves
 * the language server starts and answers inside the Code Builder image, where the Visualforce
 * extension runs in the Node host. Self-seeds a throwaway `.page` (no org, no committed fixture
 * file), so it is a fast, deterministic signal that the LSP activated in the container.
 */

import { expect, type Page } from '@playwright/test';
import {
  closeWelcomeTabs,
  DIRTY_EDITOR,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeExplorerContextMenuCommand,
  EXPLORER_INLINE_INPUT,
  saveFile,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';

/**
 * Seed an empty `.page` under force-app via the Explorer "New File..." action and open it. Opening a
 * `.page` triggers the extension's `onLanguage:visualforce` activation and starts the language
 * server. `fill()` targets the inline input directly so the filename lands regardless of the
 * tree→input focus handoff timing (see the web twin for why `keyboard.type` races here).
 */
const seedAndOpenPage = async (page: Page, name: string): Promise<void> => {
  await executeExplorerContextMenuCommand(page, /force-app/, /New File\.\.\./);
  const input = page.locator(EXPLORER_INLINE_INPUT);
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await input.fill(`${name}.page`, { force: true });
  await page.keyboard.press('Enter');

  const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${name}.page"]`);
  await editor.waitFor({ state: 'visible', timeout: 30_000 });
  await editor.click();
};

test('Visualforce LSP (Code Builder): autocompletes apex tags in a .page file', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const name = `CbVfPage${Date.now()}`;
  const suggestWidget = page.locator('.suggest-widget');
  const suggestions = suggestWidget.locator('.monaco-list-row');

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'vfLsp.container.01-ready.png');
  });

  await test.step('seed and open a .page file', async () => {
    await seedAndOpenPage(page, name);
  });

  await test.step('type a partial apex tag and trigger IntelliSense', async () => {
    // Explicitly trigger IntelliSense — the LSP may still be initializing in the container.
    await page.keyboard.type('<apex:pageM');
    await page.keyboard.press('Control+Space');
    await suggestWidget.waitFor({ state: 'visible', timeout: 30_000 });
  });

  await test.step('assert apex:pageMessage is suggested', async () => {
    await suggestions.first().waitFor({ state: 'visible', timeout: 10_000 });
    const suggestionTexts = await suggestions.allTextContents();
    const hasPageMessage = suggestionTexts.some(t => t.toLowerCase().includes('apex:pagemessage'));
    expect(
      hasPageMessage,
      `Expected "apex:pageMessage" in suggestions, got: ${suggestionTexts.slice(0, 5).join(' | ')}`
    ).toBe(true);
    await saveScreenshot(page, 'vfLsp.container.02-suggestions.png');
  });

  await test.step('accept the completion and save', async () => {
    const pageMessageRow = suggestions.filter({ hasText: /apex:pageMessage/i }).first();
    await pageMessageRow.click();
    await saveFile(page);
    await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 10_000 });

    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${name}.page"]`);
    await expect(editor.locator('.view-lines')).toContainText('apex:pageMessage', { timeout: 10_000 });
    await saveScreenshot(page, 'vfLsp.container.03-inserted.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Visualforce LSP (Code Builder): hovers mixed-case apex tags in a .page file', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const name = `CbVfHoverPage${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'vfLsp.container.hover.01-ready.png');
  });

  await test.step('seed and open a .page file', async () => {
    await seedAndOpenPage(page, name);
  });

  await test.step('type page content with mixed-case apex tags', async () => {
    await page.keyboard.type('<apex:pageBlock></apex:pageBlock>\n<apex:outputField/>');
  });

  const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${name}.page"]`);

  // Cold-LSP race: the first hover can land before the LS is ready and never re-triggers. Poll:
  // clear any open hover, move the pointer off the token so the next hover() is a genuine pointer
  // transition that re-drives the provider, then assert the card shows the original-case tag.
  const assertHover = async (tagName: string): Promise<void> => {
    const tagToken = editor
      .locator('.view-lines span')
      .filter({ hasText: new RegExp(`^${tagName}$`) })
      .first();
    await tagToken.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(async () => {
      await page.keyboard.press('Escape');
      const editorBox = await editor.boundingBox();
      await page.mouse.move((editorBox?.x ?? 0) + 10, (editorBox?.y ?? 0) + (editorBox?.height ?? 0) - 10);
      await tagToken.hover();
      await expect(
        page.locator('.monaco-hover:not(.hidden)').filter({ hasText: tagName }),
        `Visualforce LSP hover card should show ${tagName}`
      ).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45_000 });
  };

  await test.step('hover apex:pageBlock and verify the hover card', async () => {
    await assertHover('apex:pageBlock');
    await saveScreenshot(page, 'vfLsp.container.hover.02-pageBlock.png');
  });

  await test.step('hover apex:outputField and verify the hover card', async () => {
    await assertHover('apex:outputField');
    await saveScreenshot(page, 'vfLsp.container.hover.03-outputField.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
