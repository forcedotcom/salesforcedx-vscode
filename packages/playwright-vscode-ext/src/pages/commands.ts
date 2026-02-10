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
    // Bring page to front to ensure VS Code window is active (critical on Windows)
    await page.bringToFront();

    // Click workbench to ensure focus is not on walkthrough elements
    await workbench.click({ timeout: 5000 });

    // Small delay to allow Windows to process focus change before F1 keypress
    // On Windows, F1 can trigger Windows Search if VS Code doesn't have focus
    await page.waitForTimeout(100);

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
  await page.keyboard.press('End'); // so that we type AFTER the '>' prefix
  await input.pressSequentially(command, { delay: 5 });

  // Wait for command list to appear
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 10_000 });

  // Find and click the command row
  // VS Code command palette items may have additional text after the command name (e.g., "similar commands")
  // So we match the command name exactly at the start of the text
  const escapedCommand = command.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'); // for searching with regex since () are common
  // Match command exactly at the start - this ensures exact match while allowing additional text after
  const commandRow = widget
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: new RegExp(`^${escapedCommand}`), hasNotText })
    .first();

  await expect(commandRow).toBeAttached({ timeout: 2000 });

  // For virtualized lists, use evaluate to scroll and click (more reliable than Playwright's click)
  await commandRow.evaluate(el => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    (el as HTMLElement).click();
  });

  // Wait for the command palette to close after executing the command
  await widget.waitFor({ state: 'hidden', timeout: 500 }).catch(() => {
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

/** Shared helper: opens command palette, types command text, waits for list, returns widget and rows getter */
const searchCommandInPalette = async (
  page: Page,
  commandText: string
): Promise<{
  widget: ReturnType<Page['locator']>;
  getFirst20Rows: () => Promise<Awaited<ReturnType<ReturnType<Page['locator']>['all']>>>;
}> => {
  await openCommandPalette(page);
  const widget = page.locator(QUICK_INPUT_WIDGET);
  const input = widget.locator('input.input');

  await expect(input).toBeVisible({ timeout: 5000 });
  // Click input directly to ensure focus (Windows needs explicit click, focus() alone may not work)
  await input.click({ timeout: 5000 });
  await input.pressSequentially(commandText, { delay: 5 });

  // Wait for command list to appear
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 10_000 });

  const getFirst20Rows = async () => {
    const listRows = widget.locator(QUICK_INPUT_LIST_ROW);
    return (await listRows.all()).slice(0, 20);
  };

  return { widget, getFirst20Rows };
};

/** Shared helper: closes command palette */
const closeCommandPalette = async (page: Page, widget: ReturnType<Page['locator']>): Promise<void> => {
  await page.keyboard.press('Escape');
  await widget.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
    // Ignore if already closed
  });
};

/** Verify a command does not exist in the command palette */
export const verifyCommandDoesNotExist = async (page: Page, commandText: string): Promise<void> => {
  const { widget, getFirst20Rows } = await searchCommandInPalette(page, commandText);

  const first20Rows = await getFirst20Rows();

  // Check that the command is not in the list
  for (const row of first20Rows) {
    const rowText = await row.textContent();
    if (rowText?.trim().toLowerCase().includes(commandText.toLowerCase())) {
      throw new Error(`Command "${commandText}" should not exist but was found in command palette`);
    }
  }

  await closeCommandPalette(page, widget);
};

/** Verify a command exists in the command palette using retry pattern */
export const verifyCommandExists = async (page: Page, commandText: string, timeout?: number): Promise<void> => {
  const widget = page.locator(QUICK_INPUT_WIDGET);

  // Use retry pattern: dismiss and re-search each iteration so results are fresh
  await expect(async () => {
    await dismissAllQuickInputWidgets(page);
    await openCommandPalette(page);

    const input = widget.locator('input.input');
    await input.click({ timeout: 5000 });
    await input.pressSequentially(commandText, { delay: 5 });

    await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 10_000 });

    const first20Rows = (await widget.locator(QUICK_INPUT_LIST_ROW).all()).slice(0, 20);
    for (const row of first20Rows) {
      const rowText = await row.textContent();
      if (rowText?.trim().toLowerCase().includes(commandText.toLowerCase())) {
        return; // Found it!
      }
    }
    throw new Error(`Command "${commandText}" not found yet`);
  }).toPass({ timeout: timeout ?? 10_000 });

  await closeCommandPalette(page, widget);
};
