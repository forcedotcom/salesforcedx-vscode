/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  SETTINGS_SEARCH_INPUT,
  TAB,
  TAB_CLOSE_BUTTON,
  WORKBENCH
} from './locators';
import { NON_CRITICAL_ERROR_PATTERNS } from './nonCriticalErrorPatterns';
import { NON_CRITICAL_NETWORK_PATTERNS } from './nonCriticalNetworkPatterns';
import { activeQuickInputTextField, activeQuickInputWidget } from './quickInput';

type ConsoleError = { text: string; url?: string };
type NetworkError = { status: number; url: string; description: string };
type WaitForQuickInputFirstOptionOptions = {
  quickInputVisibleTimeout?: number;
  optionVisibleTimeout?: number;
  retryTimeout?: number;
};

export const setupConsoleMonitoring = (page: Page): ConsoleError[] => {
  const consoleErrors: ConsoleError[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), url: msg.location()?.url || '' });
    }
  });
  return consoleErrors;
};

export const setupNetworkMonitoring = (page: Page): NetworkError[] => {
  const networkErrors: NetworkError[] = [];
  page.on('response', response => {
    if (!response.ok()) {
      networkErrors.push({
        status: response.status(),
        url: response.url(),
        description: `HTTP ${response.status()} ${response.statusText()}`
      });
    }
  });
  return networkErrors;
};

export const filterErrors = (errors: ConsoleError[]): ConsoleError[] =>
  errors.filter(e => {
    const t = e.text.toLowerCase();
    const u = (e.url ?? '').toLowerCase();
    return !NON_CRITICAL_ERROR_PATTERNS.some(p => t.includes(p.toLowerCase()) || u.includes(p.toLowerCase()));
  });

export const filterNetworkErrors = (errors: NetworkError[]): NetworkError[] =>
  errors.filter(e => {
    const u = e.url.toLowerCase();
    const d = e.description.toLowerCase();
    return !NON_CRITICAL_NETWORK_PATTERNS.some(p => u.includes(p.toLowerCase()) || d.includes(p.toLowerCase()));
  });

/** Wait for VS Code workbench to load. For web, navigates to /. For desktop, just waits. */
export const waitForVSCodeWorkbench = async (page: Page): Promise<void> => {
  // Desktop: page is already loaded by Electron, no navigation possible
  if (isDesktop()) {
    await page.waitForSelector(WORKBENCH, { timeout: 60_000 });
    return;
  }

  // Web: navigate, then wait
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(WORKBENCH, { timeout: 60_000 });
};

/** VS Code 1.116+ Welcome onboarding can cover the workbench and block non-forced clicks. */
export const dismissWelcomeOnboardingOverlayIfPresent = async (page: Page): Promise<void> => {
  const welcomeOverlay = page.locator('.onboarding-a-overlay.visible, [aria-label="Welcome to Visual Studio Code"]');
  if (
    await welcomeOverlay
      .first()
      .isVisible({ timeout: 400 })
      .catch(() => false)
  ) {
    await page.keyboard.press('Escape');
    await welcomeOverlay
      .first()
      .waitFor({ state: 'hidden', timeout: 3000 })
      .catch(() => {});
  }
};

