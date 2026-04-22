/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, Page } from '@playwright/test';
import {
  dismissAllQuickInputWidgets,
  dismissSignInWalkthroughDialog,
  dismissWelcomeOnboardingOverlayIfPresent,
  waitForQuickInputFirstOption
} from '../utils/helpers';
import { WORKBENCH } from '../utils/locators';
import { activeQuickInputTextField, activeQuickInputWidget } from '../utils/quickInput';

export type OpenCommandPaletteOptions = {
  /**
   * When true, skip the focus-click that normally precedes F1 and skip any Escape-based dismiss
   * of existing quick input widgets. The workbench click usually lands in the editor area and
   * clears any active text selection, and Escape keystrokes trigger VS Code's `cancelSelection`
   * binding when the editor is focused with a selection. Both effects flip the
   * `editorHasSelection` context to false and hide selection-guarded commands from the palette.
   * Set this to `true` when you need the active selection to survive opening the palette. The
   * caller is responsible for ensuring the editor has keyboard focus (typically as a side effect
   * of the click + keyboard selection that produced the selection). Defaults to `false`.
   */
  preserveSelection?: boolean;
};

export const openCommandPalette = async (page: Page, options?: OpenCommandPaletteOptions): Promise<void> => {
  // Dismiss any existing quick input widgets. Skip when `preserveSelection` is set — that helper
  // issues Escape keystrokes, and VS Code's default `cancelSelection` binding is triggered by
  // Escape when the editor is focused with a selection, wiping out what the caller just set up.
  if (!options?.preserveSelection) {
    await dismissAllQuickInputWidgets(page);
  }

  // VS Code 1.116.0+ may show a modal "Welcome to VS Code - Sign In" walkthrough that blocks all
  // keyboard input including F1. Dismiss it here so palette callers don't each have to.
  await dismissSignInWalkthroughDialog(page);

  // Wrap the entire open sequence in retry logic
  await expect(async () => {
    // Bring page to front to ensure VS Code window is active (critical on Windows)
    await page.bringToFront();

    // Small delay to allow Windows to process focus change before F1 keypress
    // On Windows, F1 can trigger Windows Search if VS Code doesn't have focus
    await page.waitForTimeout(100);

    await dismissWelcomeOnboardingOverlayIfPresent(page);
    // Click the workbench to ensure VS Code has keyboard focus before F1 — unless the caller is
    // preserving an existing editor selection. On web, any click outside the editor (including
    // the status bar) blurs the monaco editor and clears its selection, flipping
    // `editorHasSelection` to false and hiding selection-guarded commands. When preserving
    // selection we assume the caller already gave the editor focus (selection implies focus).
    if (!options?.preserveSelection) {
      await page
        .locator(WORKBENCH)
        .click({ force: true })
        .catch(() => {});
    }

    // Press F1 to open command palette
    await page.keyboard.press('F1');

    // VS Code 1.116+: `.quick-input-widget` and `input.input` often fail `toBeVisible()` while still usable
    const input = activeQuickInputTextField(page);
    await input.waitFor({ state: 'attached', timeout: 15_000 });
    // Clicking the palette input is fine for focus; it does not alter the underlying editor
    // selection (the palette is a separate widget). Skip it when preserving selection out of
    // caution — on web, any mouse event can trigger blur-driven selection resets.
    if (!options?.preserveSelection) {
      await input.click({ force: true, timeout: 5000 });
    }
    await expect(input).toHaveValue(/^>/, { timeout: 5000 });
  }).toPass({ timeout: 30_000 });
};

const executeCommand = async (
  page: Page,
  command: string,
  hasNotText?: string,
  paletteOptions?: OpenCommandPaletteOptions
): Promise<void> => {
  const widget = activeQuickInputWidget(page);
  const input = activeQuickInputTextField(page);

  await input.waitFor({ state: 'attached', timeout: 5000 });
  // Skip the extra palette-input click when preserving selection. On web, any mouse event can
  // trigger a blur on the monaco editor that collapses/clears its selection, which re-evaluates
  // `editorHasSelection` to false and drops the selection-guarded command from the palette list.
  if (!paletteOptions?.preserveSelection) {
    await input.click({ force: true, timeout: 5000 });
  }
  await expect(input).toHaveValue(/^>/, { timeout: 5000 });

  // fill() is faster than pressSequentially on CI (avoids timeout on macOS)
  await input.fill(`>${command}`, { force: true });

  // Wait for command list to appear
  await waitForQuickInputFirstOption(page, { optionVisibleTimeout: 15_000 });
  // Match by aria-label: exact match on command or exact match on part before ", "
  // e.g., "File: Save" matches aria-label "File: Save, Command+S"
  const options = await page.getByRole('option').all();
  let found = false;
  const allLabels: string[] = [];
  for (const option of options) {
    const ariaLabel = await option.getAttribute('aria-label');
    if (!ariaLabel) continue;
    allLabels.push(ariaLabel);
    // Check exact match or exact match before ", " (for keyboard shortcuts)
    if (ariaLabel === command || (ariaLabel.includes(', ') && ariaLabel.split(', ')[0] === command)) {
      await option.scrollIntoViewIfNeeded().catch(() => {});
      await option.click({ force: true, timeout: 5000 });
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error(
      `Command "${command}" not found in command palette. Available options:\n${allLabels.slice(0, 10).join('\n')}`
    );
  }

  // Wait for the command palette to close after executing the command
  await widget.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {
    // If it doesn't close (e.g., multi-step commands), that's ok
  });
};

