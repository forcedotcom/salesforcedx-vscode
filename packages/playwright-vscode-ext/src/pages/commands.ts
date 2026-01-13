/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, Page } from '@playwright/test';
import { isWindowsDesktop } from '../utils/helpers';
import { QUICK_INPUT_WIDGET, QUICK_INPUT_LIST_ROW } from '../utils/locators';

const openCommandPalette = async (page: Page): Promise<void> => {
  // Ensure workbench is focused before opening command palette
  const { WORKBENCH } = await import('../utils/locators.js');
  await page.locator(WORKBENCH).click();
  
  // Try F1 first (standard command palette shortcut)
  await page.keyboard.press('F1');
  const widget = page.locator(QUICK_INPUT_WIDGET);
  if (isWindowsDesktop()) {
    // On Windows desktop, F1 may not work reliably, so try Ctrl+Shift+P fallback
    try {
      await expect(widget).toBeVisible({ timeout: 10_000 });
    } catch {
      await page.keyboard.press('Control+Shift+p');
      await expect(widget).toBeVisible({ timeout: 10_000 });
    }
  } else {
    // Web and macOS desktop: F1 should work, but may take longer in CI
    await expect(widget).toBeVisible({ timeout: 10_000 });
  }
};

const executeCommand = async (page: Page, command: string, hasNotText?: string): Promise<void> => {
  // VS Code command palette automatically adds '>' prefix when opened with F1/Ctrl+Shift+P
  // Get the input locator - use locator-specific action for better reliability on desktop
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const input = widget.locator('input.input');
  // Widget should already be visible from openCommandPalette, but verify it's still visible
  // In CI, widget may become hidden if welcome tabs interfere, so wait with longer timeout
  await expect(widget).toBeVisible({ timeout: 10_000 });
  await input.waitFor({ state: 'attached', timeout: 10_000 });
  // Wait for input to be visible - it may be attached but hidden initially
  await expect(input).toBeVisible({ timeout: 10_000 });
  // Focus the input to ensure it's ready for typing
  await input.focus({ timeout: 5000 });
  // Wait for input to be focused and ready - ensure it has the '>' prefix that VS Code adds automatically
  await expect(input).toHaveValue(/^>/, { timeout: 5000 });
  // Type the command - use fill() for reliability on desktop
  // VS Code adds '>' prefix automatically, so we fill with '>' + command
  await input.fill(`>${command}`);

  // Wait for input value to contain what we typed - VS Code adds '>' prefix automatically
  // This ensures typing has completed before we look for commands
  // eslint-disable-next-line unicorn/prefer-string-replace-all -- replaceAll doesn't support regex patterns
  const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(input).toHaveValue(new RegExp(`>.*${escapedCommand}`, 'i'), { timeout: 10_000 });

  // Wait for the command list to populate after typing - wait for at least one row to exist in DOM
  // For virtualized lists, rows may exist in DOM but not be visible until scrolled into view
  // We wait for attachment (exists in DOM) rather than visibility, then rely on Playwright's click() to handle scrolling
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 10_000 });

  // Wait for the filtered list to stabilize - VS Code filters commands as you type
  // Wait for at least one row that matches our command text to appear in the filtered results
  // This ensures VS Code has finished filtering before we look for the specific command
  const listRows = widget.locator(QUICK_INPUT_LIST_ROW);
  await expect(async () => {
    const count = await listRows.count();
    expect(count, 'Command list should have at least one row').toBeGreaterThan(0);
    // Check if any row contains our command text (case-insensitive partial match)
    const commandLower = command.toLowerCase();
    const availableCommands: string[] = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
      const rowText = await listRows.nth(i).textContent();
      if (rowText) {
        const text = rowText.trim();
        availableCommands.push(text);
        if (text.toLowerCase().includes(commandLower)) {
          return;
        }
      }
    }
    throw new Error(
      `Command "${command}" not found in filtered list. Available commands (first ${availableCommands.length}): ${availableCommands.join(' | ')}`
    );
  }).toPass({ timeout: 10_000 });

  // Use text content matching to find exact command (bypasses MRU prioritization)
  // Scope to QUICK_INPUT_WIDGET first, then find the list row (more specific than just .monaco-list-row)
  const commandRow = widget
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: command, hasNotText })
    .first();

  // Wait for the command row to be attached (exists in DOM)
  // For virtualized lists, the element may exist but not be visible until scrolled into view
  // In CI, commands may take longer to appear, so use a longer timeout
  await expect(commandRow).toBeAttached({ timeout: 10_000 });
  
  // For virtualized DOM, click directly via evaluate to bypass Playwright's visibility checks
  // This is more reliable than using click() with force: true, which still checks visibility
  await commandRow.evaluate((el) => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    (el as HTMLElement).click();
  });

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
