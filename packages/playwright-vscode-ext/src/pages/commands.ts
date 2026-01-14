/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, Page } from '@playwright/test';
import { QUICK_INPUT_WIDGET, QUICK_INPUT_LIST_ROW } from '../utils/locators';

export const openCommandPalette = async (page: Page): Promise<void> => {
  const { WORKBENCH } = await import('../utils/locators.js');
  const { closeWelcomeTabs } = await import('../utils/helpers.js');
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const workbench = page.locator(WORKBENCH);
  
  // Close welcome tabs before opening command palette
  await closeWelcomeTabs(page);
  
  // Ensure workbench is focused
  await workbench.click({ timeout: 5000 }).catch(() => {});
  await expect(workbench).toBeVisible({ timeout: 5000 });
  
  // Close any existing quick input widget
  const existingWidget = page.locator(QUICK_INPUT_WIDGET);
  if (await existingWidget.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await existingWidget.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
  }
  
  // Open command palette with F1
  await page.keyboard.press('F1');
  
  // Wait for widget to be attached and visible
  await widget.waitFor({ state: 'attached', timeout: 10_000 });
  await expect(widget).toBeVisible({ timeout: 10_000 });
  
  // Wait for input to be ready
  const input = widget.locator('input.input');
  await input.waitFor({ state: 'attached', timeout: 10_000 });
  await expect(input).toBeVisible({ timeout: 10_000 });
};

const executeCommand = async (page: Page, command: string, hasNotText?: string): Promise<void> => {
  // VS Code command palette automatically adds '>' prefix when opened with F1/Ctrl+Shift+P
  // Get the input locator - use locator-specific action for better reliability on desktop
  const widget = page.locator(QUICK_INPUT_WIDGET);
  let input = widget.locator('input.input');
  
  // Ensure widget and input are ready - retry if welcome tabs interfere
  await expect(async () => {
    // Widget should already be visible from openCommandPalette, but verify it's still visible
    // In CI, widget may become hidden if welcome tabs interfere, so wait with longer timeout
    const widgetVisible = await widget.isVisible({ timeout: 3000 }).catch(() => false);
    if (!widgetVisible) {
      // Widget is hidden - close welcome tabs and reopen command palette
      const { closeWelcomeTabs } = await import('../utils/helpers.js');
      const { WORKBENCH } = await import('../utils/locators.js');
      await closeWelcomeTabs(page);
      await page.locator(WORKBENCH).click();
      // Close existing widget and reopen
      const existingVisible = await widget.isVisible({ timeout: 500 }).catch(() => false);
      if (existingVisible) {
        await page.keyboard.press('Escape');
        await widget.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
      }
      await page.keyboard.press('F1');
      await widget.waitFor({ state: 'attached', timeout: 10_000 });
      await expect(widget).toBeVisible({ timeout: 10_000 });
      // Re-query input after reopening
      input = widget.locator('input.input');
    }
    
    await input.waitFor({ state: 'attached', timeout: 10_000 });
    // Wait for input to be visible - it may be attached but hidden initially
    const inputVisible = await input.isVisible({ timeout: 5000 }).catch(() => false);
    if (!inputVisible) {
      // Input is hidden - try to force it visible
      const inputElement = await input.elementHandle();
      if (inputElement) {
        await inputElement.evaluate((el: HTMLElement) => {
          el.style.display = 'block';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
          (el as HTMLInputElement).focus();
        }).catch(() => {});
      }
    }
    await expect(input).toBeVisible({ timeout: 10_000 });
    // Focus the input to ensure it's ready for typing
    await input.focus({ timeout: 5000 });
    // Wait for input to be focused and ready - ensure it has the '>' prefix that VS Code adds automatically
    await expect(input).toHaveValue(/^>/, { timeout: 5000 });
    // Type the command - use pressSequentially for reliability (works better than fill() when VS Code interferes)
    // VS Code adds '>' prefix automatically, so we type the command without the '>' prefix
    // Instead of selecting all, just type after the '>' prefix - this is more reliable
    await input.click({ timeout: 5000 });
    // Move to end of input (after '>') and type the command
    await page.keyboard.press('End');
    await input.pressSequentially(command, { delay: 50 });
    // Wait for input value to contain what we typed - verify typing was successful
    // eslint-disable-next-line unicorn/prefer-string-replace-all -- replaceAll doesn't support regex patterns
    const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Check input value - it should contain the command (with '>' prefix)
    await expect(input).toHaveValue(new RegExp(`>.*${escapedCommand}`, 'i'), { timeout: 5000 });
    // Wait for command list to appear - this confirms VS Code processed the input
    await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 5000 });
  }).toPass({ timeout: 15_000 });

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
