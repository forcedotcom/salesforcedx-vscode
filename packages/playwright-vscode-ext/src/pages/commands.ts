/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, Page } from '@playwright/test';
import { saveScreenshot } from '../shared/screenshotUtils';
import { isWindowsDesktop } from '../utils/helpers';
import { QUICK_INPUT_WIDGET, QUICK_INPUT_LIST_ROW } from '../utils/locators';

const openCommandPalette = async (page: Page): Promise<void> => {
  // Try F1 first (standard command palette shortcut)
  await page.keyboard.press('F1');
  if (isWindowsDesktop()) {
    // On Windows desktop, F1 may not work reliably, so try Ctrl+Shift+P fallback
    try {
      await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      await page.keyboard.press('Control+Shift+p');
      await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 3000 });
    }
  } else {
    // Web and macOS desktop: F1 should work
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 3000 });
  }
};

const executeCommand = async (page: Page, command: string, hasNotText?: string): Promise<void> => {
  // VS Code command palette automatically adds '>' prefix when opened with F1/Ctrl+Shift+P
  // Get the input locator - use locator-specific action for better reliability on desktop
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const input = widget.locator('input.input');
  // Wait for widget to be visible first, then wait for input to be attached and visible
  await widget.waitFor({ state: 'visible', timeout: 5000 });
  await input.waitFor({ state: 'attached', timeout: 5000 });
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.pressSequentially(command, { delay: 5 });

  // Wait for the command list to populate after typing - wait for at least one row to appear and be visible
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeVisible({ timeout: 5000 });

  // Capture HTML snapshot before clicking to debug Windows issues
  if (isWindowsDesktop()) {
    const quickInputWidget = page.locator(QUICK_INPUT_WIDGET);
    const htmlContent = await quickInputWidget.innerHTML();
    const snapshotPath = `test-results/command-palette-before-click-${Date.now()}.html`;
    const fs = await import('node:fs');
    const path = await import('node:path');
    const testResultsDir = path.join(process.cwd(), 'test-results');
    fs.mkdirSync(testResultsDir, { recursive: true });
    fs.writeFileSync(path.join(testResultsDir, path.basename(snapshotPath)), htmlContent);
    await saveScreenshot(page, `command-palette-before-click-${Date.now()}.png`, false);
  }

  // Use text content matching to find exact command (bypasses MRU prioritization)
  // Scope to QUICK_INPUT_WIDGET first, then find the list row (more specific than just .monaco-list-row)
  const commandRow = widget
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: command, hasNotText })
    .first();

  // Wait for the command row to be attached first (exists in DOM)
  await expect(commandRow).toBeAttached({ timeout: 5000 });
  
  // Wait for at least one list row to be visible to ensure the list has rendered
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeVisible({ timeout: 5000 });
  
  // Click the command row - Playwright will automatically scroll into view and wait for visibility if needed
  // For virtualized lists, the element may exist but not be visible until scrolled into view
  // Playwright's click() handles this automatically, so we don't need to check visibility separately
  await commandRow.click({ timeout: 10_000 });

  // Wait for the command palette to close after executing the command
  await widget.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
    // If it doesn't close (e.g., multi-step commands), that's ok
  });
};

export const executeCommandWithCommandPalette = async (
  page: Page,
  command: string,
  hasNotText?: string
): Promise<void> => {
  await openCommandPalette(page);
  await executeCommand(page, command, hasNotText);
};
