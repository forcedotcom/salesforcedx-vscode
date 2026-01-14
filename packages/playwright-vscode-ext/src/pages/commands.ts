/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, Page } from '@playwright/test';
import { QUICK_INPUT_WIDGET, QUICK_INPUT_LIST_ROW, WORKBENCH } from '../utils/locators';

export const openCommandPalette = async (page: Page): Promise<void> => {
  const { closeWelcomeTabs } = await import('../utils/helpers.js');
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const workbench = page.locator(WORKBENCH);
  
  // Ensure welcome tabs are closed before opening command palette
  await closeWelcomeTabs(page);
  
  // Ensure workbench is focused
  await workbench.click();
  
  // Close any existing quick input widget
  const existingVisible = await widget.isVisible({ timeout: 500 }).catch(() => false);
  if (existingVisible) {
    await page.keyboard.press('Escape');
    await widget.waitFor({ state: 'hidden', timeout: 2000 });
  }
  
  // Open command palette with F1
  await page.keyboard.press('F1');
  
  // Wait for widget to be visible
  await expect(widget).toBeVisible({ timeout: 10_000 });
  
  // Wait for input to be ready
  const input = widget.locator('input.input');
  await expect(input).toBeVisible({ timeout: 10_000 });
};

const executeCommand = async (page: Page, command: string, hasNotText?: string): Promise<void> => {
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const input = widget.locator('input.input');
  
  // Wait for input to be ready
  await expect(input).toBeVisible({ timeout: 10_000 });
  
  // Focus the input and ensure it has the '>' prefix that VS Code adds automatically
  await input.focus();
  await expect(input).toHaveValue(/^>/, { timeout: 5000 });
  
  // Type the command after the '>' prefix
  await input.click();
  await page.keyboard.press('End');
  await input.pressSequentially(command, { delay: 50 });
  
  // Wait for command list to appear
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 10_000 });

  // Wait for the filtered list to stabilize
  const listRows = widget.locator(QUICK_INPUT_LIST_ROW);
  await expect(async () => {
    const count = await listRows.count();
    expect(count, 'Command list should have at least one row').toBeGreaterThan(0);
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

  // Find and click the command row
  const commandRow = widget.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: command, hasNotText }).first();
  await expect(commandRow).toBeAttached({ timeout: 10_000 });
  await commandRow.click();

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
