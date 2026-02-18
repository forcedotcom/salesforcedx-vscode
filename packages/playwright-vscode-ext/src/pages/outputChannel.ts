/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { saveScreenshot } from '../shared/screenshotUtils';
import { isMacDesktop } from '../utils/helpers';
import {
  EDITOR,
  CONTEXT_MENU,
  EDITOR_WITH_URI,
  TAB,
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW
} from '../utils/locators';
import { openCommandPalette } from './commands';

const OUTPUT_PANEL_ID = '[id="workbench.panel.output"]';
const outputPanel = (page: Page) => page.locator(OUTPUT_PANEL_ID);
const outputPanelCodeArea = (page: Page) => outputPanel(page).locator(`${EDITOR} .view-lines`);
const filterInput = (page: Page) => page.getByPlaceholder(/^Filter/i).first();

/** Get visible text from output panel (virtualized DOM), normalized */
const getVisibleOutputText = async (page: Page): Promise<string> => {
  const codeArea = outputPanelCodeArea(page);
  const text = await codeArea.textContent();
  return (text ?? '').replaceAll('\u00A0', ' ');
};

/** Wait for output channel to have content */
const waitForOutputContent = async (page: Page, timeout: number): Promise<boolean> => {
  const codeArea = outputPanelCodeArea(page);
  try {
    await expect(async () => {
      const text = await codeArea.textContent();
      expect(text?.trim().length ?? 0).toBeGreaterThan(1);
    }).toPass({ timeout });
    return true;
  } catch {
    return false;
  }
};


/** wait for output channel to contain text. Throws if not found. Assumes output has content. */
const waitForOutputChannelTextCommon = async (page: Page, expectedText: string, timeout: number): Promise<void> => {
  const input = filterInput(page);
  await expect(input, 'Output filter should be visible').toBeVisible({ timeout: Math.min(timeout, 15_000) });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDesktop = await page.evaluate(() => !!(window as any).vscode?.webFrame);

  /**
   * Desktop: use webFrame.insertText (native Electron input pipeline).
   * Click the input (sets Chromium-level focus), select all, then insertText to replace.
   * Web: use fill() (no webFrame available).
   */
  const setFilterText = async (text: string) => {
    // Dismiss notification toasts that might overlay the filter
    const toasts = page.locator('.notifications-toasts .codicon-notifications-clear-all');
    if (await toasts.isVisible().catch(() => false)) {
      await toasts.click({ force: true });
      await page.waitForTimeout(200);
    }
    // Click WITHOUT force to get proper Chromium-level focus
    await input.click({ timeout: 3000 }).catch(async () => {
      // If click fails (overlay), try with force
      await input.click({ force: true });
    });
    await page.waitForTimeout(100);
    if (isDesktop) {
      // Select all text in the input and replace with new text via native path
      await input.evaluate((el: HTMLInputElement) => { el.select(); });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate((t: string) => { (window as any).vscode.webFrame.insertText(t); }, text || '\u0008');
    } else {
      await input.fill(text);
    }
  };

  try {
    await expect(async () => {
      await setFilterText(expectedText);
      await page.waitForTimeout(500);
      const combinedText = await getVisibleOutputText(page);
      expect(combinedText.includes(expectedText), `Expected "${expectedText}" in output`).toBe(true);
    }).toPass({ timeout });
  } finally {
    await input.click({ force: true }).catch(() => {});
    await input.fill('').catch(() => {});
  }
};

/** Opens the Output panel (idempotent - safe to call if already open) */
export const ensureOutputPanelOpen = async (page: Page): Promise<void> => {
  const panel = outputPanel(page);

  if (await panel.isVisible()) {
    return;
  }

  // Use F1 command palette - most reliable across all platforms per coding rules
  await openCommandPalette(page);
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const input = widget.locator('input.input');
  await input.waitFor({ state: 'attached', timeout: 5000 });
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill('>Output: Focus on Output View');
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 5000 });
  await page.keyboard.press('Enter');

  await expect(panel).toBeVisible({ timeout: 10_000 });
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
    // Get all options to find the one matching the channel name
    const options = dropdown.locator('option');
    const optionCount = await options.count();
    let targetValue: string | undefined;
    for (let i = 0; i < optionCount; i++) {
      const option = options.nth(i);
      const text = await option.textContent();
      const value = await option.getAttribute('value');
      if (text?.trim() === channelName || value === channelName) {
        targetValue = value ?? text?.trim();
        break;
      }
    }
    if (!targetValue) {
      throw new Error(`Channel "${channelName}" not found in dropdown options`);
    }
    // Wait for the option to be enabled before selecting (fixes macOS GHA timing issues)
    const targetOption = dropdown.locator(`option[value="${targetValue}"]`);
    await expect(targetOption).not.toHaveAttribute('disabled', '', { timeout: 5000 });
    // Select the channel using the value attribute (more reliable than label)
    await dropdown.selectOption({ value: targetValue }, { force: true });
    // Verify the selection took effect - wait a bit longer for the UI to update
    await expect(dropdown).toHaveValue(targetValue, { timeout: 5000 });
  }).toPass({ timeout });
};

/** Checks if the output channel contains specific text */
export const outputChannelContains = async (
  page: Page,
  searchText: string,
  opts?: { timeout?: number }
): Promise<boolean> => {
  const { timeout = 10_000 } = opts ?? {};

  if (!(await waitForOutputContent(page, timeout))) return false;

  const safeName = searchText.replaceAll(/[^a-zA-Z0-9]/g, '_');
  try {
    await waitForOutputChannelTextCommon(page, searchText, timeout);
    await page.screenshot({ path: `test-results/filter-${safeName}.png` });
    return true;
  } catch {
    await page.screenshot({ path: `test-results/filter-${safeName}.png` });
    return false;
  }
};

/**
 * Clears the output channel by clicking the clear button in the output panel toolbar.
 * Use this to make sure that your assertions are not picking up text from the previous test unless you mean to
 */
export const clearOutputChannel = async (page: Page): Promise<void> => {
  const clearButton = page.getByRole('button', { name: 'Clear Output' }).first();
  // force: true - notification toasts overlay the output panel and intercept pointer events
  await clearButton.click({ force: true });

  // Wait for the clear action to take effect - output should be completely empty
  const codeArea = outputPanelCodeArea(page);
  await expect(async () => {
    const text = await codeArea.textContent();
    // Output channel should be completely cleared - no text should remain
    expect(text?.trim().length ?? 0, 'Output channel should be completely cleared').toBe(0);
  }).toPass({ timeout: 2000 });
};

/** Wait for output channel to contain specific text. Repeats [clear filter, re-filter, check] until found or timeout to handle streaming content and virtualized DOM. */
export const waitForOutputChannelText = async (
  page: Page,
  opts: { expectedText: string; timeout?: number }
): Promise<void> => {
  const { expectedText, timeout = 30_000 } = opts;

  if (!(await waitForOutputContent(page, timeout))) {
    throw new Error(`Output channel did not have content within ${timeout}ms`);
  }

  await waitForOutputChannelTextCommon(page, expectedText, timeout);
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
