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

  // Ensure workbench is focused
  await workbench.click({ timeout: 5000 });
  await expect(workbench).toBeVisible({ timeout: 5000 });

  // Dismiss any existing quick input widgets
  await dismissAllQuickInputWidgets(page);

  // Open command palette with F1
  await page.keyboard.press('F1');

  // Wait for widget to be attached and visible
  await widget.waitFor({ state: 'attached', timeout: 10_000 });
  await expect(widget).toBeVisible({ timeout: 10_000 });

  // Wait for input to be ready and stable
  const input = widget.locator('input.input');
  await input.waitFor({ state: 'attached', timeout: 10_000 });
  await expect(input).toBeVisible({ timeout: 10_000 });
  // Ensure input is focused and ready before returning
  await input.focus({ timeout: 5000 });
  await expect(input).toHaveValue(/^>/, { timeout: 5000 });
};

const executeCommand = async (page: Page, command: string, hasNotText?: string): Promise<void> => {
  const widget = page.locator(QUICK_INPUT_WIDGET);
  let input = widget.locator('input.input');

  // Ensure widget and input are visible - reopen command palette if needed
  await expect(async () => {
    const widgetVisible = await widget.isVisible({ timeout: 3000 }).catch(() => false);
    if (!widgetVisible) {
      // Widget is hidden - reopen command palette
      await closeWelcomeTabs(page);
      await page.locator(WORKBENCH).click({ timeout: 5000 });
      await dismissAllQuickInputWidgets(page);
      await page.keyboard.press('F1');
      await widget.waitFor({ state: 'attached', timeout: 10_000 });
      await expect(widget).toBeVisible({ timeout: 10_000 });
      input = widget.locator('input.input');
      // Wait for input to be ready after reopening
      await input.waitFor({ state: 'attached', timeout: 10_000 });
      await expect(input).toBeVisible({ timeout: 10_000 });
    } else {
      // Widget is visible - ensure input is also visible and ready
      await input.waitFor({ state: 'attached', timeout: 10_000 });
      await expect(input).toBeVisible({ timeout: 10_000 });
    }
  }).toPass({ timeout: 15_000 });
  await input.focus({ timeout: 5000 });
  await expect(input).toHaveValue(/^>/, { timeout: 5000 });

  // Type the command after the '>' prefix - retry if VS Code filtering interrupts typing
  // eslint-disable-next-line unicorn/prefer-string-replace-all -- replaceAll doesn't support regex patterns
  const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(async () => {
    // Ensure input is still visible and focused
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.focus({ timeout: 5000 });
    await page.keyboard.press('End');
    await input.pressSequentially(command, { delay: 50 });
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
