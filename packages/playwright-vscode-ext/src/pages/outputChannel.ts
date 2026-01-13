/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { saveScreenshot } from '../shared/screenshotUtils';
import { isMacDesktop } from '../utils/helpers';
import { EDITOR, CONTEXT_MENU, EDITOR_WITH_URI, TAB, WORKBENCH, QUICK_INPUT_WIDGET, QUICK_INPUT_LIST_ROW } from '../utils/locators';
import { openCommandPalette } from './commands';

const OUTPUT_PANEL_ID = '[id="workbench.panel.output"]';
const outputPanel = (page: Page) => page.locator(OUTPUT_PANEL_ID);
const outputPanelViewLines = (page: Page) => outputPanel(page).locator(`${EDITOR} .view-line`);
const outputPanelCodeArea = (page: Page) => outputPanel(page).locator(`${EDITOR} .view-lines`);
const filterInput = (page: Page) => page.getByPlaceholder(/Filter/i);

/** Get combined text from visible view lines, normalized */
const getVisibleOutputText = async (page: Page): Promise<string> =>
  // Normalize non-breaking spaces (char 160) to regular spaces (char 32)
  (await outputPanelViewLines(page).allTextContents()).join(' ').replaceAll('\u00A0', ' ');

/** Use filter to search and check for text, clearing filter afterward */
const withOutputFilter = async <T>(page: Page, searchText: string, fn: () => Promise<T>): Promise<T> => {
  const input = filterInput(page);
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.focus();
  // Clear existing value by selecting all and deleting
  await page.keyboard.press('Control+KeyA');
  await page.keyboard.press('Backspace');
  // Fill the search text - more reliable than type() on desktop
  await input.fill(searchText);
  await expect(input).toHaveValue(searchText, { timeout: 5000 });
  try {
    return await fn();
  } finally {
    // Clear filter - ensure input is focused, then clear using fill
    await input.focus();
    await input.fill('');
    await expect(input).toHaveValue('', { timeout: 5000 });
  }
};

/** Opens the Output panel (idempotent - safe to call if already open) */
export const ensureOutputPanelOpen = async (page: Page): Promise<void> => {
  const panel = outputPanel(page);
  const isVisible = await panel.isVisible();

  if (!isVisible) {
    // Close welcome tabs first - they can interfere with keyboard shortcuts
    const { closeWelcomeTabs } = await import('../utils/helpers.js');
    await closeWelcomeTabs(page);
    
    // Close any notification dialogs that might block keyboard shortcuts
    const notificationDialog = page.locator('[role="dialog"]').filter({ hasText: /notification/i });
    if (await notificationDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await notificationDialog.waitFor({ state: 'hidden', timeout: 2000 });
    }
    
    // Ensure workbench is focused before using keyboard shortcut
    const workbench = page.locator(WORKBENCH);
    await workbench.click({ timeout: 5000 });
    await expect(workbench).toBeVisible({ timeout: 5000 });
    
    // On desktop, also click the editor area to ensure focus
    const isDesktop = process.env.VSCODE_DESKTOP === '1';
    if (isDesktop) {
      const editorArea = page.locator(`.editor-container, ${EDITOR}, [id="workbench.parts.editor"]`);
      await editorArea.first().click({ timeout: 2000, force: true });
      await expect(workbench).toBeVisible({ timeout: 1000 });
    }
    
    // Use keyboard shortcut - Command+Shift+U on macOS, Control+Shift+U elsewhere
    await (isMacDesktop() ? page.keyboard.press('Meta+Shift+u') : page.keyboard.press('Control+Shift+u'));
    
    // Wait for panel to become visible, with fallback to command palette if needed
    const panelVisible = await panel.isVisible({ timeout: 5000 }).catch(() => false);
    if (!panelVisible) {
      await openCommandPalette(page);
      const widget = page.locator(QUICK_INPUT_WIDGET);
      const input = widget.locator('input.input');
      await input.waitFor({ state: 'attached', timeout: 5000 });
      await expect(input).toBeVisible({ timeout: 5000 });
      await input.fill('>Output: Focus on Output View');
      await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 5000 });
      await page.keyboard.press('Enter');
    }
    
    await expect(panel).toBeVisible({ timeout: 10_000 });
  }
};

/** Selects a specific output channel from the dropdown */
export const selectOutputChannel = async (page: Page, channelName: string, timeout = 30_000): Promise<void> => {
  // VS Code uses a monaco-select-box with custom UI in the output panel toolbar
  // The actual <select> is hidden but we can still interact with it programmatically
  const panel = outputPanel(page);
  await panel.waitFor({ state: 'visible', timeout: 5000 });

  // Re-query the dropdown each time to avoid stale element issues
  // The dropdown is a hidden select element with class monaco-select-box
  // We don't wait for it to be visible since it's intentionally hidden with a custom overlay
  await expect(async () => {
    const dropdown = panel.locator('select.monaco-select-box');
    await dropdown.waitFor({ state: 'attached', timeout: 5000 });
    // Check current value - if already selected, no need to change
    const currentValue = await dropdown.inputValue();
    if (currentValue === channelName) {
      return;
    }
    // Select the channel using the select element (force: true since it's hidden with custom overlay)
    await dropdown.selectOption({ label: channelName }, { force: true });
    // Verify the selection took effect - wait a bit longer for the UI to update
    await expect(dropdown).toHaveValue(channelName, { timeout: 5000 });
  }).toPass({ timeout });
};

