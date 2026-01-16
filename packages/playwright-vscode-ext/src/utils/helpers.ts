/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { WORKBENCH, TAB, TAB_CLOSE_BUTTON, QUICK_INPUT_WIDGET } from './locators';

type ConsoleError = { text: string; url?: string };
type NetworkError = { status: number; url: string; description: string };

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
  'punycode', // known jsforce and transitive dep deprecation by node
  'selectedStep', // VS Code internal walkthrough/tutorial state errors
  'onWillSaveTextDocument', // VS Code save event timeout (non-critical)
  'Throttler is disposed', // VS Code internal throttler lifecycle error (non-critical)
  'vscode-log:', // VS Code internal logging infrastructure errors
  'tasks.log', // VS Code tasks log file creation conflicts
  'theme-defaults/themes', // VS Code theme loading failures
  'light_modern.json', // VS Code theme file loading
  'Failed to fetch', // Generic fetch failures (often for optional resources)
  'NO_COLOR', // Node.js color env var warnings
  'Content Security Policy', // CSP violations from VS Code webviews (non-critical UI errors)
  'Applying inline style violates', // CSP inline style errors from VS Code UI
  'Unable to resolve resource walkThrough://' // VS Code walkthrough/getting started page errors (non-critical)
] as const;

const NON_CRITICAL_NETWORK_PATTERNS: readonly string[] = [
  'webPackagePaths.js',
  'workbench.web.main.nls.js',
  'marketplace.visualstudio.com',
  'vscode-unpkg.net', // VS Code extension marketplace CDN
  'scratchOrgInfo' // asking the org if it's a devhub during auth ?
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

/** Closes any visible Settings tabs */
export const closeSettingsTab = async (page: Page): Promise<void> => {
  const settingsTab = page
    .locator(TAB)
    .filter({ hasText: /Settings/i })
    .first();
  const isSettingsVisible = await settingsTab.isVisible().catch(() => false);
  if (isSettingsVisible) {
    const closeButton = settingsTab.locator(TAB_CLOSE_BUTTON);
    await closeButton.click();
    await settingsTab.waitFor({ state: 'detached', timeout: 5000 });
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
  });
};