/** Dismiss any open quick input widgets by pressing Escape until none visible */
export const dismissAllQuickInputWidgets = async (page: Page): Promise<void> => {
  // Rely on attached command-palette inputs, not widget visibility (1.116+ often reports hidden while open)
  for (let i = 0; i < 4; i++) {
    const openInputs = await page.locator(`${QUICK_INPUT_WIDGET} input.input`).count();
    if (openInputs === 0) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
};

/** Wait for the first quick-pick option using ARIA or Monaco row selectors. */
export const waitForQuickInputFirstOption = async (
  page: Page,
  options?: WaitForQuickInputFirstOptionOptions
): Promise<void> => {
  const quickInput = activeQuickInputWidget(page);
  const input = activeQuickInputTextField(page);
  const firstAriaOption = quickInput.getByRole('option').first();
  const quickInputVisibleTimeout = options?.quickInputVisibleTimeout ?? 10_000;
  const optionVisibleTimeout = options?.optionVisibleTimeout ?? 5000;

  await expect(async () => {
    // Prefer the text field: empty/stale `.quick-input-widget` shells can attach without `input.input`
    await input.waitFor({ state: 'attached', timeout: quickInputVisibleTimeout });
    if ((await firstAriaOption.count()) > 0) {
      await firstAriaOption.waitFor({ state: 'attached', timeout: optionVisibleTimeout });
      return;
    }
    await quickInput
      .locator(QUICK_INPUT_LIST_ROW)
      .first()
      .waitFor({ state: 'attached', timeout: optionVisibleTimeout });
  }).toPass({ timeout: options?.retryTimeout ?? 10_000 });
};

/**
 * Accept the default (first) option in the active quick input widget.
 *
 * Unifies the three "click the first option" variants scattered across specs:
 * - Playwright `.click()` was flaky on desktop (highlighted but not committed)
 * - Keyboard Enter alone was flaky on web (keystroke dropped before commit)
 * - DOM `evaluate` click was needed when Playwright `.click()` was silently dropped
 *
 * Strategy: wait for the first option, then commit via DOM `evaluate` click (most reliable
 * across platforms — scrolls into view and fires a real DOM click synchronously).
 *
 * @param options.confirmCommitted Optional predicate the caller supplies to verify the commit
 * landed (e.g. next prompt visible, widget hidden, editor opened). If it doesn't return true
 * within `commitTimeout`, Enter is pressed as a fallback. Omit this for callers that will
 * assert their own next-state afterwards and don't need a built-in fallback.
 * @param options.commitTimeout How long to wait for `confirmCommitted` before pressing Enter.
 * Defaults to 3000ms. Ignored if `confirmCommitted` isn't provided.
 */
export const selectFirstQuickInputOption = async (
  page: Page,
  options?: {
    confirmCommitted?: () => Promise<boolean>;
    commitTimeout?: number;
    quickInputVisibleTimeout?: number;
    optionVisibleTimeout?: number;
    retryTimeout?: number;
  }
): Promise<void> => {
  await waitForQuickInputFirstOption(page, {
    quickInputVisibleTimeout: options?.quickInputVisibleTimeout,
    optionVisibleTimeout: options?.optionVisibleTimeout,
    retryTimeout: options?.retryTimeout
  });

  const quickInput = activeQuickInputWidget(page);
  const firstAriaOption = quickInput.getByRole('option').first();
  const firstRow =
    (await firstAriaOption.count()) > 0 ? firstAriaOption : quickInput.locator(QUICK_INPUT_LIST_ROW).first();

  await firstRow.evaluate(el => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    (el as HTMLElement).click();
  });

  if (options?.confirmCommitted) {
    const commitTimeout = options.commitTimeout ?? 3000;
    const committed = await options.confirmCommitted().catch(() => false);
    if (!committed) {
      // Poll until timeout before falling back to Enter — the predicate may take a moment
      // to become true (e.g. next prompt animating in).
      const deadline = Date.now() + commitTimeout;
      let done = false;
      while (Date.now() < deadline) {
        if (await options.confirmCommitted().catch(() => false)) {
          done = true;
          break;
        }
        await page.waitForTimeout(100);
      }
      if (!done) {
        await page.keyboard.press('Enter');
      }
    }
  }
};

/**
 * Select a quick-pick option by its accessible name in the active quick input widget.
 *
 * Clicking the option (rather than pressing Enter) is more reliable across platforms: on
 * desktop-electron the Enter keystroke sometimes does not register on the active quick pick,
 * leaving the picker open and the command never executed.
 *
 * @param name Accessible name (string or RegExp) of the option to click, e.g. `/^REST API/`.
 * @param options.waitForVisible If true (default), waits for the quick input's first option before clicking.
 * Set false if the caller already awaited the option list.
 * @param options.timeout Click timeout in ms (default 10_000).
 */
export const selectQuickInputOption = async (
  page: Page,
  name: string | RegExp,
  options?: {
    waitForVisible?: boolean;
    timeout?: number;
    quickInputVisibleTimeout?: number;
    optionVisibleTimeout?: number;
    retryTimeout?: number;
  }
): Promise<void> => {
  const waitForVisible = options?.waitForVisible ?? true;
  if (waitForVisible) {
    await waitForQuickInputFirstOption(page, {
      quickInputVisibleTimeout: options?.quickInputVisibleTimeout,
      optionVisibleTimeout: options?.optionVisibleTimeout,
      retryTimeout: options?.retryTimeout
    });
  }

  const option = activeQuickInputWidget(page).getByRole('option', { name });
  await option.first().click({ force: true, timeout: options?.timeout ?? 10_000 });
};

