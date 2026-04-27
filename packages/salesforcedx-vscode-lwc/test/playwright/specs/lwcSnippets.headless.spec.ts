/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';

import {
  closeSettingsTab,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  openFileFromExplorerTree,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  typingSpeed,
  upsertSettings,
  validateNoCriticalErrors,
  waitForExtensionsActivated,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady,
  isDesktop
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';
import { createLwcViaSfdxCommand } from '../utils/lwcUtils';

/** Web: no scratch auth in this spec — disable deploy-on-save so `File: Save` does not log deploy errors (empty instanceUrl). */
const disableDeployOnSaveWeb = async (page: Page): Promise<void> => {
  if (isDesktop()) {
    return;
  }
  await upsertSettings(page, { 'salesforcedx-vscode-core.push-or-deploy-on-save.enabled': 'false' });
  await closeSettingsTab(page);
};

/**
 * Desktop: Quick Open works against the real filesystem; the desktop fixture seeds `snippetsE2E`.
 * Web: `@vscode/test-web`'s file system provider does not implement `provideFileSearch`, so
 * Quick Open returns "No matching results" for files that have not been opened. Navigate the
 * Files Explorer tree instead.
 */
const openLwcBundleFile = async (page: Page, bundleName: string, ext: 'html' | 'js'): Promise<void> => {
  const fileName = ext === 'html' ? `${bundleName}.html` : `${bundleName}.js`;
  if (isDesktop()) {
    await openFileByName(page, fileName);
    return;
  }
  await openFileFromExplorerTree(page, fileName, ['force-app', 'main', 'default', 'lwc', bundleName]);
};

/** Monaco may use NBSP; snippets can be one line or multiline — collapse for assertions. */
const collapseEditorWhitespace = (text: string): string =>
  text.replaceAll('\u00a0', ' ').replaceAll(/\s+/g, ' ').trim();

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

test('LWC snippets: Insert Snippet applies lwc-button in HTML', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const bundleName = isDesktop() ? 'snippetsE2E' : `snippetsHtml${testInfo.workerIndex}${Date.now()}`;

  await test.step('wait for Salesforce project workspace', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    // salesforcedx-vscode-services creates a memfs:/MyProject workspace folder during activation.
    // Wait until no extension shows "Activating" so file search / indexing is ready before Quick Open runs.
    await waitForExtensionsActivated(page);
    // Disable deploy-on-save AFTER the workspace folder is added so the setting persists to the correct workspace context.
    await disableDeployOnSaveWeb(page);
    await saveScreenshot(page, 'lwc-snippets-html.workspace-ready.png');
  });

  await test.step('ensure LWC bundle exists (web: create via palette)', async () => {
    if (!isDesktop()) {
      await createLwcViaSfdxCommand(page, bundleName);
      await saveScreenshot(page, 'lwc-snippets-html.after-create-lwc.png');
    }
  });

  await test.step('open component HTML', async () => {
    await openLwcBundleFile(page, bundleName, 'html');
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'lwc-snippets-html.editor-open.png');
  });

  await test.step('insert lwc-button snippet', async () => {
    // Snippets are scoped to the active editor language; ensure HTML editor has focus (web CI can leave focus elsewhere after palette use).
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();
    await executeCommandWithCommandPalette(page, 'Snippets: Insert Snippet');
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    await quickInput.locator('input.input').first().fill('lwc-button');
    await waitForQuickInputFirstOption(page, { optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter');
    await quickInput.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
    await dismissEditorOverlays(page);
    await saveScreenshot(page, 'lwc-snippets-html.after-insert.png');
  });

  await test.step('save and assert HTML snippet body', async () => {
    await dismissEditorOverlays(page);
    await executeCommandWithCommandPalette(page, 'File: Save');
    const doc = collapseEditorWhitespace(await readActiveEditorDocumentText(page));
    expect(doc).toContain('<lightning-button');
    expect(doc).toContain('variant="base"');
    expect(doc).toContain('label="Button Label"');
    expect(doc).toContain('onclick={handleClick}');
    expect(doc).toContain('></lightning-button>');
    await saveScreenshot(page, 'lwc-snippets-html.saved.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('LWC snippets: JS completion inserts lwc-event body', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const bundleName = isDesktop() ? 'snippetsE2E' : `snippetsJs${testInfo.workerIndex}${Date.now()}`;

  await test.step('wait for Salesforce project workspace', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await waitForExtensionsActivated(page);
    // Disable deploy-on-save AFTER the workspace folder is added so the setting persists to the correct workspace context.
    await disableDeployOnSaveWeb(page);
    await saveScreenshot(page, 'lwc-snippets-js.workspace-ready.png');
  });

  await test.step('ensure LWC bundle exists (web: create via palette)', async () => {
    if (!isDesktop()) {
      await createLwcViaSfdxCommand(page, bundleName);
      await saveScreenshot(page, 'lwc-snippets-js.after-create-lwc.png');
    }
  });

  await test.step('open component JS', async () => {
    await openLwcBundleFile(page, bundleName, 'js');
    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 20_000 });
    await saveScreenshot(page, 'lwc-snippets-js.after-open.png');
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
    await saveScreenshot(page, 'lwc-snippets-js.after-completion.png');
  });

  await test.step('save and assert JS snippet body', async () => {
    await dismissEditorOverlays(page);
    await executeCommandWithCommandPalette(page, 'File: Save');
    const doc = collapseEditorWhitespace(await readActiveEditorDocumentText(page));
    expect(doc).toContain('this.dispatchEvent(new CustomEvent("event-name"));');
    await saveScreenshot(page, 'lwc-snippets-js.saved.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
