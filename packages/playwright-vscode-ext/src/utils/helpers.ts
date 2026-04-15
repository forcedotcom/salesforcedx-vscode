/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { executeCommandWithCommandPalette } from '../pages/commands';
import { upsertSettings } from '../pages/settings';
import {
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW,
  SETTINGS_SEARCH_INPUT,
  TAB,
  TAB_CLOSE_BUTTON,
  WORKBENCH
} from './locators';

type ConsoleError = { text: string; url?: string };
type NetworkError = { status: number; url: string; description: string };
type WaitForQuickInputFirstOptionOptions = {
  quickInputVisibleTimeout?: number;
  optionVisibleTimeout?: number;
  retryTimeout?: number;
};

const NON_CRITICAL_ERROR_PATTERNS: readonly string[] = [
  // VS Code Web expected missing resources
  'favicon.ico',
  'sourcemap',
  'webPackagePaths.js',
  'workbench.web.main.nls.js',
  // IndexedDB shutdown noise in web
  'idbtransaction',
  'indexeddb database',
  'Long running operations during shutdown', // VS Code lifecycle noise
  'marketplace.visualstudio.com', // Marketplace/network optional features
  "Activating extension 'vscode.typescript-language-features' failed", // Extensions not supported in web
  'CodeExpectedError', // Generic non-fatal code expectation messages
  'Failed to load resource', // Generic failed to load resources (paired with specific url filtering below)
  'vscode-userdata:/user/caches/cachedconfigurations', // VS Code user data caching in web environment
  'vsliveshare', // vscode liveshare ext
  'MaxListenersExceededWarning', // expected when loading many dev extensions simultaneously
  'punycode', // known jsforce and transitive dep deprecation by node
  'selectedStep', // VS Code internal walkthrough/tutorial state errors
  'onWillSaveTextDocument', // VS Code save event timeout (non-critical)
  'Throttler is disposed', // VS Code internal throttler lifecycle error (non-critical)
  'vscode-log:', // VS Code internal logging infrastructure errors
  'tasks.log', // VS Code tasks log file creation conflicts
  'theme-defaults/themes', // VS Code theme loading failures
  'light_modern.json', // VS Code theme file loading
  'Failed to fetch', // Generic fetch failures (often for optional resources)
  'tsserver.web.js', // TypeScript language features extension (UriError: Scheme contains illegal characters)
  'typescript-language-features', // TS extension console/URI errors in web
  'NO_COLOR', // Node.js color env var warnings
  'Content Security Policy', // CSP violations from VS Code webviews (non-critical UI errors)
  'Applying inline style violates', // CSP inline style errors from VS Code UI
  'Unable to resolve resource walkThrough://', // VS Code walkthrough/getting started page errors (non-critical)
  'SourceMembers timed out after', // sourcemember polling warnings from source-tracking-library
  'Illegal value for lineNumber', // VS Code internal editor error (non-critical),
  "'allow-scripts' permissions is not set", //
  'Blocked script execution', // Webview sandboxing initialization errors (non-critical)
  'vscode-webview://', // Webview internal URLs (paired with blocked script errors)
  'Connection failed, falling back to static endpoint', // o11y unauthnticated connection,
  'Ignoring terminal.integrated.initialHint', // VS Code terminal hint configuration conflicts (non-critical)
  // these are known issue with apex test ext.  They need to be fixed, but might involve the library code.
  'Failed to write JSON test result file', // Web filesystem limitations when writing test results (non-critical)
  'callback must be a function', // memfs/Volume API compatibility issue on web (non-critical),
  'Unable to resolve nonexistent file', // VS Code trying to access files that don't exist yet (workspace state)
  'testResults', // Test results folder access before it's created (non-critical)
  'workspaceStorage', // Workspace storage access errors during initialization (non-critical)
  'Illegal assignment from String to Integer', // Execute anonymous compile error (intentionally triggered in E2E)
  'Network error occurred', // VS Code Extension Host IPC keep-alive poller warning (non-critical)
  'PerfSampleError', // Electron perf sampling noise (non-critical, unrelated to extension behavior)
  'workbench.contrib.agentHostTerminal' // VS Code agent host terminal error (non-critical)
] as const;

