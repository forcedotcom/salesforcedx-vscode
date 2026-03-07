/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, Page } from '@playwright/test';
import { dismissAllQuickInputWidgets } from '../utils/helpers';
import { QUICK_INPUT_WIDGET, QUICK_INPUT_LIST_ROW } from '../utils/locators';

export const openCommandPalette = async (page: Page): Promise<void> => {
  const widget = page.locator(QUICK_INPUT_WIDGET);

  // Dismiss any existing quick input widgets
  await dismissAllQuickInputWidgets(page);

  // Wrap the entire open sequence in retry logic
  await expect(async () => {
    // Bring page to front to ensure VS Code window is active (critical on Windows)
    await page.bringToFront();

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
  }).toPass({ timeout: 10_000 });
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

  // fill() is faster than pressSequentially on CI (avoids timeout on macOS)
  await input.fill(`>${command}`);

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
  hasNotText?: string,
  timeout = 15_000
): Promise<void> => {
  await expect(async () => {
    await dismissAllQuickInputWidgets(page);
    await openCommandPalette(page);
    await executeCommand(page, command, hasNotText);
  }).toPass({ timeout });
};

/** Shared helper: closes command palette */
const closeCommandPalette = async (page: Page, widget: ReturnType<Page['locator']>): Promise<void> => {
  await page.keyboard.press('Escape');
  await widget.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
    // Ignore if already closed
  });
};

const DEFAULT_VERIFY_TIMEOUT = 10_000;

/**
 * Shared retry loop: dismiss stale widgets, open command palette, type commandText,
 * read first 20 rows, pass them to `check`. Caller throws to retry or returns to succeed.
 */
const retryCommandPaletteSearch = async (
  page: Page,
  commandText: string,
  check: (rowTexts: string[]) => void,
  timeout: number
): Promise<void> => {
  const widget = page.locator(QUICK_INPUT_WIDGET);

  await expect(async () => {
    await dismissAllQuickInputWidgets(page);
    await openCommandPalette(page);

    const input = widget.locator('input.input');
    await input.click({ timeout: 5000 });
    await input.fill(`>${commandText}`);

    await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 10_000 });

    const rows = await widget.locator(QUICK_INPUT_LIST_ROW).all();
    const rowTexts = await Promise.all(
      rows.slice(0, 20).map(async row => (await row.textContent())?.trim().toLowerCase() ?? '')
    );
    check(rowTexts);
  }).toPass({ timeout });

  await closeCommandPalette(page, widget);
};

/** Verify a command exists in the command palette (retries until found or timeout) */
export const verifyCommandExists = async (page: Page, commandText: string, timeout?: number): Promise<void> => {
  const lowerCommand = commandText.toLowerCase();
  await retryCommandPaletteSearch(
    page,
    commandText,
    rowTexts => {
      if (!rowTexts.some(t => t.includes(lowerCommand))) {
        throw new Error(`Command "${commandText}" not found yet`);
      }
    },
    timeout ?? DEFAULT_VERIFY_TIMEOUT
  );
};

/** Verify a command does not exist in the command palette (retries until gone or timeout) */
export const verifyCommandDoesNotExist = async (page: Page, commandText: string, timeout?: number): Promise<void> => {
  const lowerCommand = commandText.toLowerCase();
  await retryCommandPaletteSearch(
    page,
    commandText,
    rowTexts => {
      if (rowTexts.some(t => t.includes(lowerCommand))) {
        throw new Error(`Command "${commandText}" still visible (context may not have updated)`);
      }
    },
    timeout ?? DEFAULT_VERIFY_TIMEOUT
  );
};
