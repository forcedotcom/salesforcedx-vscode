/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the LWC snippets (ADR 0022). The web twin (lwcSnippets.headless.spec.ts)
 * proves Insert Snippet / completion snippets apply against a plain Page; this proves the same
 * snippets work inside the Code Builder image, where the LWC extension runs in the Node host
 * alongside the full installed extension set. Pure local editing — no org needed — so it is a
 * deterministic signal that the snippet contributions loaded in the container.
 *
 * Note: the container Page is browser-flavored (`isDesktop()` is false) even though it runs the
 * desktop LWC LSP, so we always seed a bundle via the SFDX command and open files through the Files
 * Explorer tree (no `isDesktop()` gating).
 */

import { expect, type Page } from '@playwright/test';

import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  insertSnippet,
  openFileFromExplorerTree,
  QUICK_INPUT_WIDGET,
  saveFile,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  typingSpeed,
  validateNoCriticalErrors,
  waitForExtensionsActivated,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';

import { containerTest as test } from '../../fixtures/containerFixtures';
import { createLwcViaSfdxCommand } from '../../utils/lwcUtils';
import { disableDeployOnSaveWeb } from '../../utils/lwcWebScratchAuth';

/**
 * The container Page behaves like web: `@vscode/test-web`-style file search does not surface files
 * that have not been opened, so navigate the Files Explorer tree instead of Quick Open.
 */
const openLwcBundleFile = async (page: Page, bundleName: string, ext: 'html' | 'js'): Promise<void> => {
  const fileName = ext === 'html' ? `${bundleName}.html` : `${bundleName}.js`;
  await openFileFromExplorerTree(page, fileName, ['force-app', 'main', 'default', 'lwc', bundleName]);
};

/** Monaco may use NBSP; snippets can be one line or multiline — collapse for assertions. */
const collapseEditorWhitespace = (text: string): string => text.replaceAll(' ', ' ').replaceAll(/\s+/g, ' ').trim();

const readActiveEditorDocumentText = async (page: Page): Promise<string> => {
  const viewLines = page.locator(EDITOR_WITH_URI).first().locator('.view-lines').first();
  await viewLines.waitFor({ state: 'visible', timeout: 10_000 });
  const raw = await viewLines.textContent();
  return raw ?? '';
};

/** Close suggest widget / snippet tab-stop UI so it is not merged into editor text reads. */
const dismissEditorOverlays = async (page: Page): Promise<void> => {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page
    .locator('.suggest-widget')
    .waitFor({ state: 'hidden', timeout: 3000 })
    .catch(() => {});
};

test('LWC snippets (Code Builder): Insert Snippet applies lwc-button in HTML', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run name: the container drives a single sequential workbench, so a fixed name would
  // collide with a bundle another spec (or an earlier run) already created.
  const bundleName = `snippetsHtml${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    // Wait until no extension shows "Activating" so file search / indexing is ready.
    await waitForExtensionsActivated(page);
    // Disable deploy-on-save so saving files does not emit org-less deploy console errors.
    await disableDeployOnSaveWeb(page);
    await saveScreenshot(page, 'lwc-snippets-html.container.workspace-ready.png');
  });

  await test.step('seed LWC bundle via SFDX: Create LWC', async () => {
    await createLwcViaSfdxCommand(page, bundleName);
    await saveScreenshot(page, 'lwc-snippets-html.container.after-create-lwc.png');
  });

  await test.step('open component HTML', async () => {
    await openLwcBundleFile(page, bundleName, 'html');
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'lwc-snippets-html.container.editor-open.png');
  });

  await test.step('insert lwc-button snippet', async () => {
    // Snippets are scoped to the active editor language; ensure HTML editor has focus (focus can drift after palette use).
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();
    await insertSnippet(page);
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    await quickInput.locator('input.input').first().fill('lwc-button');
    await waitForQuickInputFirstOption(page, { optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter');
    await quickInput.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
    await dismissEditorOverlays(page);
    await saveScreenshot(page, 'lwc-snippets-html.container.after-insert.png');
  });

  await test.step('save and assert HTML snippet body', async () => {
    await dismissEditorOverlays(page);
    await saveFile(page);
    const doc = collapseEditorWhitespace(await readActiveEditorDocumentText(page));
    expect(doc).toContain('<lightning-button');
    expect(doc).toContain('variant="base"');
    expect(doc).toContain('label="Button Label"');
    expect(doc).toContain('onclick={handleClick}');
    expect(doc).toContain('></lightning-button>');
    await saveScreenshot(page, 'lwc-snippets-html.container.saved.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('LWC snippets (Code Builder): JS completion inserts lwc-event body', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run name (see HTML test above).
  const bundleName = `snippetsJs${Date.now()}`;

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForExtensionsActivated(page);
    // Disable deploy-on-save so saving files does not emit org-less deploy console errors.
    await disableDeployOnSaveWeb(page);
    await saveScreenshot(page, 'lwc-snippets-js.container.workspace-ready.png');
  });

  await test.step('seed LWC bundle via SFDX: Create LWC', async () => {
    await createLwcViaSfdxCommand(page, bundleName);
    await saveScreenshot(page, 'lwc-snippets-js.container.after-create-lwc.png');
  });

  await test.step('open component JS', async () => {
    await openLwcBundleFile(page, bundleName, 'js');
    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 20_000 });
    await saveScreenshot(page, 'lwc-snippets-js.container.after-open.png');
  });

  await test.step('type lwc prefix and accept lwc-event completion', async () => {
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();
    await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type('lwc', { delay: typingSpeed });
    const completionRow = page
      .locator('div.monaco-list-row.show-file-icons')
      .filter({ hasText: /lwc-event/i })
      .first();
    await expect(completionRow).toBeVisible({ timeout: 30_000 });
    await completionRow.click();
    await dismissEditorOverlays(page);
    await saveScreenshot(page, 'lwc-snippets-js.container.after-completion.png');
  });

  await test.step('save and assert JS snippet body', async () => {
    await dismissEditorOverlays(page);
    await saveFile(page);
    const doc = collapseEditorWhitespace(await readActiveEditorDocumentText(page));
    expect(doc).toContain('this.dispatchEvent(new CustomEvent("event-name"));');
    await saveScreenshot(page, 'lwc-snippets-js.container.saved.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