export const executeCommandWithCommandPalette = async (
  page: Page,
  command: string,
  hasNotText?: string,
  options?: OpenCommandPaletteOptions
): Promise<void> => {
  await expect(async () => {
    // Escape-based dismiss clears editor selection (VS Code binds `escape` to
    // `cancelSelection` when the editor has one). Skip it when preserving selection.
    if (!options?.preserveSelection) {
      await dismissAllQuickInputWidgets(page);
    }
    await openCommandPalette(page, options);
    await executeCommand(page, command, hasNotText, options);
  }).toPass({ timeout: 30_000 });
};

/** Shared helper: closes command palette */
const closeCommandPalette = async (page: Page, widget: ReturnType<Page['locator']>): Promise<void> => {
  await page.keyboard.press('Escape');
  await widget.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
    // Ignore if already closed
  });
};

const DEFAULT_VERIFY_TIMEOUT = 10_000;

/** Command title as shown in palette (strip keyboard shortcut suffix from aria-label). */
const commandTitleFromAriaLabel = (ariaLabel: string): string =>
  ariaLabel.includes(', ') ? ariaLabel.split(', ')[0]! : ariaLabel;

/**
 * True if some quick-pick option's command title exactly matches (same rules as executeCommand).
 * Prefer this over matching row textContent — rows can concatenate unrelated labels and false-positive
 * verifyCommandDoesNotExist (e.g. "Current" matching a longer unrelated string).
 */
const paletteHasExactCommandTitle = async (page: Page, commandText: string): Promise<boolean> => {
  const lower = commandText.toLowerCase();
  const options = await page.getByRole('option').all();
  for (const option of options) {
    const ariaLabel = await option.getAttribute('aria-label');
    if (!ariaLabel) continue;
    const title = commandTitleFromAriaLabel(ariaLabel);
    if (title.toLowerCase() === lower) {
      return true;
    }
  }
  return false;
};

/**
 * Shared retry loop: dismiss stale widgets, open command palette, type commandText,
 * run check (same title resolution as executeCommand).
 */
const retryCommandPaletteSearch = async (
  page: Page,
  commandText: string,
  check: (page: Page, commandText: string) => void | Promise<void>,
  timeout: number
): Promise<void> => {
  const widget = activeQuickInputWidget(page);

  await expect(async () => {
    await dismissAllQuickInputWidgets(page);
    await openCommandPalette(page);

    const input = activeQuickInputTextField(page);
    await input.click({ force: true, timeout: 5000 });
    await input.fill(`>${commandText}`, { force: true });

    await waitForQuickInputFirstOption(page, { optionVisibleTimeout: 15_000 });

    await check(page, commandText);
  }).toPass({ timeout });

  await closeCommandPalette(page, widget);
};

/** Verify a command exists in the command palette (retries until found or timeout) */
export const verifyCommandExists = async (page: Page, commandText: string, timeout?: number): Promise<void> => {
  await retryCommandPaletteSearch(
    page,
    commandText,
    async (p, cmd) => {
      if (!(await paletteHasExactCommandTitle(p, cmd))) {
        throw new Error(`Command "${commandText}" not found yet`);
      }
    },
    timeout ?? DEFAULT_VERIFY_TIMEOUT
  );
};

/** Verify a command does not exist in the command palette (retries until gone or timeout) */
export const verifyCommandDoesNotExist = async (page: Page, commandText: string, timeout?: number): Promise<void> => {
  await retryCommandPaletteSearch(
    page,
    commandText,
    async (p, cmd) => {
      if (await paletteHasExactCommandTitle(p, cmd)) {
        throw new Error(`Command "${commandText}" still visible (context may not have updated)`);
      }
    },
    timeout ?? DEFAULT_VERIFY_TIMEOUT
  );
};