/** Checks if the output channel contains specific text using the filter input */
export const outputChannelContains = async (page: Page, searchText: string): Promise<boolean> =>
  withOutputFilter(page, searchText, async () => {
    const combinedText = await getVisibleOutputText(page);
    const found = combinedText.includes(searchText);
    const safeName = searchText.replaceAll(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `test-results/filter-${safeName}.png` });
    return found;
  });

/**
 * Clears the output channel by clicking the clear button in the output panel toolbar.
 * Use this to make sure that your assertions are not picking up text from the previous test unless you mean to
 */
export const clearOutputChannel = async (page: Page): Promise<void> => {
  const clearButton = page.getByRole('button', { name: 'Clear Output' }).first();
  await clearButton.click();

  // Wait for the clear action to take effect - output should be completely empty
  const codeArea = outputPanelCodeArea(page);
  await expect(async () => {
    const text = await codeArea.textContent();
    // Output channel should be completely cleared - no text should remain
    expect(text?.trim().length ?? 0, 'Output channel should be completely cleared').toBe(0);
  }).toPass({ timeout: 2000 });
};

/** Wait for output channel to contain specific text using filter */
export const waitForOutputChannelText = async (
  page: Page,
  opts: { expectedText: string; timeout?: number }
): Promise<void> => {
  const { expectedText, timeout = 30_000 } = opts;

  const codeArea = outputPanelCodeArea(page);
  await expect(async () => {
    const text = await codeArea.textContent();
    expect(text?.trim().length ?? 0).toBeGreaterThan(10);
  }).toPass({ timeout });

  await withOutputFilter(page, expectedText, async () => {
    await expect(async () => {
      const combinedText = await getVisibleOutputText(page);
      expect(combinedText.includes(expectedText), `Expected "${expectedText}" in output`).toBe(true);
    }).toPass({ timeout });
  });
};

/**
 * Opens output channel for a named extension, opens it in editor, and takes a screenshot.
 * Useful for debugging when errors occur.
 * Note: Context menus don't work on Mac+Desktop+Electron, so this will skip on that platform.
 * In web VS Code, if opening in editor fails, falls back to screenshotting the output panel directly.
 */
export const captureOutputChannelDetails = async (
  page: Page,
  channelName: string,
  screenshotName?: string
): Promise<void> => {
  const safeChannelName = channelName.replaceAll(/[^a-zA-Z0-9]/g, '_');
  const screenshotFileName = screenshotName ?? `output-channel-${safeChannelName}.png`;

  // Skip on Mac desktop - context menus don't work there
  if (isMacDesktop()) {
    console.log('Skipping "Open Output in Editor" on Mac Desktop (context menus not supported)');
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, channelName);
    await saveScreenshot(page, `test-results/${screenshotFileName}`, true);
    return;
  }

  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, channelName);

  // Try to open output in editor, but fall back to screenshotting the panel if it fails (e.g., in web VS Code)
  try {
    // Find the ellipsis button (three dots) in the output panel toolbar
    const outputPanelToolbar = outputPanel(page).locator('.monaco-toolbar');
    const moreActionsButton = outputPanelToolbar.getByRole('button', { name: /More Actions|\.\.\./i }).last();

    // Right-click to open context menu
    await moreActionsButton.waitFor({ state: 'visible', timeout: 5000 });
    await moreActionsButton.click({ button: 'right' });

    // Wait for context menu and click "Open Output in Editor"
    const contextMenu = page.locator(CONTEXT_MENU);
    await contextMenu.waitFor({ state: 'visible', timeout: 5000 });
    const openInEditorOption = contextMenu.getByRole('menuitem', { name: /Open Output in Editor/i });
    await openInEditorOption.click();

    // Wait for editor tab to appear (output channels open as editor tabs)
    const outputTab = page.locator(TAB).filter({ hasText: new RegExp(channelName, 'i') });
    await outputTab.waitFor({ state: 'visible', timeout: 10_000 });

    // Wait for editor content to be visible
    const editor = page.locator(EDITOR_WITH_URI).last();
    await editor.waitFor({ state: 'visible', timeout: 10_000 });

    await saveScreenshot(page, `test-results/${screenshotFileName}`, true);
  } catch (error) {
    // Fallback: if opening in editor fails (e.g., "More Actions" button not available in web),
    // just screenshot the output panel directly
    console.log(
      `Failed to open output in editor (${error instanceof Error ? error.message : String(error)}), falling back to output panel screenshot`
    );
    await saveScreenshot(page, `test-results/${screenshotFileName}`, true);
  }
};