const NON_CRITICAL_NETWORK_PATTERNS: readonly string[] = [
  'webPackagePaths.js',
  'workbench.web.main.nls.js',
  'workbench.web.main.internal.js',
  'marketplace.visualstudio.com',
  'vscode-unpkg.net', // VS Code extension marketplace CDN
  'scratchOrgInfo', // asking the org if it's a devhub during auth ?
  'Package2Member', // Tooling API Package2Member can return 400 in scratch orgs; apex-testing handles it and falls back
  '.a4drules', // @salesforce/templates optional project template assets (react internal/external app templates) not bundled for Apex
  'typescript-language-features', // TS extension 404s for package.json etc in web
  'applicationinsights.azure.com', // Azure Application Insights telemetry (e.g. HTTP 439 throttling) — not critical to extension behavior
  // Salesforce OAuth userinfo endpoint (can 403/500 if session is invalid/expired in web,
  // non-critical for these tests.  sfdx-core will query user/organization sobjects as fallback )
  // https://github.com/forcedotcom/sfdx-core/blob/8d378c3a6f88a1d370ddc3f43954a90d7159377d/src/org/authInfo.ts#L1236
  'services/oauth2/userinfo'
] as const;

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
export const waitForVSCodeWorkbench = async (page: Page, navigate = true): Promise<void> => {
  // Desktop: page is already loaded by Electron, no navigation possible
  if (isDesktop()) {
    await page.waitForSelector(WORKBENCH, { timeout: 60_000 });
    return;
  }

  // Web: navigate if requested, then wait
  if (navigate) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector(WORKBENCH, { timeout: 60_000 });
};

/** Assert that Welcome/Walkthrough tab exists and is visible - useful for debugging startup issues */
export const assertWelcomeTabExists = async (page: Page): Promise<void> => {
  const welcomeTab = page.getByRole('tab', { name: /Welcome|Walkthrough/i }).first();
  await expect(welcomeTab, 'Welcome/Walkthrough tab should exist after VS Code startup').toBeVisible({
    timeout: 10_000
  });
};

/** Dismiss any open quick input widgets by pressing Escape until none visible */
export const dismissAllQuickInputWidgets = async (page: Page): Promise<void> => {
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  // Press Escape up to 3 times to dismiss any stacked widgets
  for (let i = 0; i < 3; i++) {
    if (await quickInput.isVisible({ timeout: 200 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await quickInput.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});
    } else {
      break;
    }
  }
};

/** Wait for the first quick-pick option using ARIA or Monaco row selectors. */
export const waitForQuickInputFirstOption = async (
  page: Page,
  options?: WaitForQuickInputFirstOptionOptions
): Promise<void> => {
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  const firstAriaOption = quickInput.getByRole('option').first();
  const quickInputVisibleTimeout = options?.quickInputVisibleTimeout ?? 10_000;
  const optionVisibleTimeout = options?.optionVisibleTimeout ?? 5000;

  await expect(async () => {
    await quickInput.waitFor({ state: 'visible', timeout: quickInputVisibleTimeout });
    if ((await firstAriaOption.count()) > 0) {
      await expect(firstAriaOption).toBeVisible({ timeout: optionVisibleTimeout });
      return;
    }
    await quickInput.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: optionVisibleTimeout });
  }).toPass({ timeout: options?.retryTimeout ?? 10_000 });
};