/**
 * Select a quick-pick option by typing a filter string then clicking the first matching row.
 *
 * Waits for the quick input widget, types `filterText` to narrow the list, then clicks the row
 * whose text matches `filterText` (case-insensitive). Use for pickers that populate asynchronously
 * (e.g. the Apex test-class picker) where typing is needed to surface the desired option.
 *
 * Single-select (default): commits via DOM `evaluate` click (scrolls into view + fires a real DOM
 * click synchronously) — the same pattern as `selectFirstQuickInputOption`, since Playwright
 * `.click()` was silently dropped on desktop-electron.
 *
 * Multi-select (`canPickMany`, `options.multiSelect: true`): toggles the row checkbox via a real
 * Playwright pointer click. A synthetic DOM `click()` does not toggle the monaco list checkbox, so
 * the picker accepts with nothing selected and the command silently no-ops.
 *
 * @param filterText Text to type into the quick input and match against list rows.
 * @param options.quickInputTimeout Wait for the widget to appear, ms (default 10_000).
 * @param options.optionTimeout Wait for the matching row to be visible, ms (default 10_000).
 * @param options.multiSelect Set true for `canPickMany` pickers to toggle the row checkbox.
 */
export const selectQuickInputOptionByTyping = async (
  page: Page,
  filterText: string,
  options?: { quickInputTimeout?: number; optionTimeout?: number; multiSelect?: boolean }
): Promise<void> => {
  await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: options?.quickInputTimeout ?? 10_000 });
  await page.keyboard.type(filterText);
  const option = page
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: new RegExp(filterText, 'i') })
    .first();
  await option.waitFor({ state: 'visible', timeout: options?.optionTimeout ?? 10_000 });
  if (options?.multiSelect) {
    await option.scrollIntoViewIfNeeded();
    await option.click({ force: true });
    return;
  }
  await option.evaluate(el => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    (el as HTMLElement).click();
  });
};

/**
 * Dismiss the VS Code 1.116+ "Welcome to VS Code" modal sign-in walkthrough that can appear on
 * first launch. This dialog is modal and blocks all other keyboard input (command palette, etc.)
 * until dismissed, so it must be closed before anything else. Clicks "Continue without Signing In"
 * if present, else "Skip", else Escape. Safe no-op if the dialog is not shown.
 */
export const dismissSignInWalkthroughDialog = async (page: Page): Promise<void> => {
  const dialog = page.getByRole('dialog', { name: /Welcome to (Visual Studio Code|VS Code)/i });
  const isVisible = await dialog.isVisible({ timeout: 500 }).catch(() => false);
  if (!isVisible) return;

  const continueWithoutSignIn = dialog.getByRole('button', { name: /Continue without Signing In/i });
  if (await continueWithoutSignIn.isVisible({ timeout: 500 }).catch(() => false)) {
    await continueWithoutSignIn.click({ force: true }).catch(() => {});
  } else {
    const skip = dialog.getByRole('button', { name: /^Skip$/i });
    await ((await skip.isVisible({ timeout: 500 }).catch(() => false))
      ? skip.click({ force: true }).catch(() => {})
      : page.keyboard.press('Escape'));
  }
  await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
};

/** Close VS Code Welcome/Walkthrough tabs if they're open */
export const closeWelcomeTabs = async (page: Page): Promise<void> => {
  // Dismiss the 1.116+ modal sign-in walkthrough first — it blocks all other input, including
  // the clicks/keystrokes this helper uses, so it must be gone before we try to close tabs.
  await dismissSignInWalkthroughDialog(page);

  const workbench = page.locator(WORKBENCH);

  // Use Playwright's retry mechanism to close all welcome tabs
  await expect(async () => {
    await dismissWelcomeOnboardingOverlayIfPresent(page);
    // Dismiss any quick input widgets that might intercept clicks
    await dismissAllQuickInputWidgets(page);

    // Ensure workbench is focused before interacting with tabs (overlay can block non-forced clicks)
    await workbench.click({ timeout: 5000, force: true });

    const welcomeTabs = page.getByRole('tab', { name: /Welcome|Walkthrough/i });
    const count = await welcomeTabs.count();

    if (count === 0) {
      return;
    }

    const welcomeTab = welcomeTabs.first();

    // Select the tab first to ensure it's active
    await welcomeTab.click({ timeout: 5000, force: true });
    await expect(welcomeTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });

    // Dismiss any quick input widgets that may have appeared after clicking
    await dismissAllQuickInputWidgets(page);

    // Try close button first
    const closeButton = welcomeTab.locator(TAB_CLOSE_BUTTON);
    if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      if ((await page.locator(`${QUICK_INPUT_WIDGET} input.input`).count()) > 0) {
        await dismissAllQuickInputWidgets(page);
      }
      await closeButton.click({ timeout: 5000, force: true });
      await welcomeTab.waitFor({ state: 'detached', timeout: 10_000 });
    } else {
      // Fall back to keyboard shortcut
      await page.keyboard.press('Control+w');
      await welcomeTab.waitFor({ state: 'detached', timeout: 10_000 });
    }

    // Verify tab was closed - locators automatically re-evaluate
    const remainingCount = await welcomeTabs.count();
    if (remainingCount > 0) {
      throw new Error(`Still ${remainingCount} welcome tab(s) remaining`);
    }
  }).toPass({ timeout: 30_000 });
};

