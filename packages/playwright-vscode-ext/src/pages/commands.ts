/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, Page } from '@playwright/test';
import { closeWelcomeTabs, dismissAllQuickInputWidgets } from '../utils/helpers';
import { QUICK_INPUT_WIDGET, QUICK_INPUT_LIST_ROW, WORKBENCH } from '../utils/locators';

export const openCommandPalette = async (page: Page): Promise<void> => {
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const workbench = page.locator(WORKBENCH);

  // Close welcome tabs before opening command palette
  await closeWelcomeTabs(page);

  // Dismiss any existing quick input widgets
  await dismissAllQuickInputWidgets(page);

  // Wrap the entire open sequence in retry logic
  await expect(async () => {
    // Click workbench to ensure focus is not on walkthrough elements
    await workbench.click({ timeout: 5000 });

    // Press F1 to open command palette
    await page.keyboard.press('F1');

    // Wait for widget to be visible (not just attached)
    await expect(widget).toBeVisible({ timeout: 5000 });

    // Verify input is ready
    const input = widget.locator('input.input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await expect(input).toHaveValue(/^>/, { timeout: 5000 });
  }).toPass({ timeout: 20_000 });
};

const executeCommand = async (page: Page, command: string, hasNotText?: string): Promise<void> => {
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const input = widget.locator('input.input');

  // Ensure widget and input are visible - if not, openCommandPalette should have handled it
  await expect(widget).toBeVisible({ timeout: 5000 });
  await expect(input).toBeVisible({ timeout: 5000 });
  // Click input directly to ensure focus (Windows needs explicit click, focus() alone may not work)
  await input.click({ timeout: 5000 });
  await expect(input).toHaveValue(/^>/, { timeout: 5000 });

  // Type the command after the '>' prefix - retry if VS Code filtering interrupts typing
  // eslint-disable-next-line unicorn/prefer-string-replace-all -- replaceAll doesn't support regex patterns
  const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(async () => {
    await page.keyboard.press('End');
    await input.pressSequentially(command, { delay: 5 });
    // Verify typing was successful
    await expect(input).toHaveValue(new RegExp(`>.*${escapedCommand}`, 'i'), { timeout: 5000 });
  }).toPass({ timeout: 15_000 });

  // Wait for command list to appear and stabilize
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 10_000 });

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

  // For virtualized lists, use evaluate to scroll and click (more reliable than Playwright's click)
  await commandRow.evaluate(el => {
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

/** Verify a command does not exist in the command palette */
export const verifyCommandDoesNotExist = async (page: Page, commandText: string): Promise<void> => {
  await openCommandPalette(page);
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const input = widget.locator('input.input');

  await expect(input).toBeVisible({ timeout: 5000 });
  // Click input directly to ensure focus (Windows needs explicit click, focus() alone may not work)
  await input.click({ timeout: 5000 });
  await input.pressSequentially(commandText, { delay: 5 });

  // Wait for command list to appear
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 10_000 });

  const listRows = widget.locator(QUICK_INPUT_LIST_ROW);
  const first20Rows = (await listRows.all()).slice(0, 20);

  // Check that the command is not in the list
  for (const row of first20Rows) {
    const rowText = await row.textContent();
    if (rowText?.trim().toLowerCase().includes(commandText.toLowerCase())) {
      throw new Error(`Command "${commandText}" should not exist but was found in command palette`);
    }
  }

  // Close command palette
  await page.keyboard.press('Escape');
  await widget.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
    // Ignore if already closed
  });
};