/** Close VS Code Welcome/Walkthrough tabs if they're open */
export const closeWelcomeTabs = async (page: Page): Promise<void> => {
  const workbench = page.locator(WORKBENCH);

  // Use Playwright's retry mechanism to close all welcome tabs
  await expect(async () => {
    // Dismiss any quick input widgets that might intercept clicks
    await dismissAllQuickInputWidgets(page);

    // Ensure workbench is focused before interacting with tabs
    await workbench.click({ timeout: 5000 });

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
      // Ensure no quick input widget is intercepting before clicking
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      const widgetVisible = await quickInput.isVisible({ timeout: 200 }).catch(() => false);
      if (widgetVisible) {
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

/** Closes any visible Settings tab or overlay on desktop. */
export const closeSettingsTab = async (page: Page): Promise<void> => {
  if (isDesktop()) {
    // Desktop can show Settings as an overlay; Escape closes it when present.
    await page.keyboard.press('Escape');

    const desktopSettingsTab = page
      .locator(TAB)
      .filter({ hasText: /Settings/i })
      .first();
    const isDesktopSettingsVisible = await desktopSettingsTab.isVisible({ timeout: 1000 }).catch(() => false);
    if (isDesktopSettingsVisible) {
      const closeButton = desktopSettingsTab.locator(TAB_CLOSE_BUTTON);
      const canClickClose = await closeButton.isVisible({ timeout: 1000 }).catch(() => false);
      if (canClickClose) {
        await closeButton.click({ force: true }).catch(() => {});
      }
      await desktopSettingsTab.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
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

/** Returns true if running on desktop (Electron), regardless of platform */
export const isDesktop = (): boolean => process.env.VSCODE_DESKTOP === '1';

/** Returns true if running on macOS desktop (Electron) */
export const isMacDesktop = (): boolean => process.env.VSCODE_DESKTOP === '1' && process.platform === 'darwin';

/** Returns true if running on Windows desktop (Electron) */
export const isWindowsDesktop = (): boolean => process.env.VSCODE_DESKTOP === '1' && process.platform === 'win32';

/** Returns true if running in VS Code web (not desktop Electron) */
export const isVSCodeWeb = (): boolean => process.env.VSCODE_DESKTOP !== '1';

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

/**
 * Disable Monaco editor auto-closing features (brackets, quotes, etc.) to prevent duplicates during typing.
 * Uses VS Code settings API for cleaner, more maintainable approach.
 */
export const disableMonacoAutoClosing = async (page: Page): Promise<void> => {
  await upsertSettings(page, {
    'editor.autoClosingBrackets': 'never',
    'editor.autoClosingQuotes': 'never',
    'editor.autoClosingOvertype': 'never'
  });

  // Close Settings tab so it doesn't interfere with subsequent operations
  await closeSettingsTab(page);
};

/**
 * Re-enable Monaco editor auto-closing features with default language-defined behavior.
 * Uses VS Code settings API for cleaner, more maintainable approach.
 */
export const enableMonacoAutoClosing = async (page: Page): Promise<void> => {
  await upsertSettings(page, {
    'editor.autoClosingBrackets': 'languageDefined',
    'editor.autoClosingQuotes': 'languageDefined',
    'editor.autoClosingOvertype': 'auto'
  });

  // Close Settings tab so it doesn't interfere with subsequent operations
  await closeSettingsTab(page);
};

/**
 * Wait for all VS Code extensions to finish activating by watching the
 * "Developer: Show Running Extensions" editor.  More reliable than polling
 * the command palette, especially on slow CI runners (e.g. Windows).
 *
 * While an extension is activating its row contains the text "Activating".
 * Once done the row shows "Activation: Xms" / "Startup Activation: Xms".
 * We wait until no rows contain "Activating" any more.
 *
 * @param timeout - Maximum ms to wait for all extensions to activate (default 120 000).
 */
export const waitForExtensionsActivated = async (page: Page, timeout = 120_000): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Developer: Show Running Extensions');

  // The editor container gets class "runtime-extensions-editor" via createEditor()
  const editor = page.locator('.runtime-extensions-editor');
  await editor.waitFor({ state: 'visible', timeout: 15_000 });

  // Wait for the list to populate (at least one row rendered)
  const rows = editor.locator('.monaco-list-row');
  await expect(rows).not.toHaveCount(0, { timeout: 30_000 });

  // Wait until no row still contains "Activating" text
  const stillActivating = rows.filter({ hasText: 'Activating' });
  await expect(stillActivating).toHaveCount(0, { timeout });

  // Close the Running Extensions tab via command palette (cross-platform, no hover needed)
  const tab = page.getByRole('tab', { name: /Running Extensions/i });
  await executeCommandWithCommandPalette(page, 'View: Close All Editors');
  await tab.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
};

/**
 * Ensure the secondary sidebar (auxiliary bar, typically used for Chat/Copilot) is hidden.
 * This is idempotent - only hides if currently visible, avoiding toggle state issues.
 * Useful to prevent keystrokes from going to chat input instead of editor.
 */
export const ensureSecondarySideBarHidden = async (page: Page): Promise<void> => {
  // VS Code's secondary sidebar is in the .part.auxiliarybar element
  const auxiliaryBar = page.locator('.part.auxiliarybar');

  // Check if sidebar exists and is visible
  // Use a short timeout to avoid hanging if it's not there
  const isVisible = await auxiliaryBar.isVisible({ timeout: 1000 }).catch(() => false);

  if (isVisible) {
    // Focus workbench before opening palette (avoids F1/keystrokes going to auxiliary bar chat input)
    await page.locator(WORKBENCH).click({ timeout: 5000 });
    // Use the explicit Hide command (not Toggle) to ensure we're hiding
    await executeCommandWithCommandPalette(page, 'View: Hide Secondary Side Bar');

    // Wait for it to actually hide
    await auxiliaryBar.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
      // Ignore error - may have been already hidden or command not available
    });
  }
};

/**
 * Runs `Workspaces: Close Workspace` so no folder is open (empty VS Code window).
 * Call after {@link waitForVSCodeWorkbench} / {@link closeWelcomeTabs} / {@link ensureSecondarySideBarHidden} if needed.
 */
export const closeWorkspaceToEmptyWindow = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Workspaces: Close Workspace');
  await waitForVSCodeWorkbench(page);
};

/**
 * From a desktop fixture that opened a workspace folder: prepare UI, then close the workspace so **no folder** is open.
 * Use when asserting palette commands with **no folder open**. Contrast: `createDesktopTest({ emptyWorkspace: true })` — a folder **is** open but has no `sfdx-project.json`.
 */
export const prepareNoFolderOpenForPaletteTests = async (page: Page): Promise<void> => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeWorkspaceToEmptyWindow(page);
  await closeWelcomeTabs(page);
};