/** Closes any visible Settings tab or overlay on desktop. Single-shot; does not loop. */
export const closeSettingsTab = async (page: Page): Promise<void> => {
  if (isDesktop()) {
    // Desktop can render Settings as a regular editor tab OR as a centered/overlay editor that
    // isn't in `.tabs-container`. Prefer clicking the tab's close button (safest: targets only
    // Settings). Fall back to focus + Ctrl/Cmd+W for the overlay case.
    const desktopSettingsEditor = page.locator('.settings-editor').first();
    const desktopSettingsTab = page
      .locator(TAB)
      .filter({ hasText: /Settings/i })
      .first();

    const isDesktopTabVisible = await desktopSettingsTab.isVisible({ timeout: 500 }).catch(() => false);
    if (isDesktopTabVisible) {
      const closeButton = desktopSettingsTab.locator(TAB_CLOSE_BUTTON);
      if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeButton.click({ force: true }).catch(() => {});
        await desktopSettingsTab.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
      }
      return;
    }

    const isOverlayVisible = await desktopSettingsEditor.isVisible({ timeout: 500 }).catch(() => false);
    if (isOverlayVisible) {
      // Focus the Settings editor before the keyboard close, otherwise Ctrl+W is routed
      // elsewhere (and in the worst case can close the wrong editor). Single-shot.
      await desktopSettingsEditor.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
      await page.keyboard.press('ControlOrMeta+w').catch(() => {});
      await desktopSettingsEditor.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
    return;
  }

  const settingsTab = page
    .locator(TAB)
    .filter({ hasText: /Settings/i })
    .first();
  const isTabVisible = await settingsTab.isVisible().catch(() => false);
  if (isTabVisible) {
    const closeButton = settingsTab.locator(TAB_CLOSE_BUTTON);
    await closeButton.click();
    await settingsTab.waitFor({ state: 'detached', timeout: 5000 });
    return;
  }
  // Settings may open as a floating modal overlay (not a tab) — close button or Escape dismisses it.
  const modalCloseButton = page.getByRole('button', { name: /Close Modal Editor/i }).first();
  if (await modalCloseButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await modalCloseButton.click({ force: true }).catch(() => {});
    return;
  }
  // Fallback: settings search input visible means overlay is open — press Escape to dismiss.
  const settingsInput = page.locator(SETTINGS_SEARCH_INPUT.join(',')).first();
  if (await settingsInput.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
  }
};

/** Wait for workspace file system to be ready by checking for sfdx-project.json in Explorer */
export const waitForWorkspaceReady = async (page: Page, timeout = 30_000): Promise<void> => {
  // Wait for sfdx-project.json file to appear in file tree (indicates workspace is loaded)
  const projectFile = page.getByRole('treeitem', { name: /sfdx-project\.json/ });
  await projectFile.waitFor({ state: 'visible', timeout }).catch(() => {
    throw new Error('sfdx-project.json not found - Salesforce project may not be loaded');
  });
};

export const typingSpeed = 50; // ms

/** Escape regex metacharacters in `s` so it can be embedded in a `RegExp`. */
export const escapeRegExp = (s: string): string => s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Returns true if running on desktop (Electron), regardless of platform */
export const isDesktop = (): boolean => process.env.VSCODE_DESKTOP === '1';

/** Returns true if running on macOS desktop (Electron) */
export const isMacDesktop = (): boolean => process.env.VSCODE_DESKTOP === '1' && process.platform === 'darwin';

/** Returns true if running on Windows desktop (Electron) */
export const isWindowsDesktop = (): boolean => process.env.VSCODE_DESKTOP === '1' && process.platform === 'win32';

/** Validate no critical console or network errors occurred during test execution */
export const validateNoCriticalErrors = async (
  test: { step: (name: string, fn: () => Promise<void>) => Promise<void> },
  consoleErrors: ConsoleError[],
  networkErrors?: NetworkError[]
): Promise<void> => {
  await test.step('validate no critical errors', async () => {
    const criticalConsole = filterErrors(consoleErrors);
    const criticalNetwork = networkErrors ? filterNetworkErrors(networkErrors) : [];
    expect(criticalConsole, `Console errors: ${criticalConsole.map(e => e.text).join(' | ')}`).toHaveLength(0);
    if (networkErrors) {
      expect(criticalNetwork, `Network errors: ${criticalNetwork.map(e => e.description).join(' | ')}`).toHaveLength(0);
    }
    await Promise.resolve(); // Satisfy require-await lint rule
  });
};
