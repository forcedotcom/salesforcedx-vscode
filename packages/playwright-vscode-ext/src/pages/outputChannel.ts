/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { saveScreenshot } from '../shared/screenshotUtils';
import { isDesktop, isMacDesktop } from '../utils/helpers';
import { EDITOR, CONTEXT_MENU, EDITOR_WITH_URI, TAB, QUICK_INPUT_LIST_ROW } from '../utils/locators';
import { activeQuickInputTextField, activeQuickInputWidget } from '../utils/quickInput';
import { executeCommandWithCommandPalette, openCommandPalette } from './commands';

const OUTPUT_PANEL_ID = '[id="workbench.panel.output"]';
const outputPanel = (page: Page) => page.locator(OUTPUT_PANEL_ID);
const outputPanelCodeArea = (page: Page) => outputPanel(page).locator(`${EDITOR} .view-lines`);
// Filter input lives in "Output actions" toolbar, a sibling of [id="workbench.panel.output"] -- not inside it
const filterInput = (page: Page) => page.getByRole('textbox', { name: /Filter \(e\.g\./ }).first();

const ensureOutputFilterReady = async (page: Page, timeout: number) => {
  const input = filterInput(page);
  await expect(input, 'Output filter should be visible and usable').toBeVisible({ timeout });
  return input;
};

/** Get all text content from the currently-visible Monaco lines, normalized */
const getAllOutputText = async (page: Page): Promise<string> => {
  const codeArea = outputPanelCodeArea(page);
  const text = await codeArea.textContent();
  // Normalize non-breaking spaces (char 160) to regular spaces (char 32)
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

/**
 * Maximize the output panel so more lines are visible (idempotent — skips if already maximized).
 * More visible lines means fewer page-navigation steps needed when sweeping for text.
 */
const maximizeOutputPanel = async (page: Page): Promise<void> => {
  const maximizeButton = page.getByRole('button', { name: 'Maximize Panel' });
  try {
    // Wait for button to be visible and stable (handles race conditions)
    await maximizeButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // Button not visible means panel is already maximized
    });
    // Ensure element is attached and stable before clicking
    const isAttached = await maximizeButton.isVisible().catch(() => false);
    if (isAttached) {
      await maximizeButton.click({ timeout: 5000 });
      // Allow layout to settle after resize
      await page.waitForTimeout(200);
    }
  } catch {
    // Ignore errors - panel may already be maximized or button detached during transition
    // This is an idempotent operation, so failure is acceptable
  }
};

/** Restore panel to normal height (idempotent — skips if already restored). */
const restoreOutputPanel = async (page: Page): Promise<void> => {
  const restoreButton = page.getByRole('button', { name: 'Restore Panel' });
  try {
    // Wait for button to be visible and stable (handles race conditions)
    await restoreButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // Button not visible means panel is already restored
    });
    // Ensure element is attached and stable before clicking
    const isAttached = await restoreButton.isVisible().catch(() => false);
    if (isAttached) {
      await restoreButton.click({ timeout: 5000 });
      await page.waitForTimeout(200);
    }
  } catch {
    // Ignore errors - panel may already be restored or button detached during transition
    // This is an idempotent operation, so failure is acceptable
  }
};

/**
 * Desktop workaround: filter does not reliably work on Electron for streamed content.
 * Fast path: check visible content immediately (works when channel is clear and output is short).
 * Bounded sweep top→bottom then bottom→top; exit as soon as text is found.
 * Panel should be maximized before calling this so more lines are visible per step.
 */
const waitForOutputChannelTextDesktopWorkaround = async (
  page: Page,
  expectedText: string,
  timeout: number
): Promise<void> => {
  const codeArea = outputPanelCodeArea(page);
  // force: true — Output actions toolbar overlays the code area and intercepts pointer events
  await codeArea.click({ force: true });

  // Fewer steps needed when panel is maximized; 30 each direction covers very long output
  const PAGE_STEPS = 30;

  await expect(async () => {
    // Fast path: text may already be in the visible viewport
    if ((await getAllOutputText(page)).includes(expectedText)) return;

    // Sweep top → bottom
    await page.keyboard.press('Control+Home');
    for (let i = 0; i < PAGE_STEPS; i++) {
      if ((await getAllOutputText(page)).includes(expectedText)) return;
      await page.keyboard.press('PageDown');
    }

    // Sweep bottom → top
    await page.keyboard.press('Control+End');
    for (let i = 0; i < PAGE_STEPS; i++) {
      if ((await getAllOutputText(page)).includes(expectedText)) return;
      await page.keyboard.press('PageUp');
    }

    // Diagnostic: include a sample of what was visible at the end of the sweep
    const sample = (await getAllOutputText(page)).slice(-400).trim().replaceAll('\n', ' ↵ ');
    throw new Error(`Expected "${expectedText}" in output. Last visible content: ${sample || '(empty)'}`);
  }).toPass({ timeout });
};

