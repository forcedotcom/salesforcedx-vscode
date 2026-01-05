/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Page } from '@playwright/test';
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
  const input = page.locator(QUICK_INPUT_WIDGET).locator('input.input');
  await input.waitFor({ state: 'visible', timeout: 5000 });

  // Use keyboard.type() instead of pressSequentially() for Windows compatibility
  // pressSequentially() fails to type into VS Code command palette input on Windows
  await page.keyboard.type(command);

  // Wait for command row to appear after typing (instead of arbitrary timeout)
  const commandRow = page
    .locator(QUICK_INPUT_WIDGET)
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: command, hasNotText, visible: true })
    .first();
  await commandRow.waitFor({ state: 'visible', timeout: 5000 });

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

  // Ensure the row is visible and actionable before clicking
  await commandRow.scrollIntoViewIfNeeded();

  // Click the command row to execute - this works reliably on all platforms
  await commandRow.click();
};

export const executeCommandWithCommandPalette = async (
  page: Page,
  command: string,
  hasNotText?: string
): Promise<void> => {
  await openCommandPalette(page);
  await executeCommand(page, command, hasNotText);
};