/** wait for output channel to contain text. Throws if not found. Assumes output has content. */
const waitForOutputChannelTextCommon = async (page: Page, expectedText: string, timeout: number): Promise<void> => {
  if (isDesktop()) {
    await waitForOutputChannelTextDesktopWorkaround(page, expectedText, timeout);
    return;
  }
  // Web: use filter input (works reliably on web)
  const input = await ensureOutputFilterReady(page, Math.min(timeout, 15_000));
  try {
    await expect(async () => {
      await input.focus();
      await input.fill('');
      await input.press('Enter');
      await input.fill(expectedText);
      await expect(input).toHaveValue(expectedText, { timeout: 5000 });
      await input.press('Enter');
      const combinedText = await getAllOutputText(page);
      const sample = combinedText.slice(-400).trim().replaceAll('\n', ' ↵ ');
      expect(
        combinedText.includes(expectedText),
        `Expected "${expectedText}" in output. Last visible content: ${sample || '(empty)'}`
      ).toBe(true);
    }).toPass({ timeout });
  } finally {
    await input.focus().catch(() => {});
    await input.fill('').catch(() => {});
    await input.press('Enter').catch(() => {});
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
  const widget = activeQuickInputWidget(page);
  const input = activeQuickInputTextField(page);
  await input.waitFor({ state: 'attached', timeout: 5000 });
  await input.click({ force: true, timeout: 5000 });
  await input.fill('>Output: Focus on Output View', { force: true });
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

  const shouldRestorePanel = isDesktop();
  if (shouldRestorePanel) await maximizeOutputPanel(page);

  const safeName = searchText.replaceAll(/[^a-zA-Z0-9]/g, '_');
  try {
    await waitForOutputChannelTextCommon(page, searchText, timeout);
    await page.screenshot({ path: `test-results/filter-${safeName}.png` });
    return true;
  } catch {
    await page.screenshot({ path: `test-results/filter-${safeName}.png` });
    return false;
  } finally {
    if (shouldRestorePanel) await restoreOutputPanel(page);
  }
};

/**
 * Clears the output channel via the command palette ("View: Clear Output").
 * Using the command palette avoids the notification toasts that can cover the toolbar button.
 * Use this to make sure that your assertions are not picking up text from the previous test unless you mean to
 */
export const clearOutputChannel = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'View: Clear Output');

  // Wait for the clear action to take effect - output should be completely empty
  const codeArea = outputPanelCodeArea(page);
  await expect(async () => {
    const text = await codeArea.textContent();
    // Output channel should be completely cleared - no text should remain
    expect(text?.trim().length ?? 0, 'Output channel should be completely cleared').toBe(0);
  }).toPass({ timeout: 2000 });
};

/** Wait for output channel to contain specific text. Repeats [snapshot, sweep] until found or timeout to handle streaming content and virtualized DOM. */
export const waitForOutputChannelText = async (
  page: Page,
  opts: { expectedText: string; timeout?: number }
): Promise<void> => {
  const { expectedText, timeout = 30_000 } = opts;

  if (!(await waitForOutputContent(page, timeout))) {
    throw new Error(`Output channel did not have content within ${timeout}ms`);
  }

  // Desktop only: maximize for scroll sweep — more visible lines → fewer steps
  const shouldRestorePanel = isDesktop();
  if (shouldRestorePanel) await maximizeOutputPanel(page);
  try {
    await waitForOutputChannelTextCommon(page, expectedText, timeout);
  } finally {
    if (shouldRestorePanel) await restoreOutputPanel(page);
  }
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
