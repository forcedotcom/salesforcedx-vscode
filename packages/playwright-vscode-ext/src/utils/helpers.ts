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
  const isDesktop = process.env.VSCODE_DESKTOP === '1';
  if (isDesktop) {
    await page.waitForSelector(WORKBENCH, { timeout: 60_000 });
    return;
  }

  // Web: navigate if requested, then wait
  if (navigate) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector(WORKBENCH, { timeout: 60_000 });
};

/** Close VS Code Welcome/Walkthrough tabs if they're open */
export const closeWelcomeTabs = async (page: Page): Promise<void> => {
  // Close any open Quick Input widgets first (they can intercept clicks)
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  const isQuickInputVisible = await quickInput.isVisible({ timeout: 1000 }).catch(() => false);
  if (isQuickInputVisible) {
    await page.keyboard.press('Escape');
    await quickInput.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
  }

  const isDesktop = process.env.VSCODE_DESKTOP === '1';
  
  // Ensure workbench is focused before closing tabs
  const workbench = page.locator(WORKBENCH);
  await workbench.click({ timeout: 5000 }).catch(() => {});
  
  // On desktop, also click the editor area directly to ensure focus
  if (isDesktop) {
    const { EDITOR } = await import('./locators.js');
    const editorArea = page.locator(`.editor-container, ${EDITOR}, [id="workbench.parts.editor"]`);
    await editorArea.first().click({ timeout: 2000, force: true }).catch(() => {});
    // Wait for workbench to be visible to ensure focus has settled
    await expect(workbench).toBeVisible({ timeout: 1000 }).catch(() => {});
  }

  // Wait for tab container to be ready before checking for welcome tabs
  const tabContainer = page.locator('.tabs-container');
  await tabContainer.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});

  // Loop to close all welcome/walkthrough tabs (there may be multiple)
  let attempts = 0;
  const maxAttempts = 15;

  while (attempts < maxAttempts) {
    // Re-query tabs each iteration to avoid stale element issues
    const welcomeTabs = page.locator(TAB).filter({ hasText: /Welcome|Walkthrough/i });
    const count = await welcomeTabs.count();
    
    if (count === 0) {
      // Wait for tab container to stabilize to ensure no new tabs appear
      await tabContainer.waitFor({ state: 'attached', timeout: 2000 }).catch(() => {});
      // Double-check after waiting
      const finalCount = await welcomeTabs.count();
      if (finalCount === 0) {
        // Verify tabs are actually gone by checking DOM directly
        const allTabs = page.locator(TAB);
        const allTabTexts = await allTabs.allTextContents();
        const hasWelcomeTab = allTabTexts.some(text => /Welcome|Walkthrough/i.test(text));
        if (!hasWelcomeTab) {
          break;
        }
      }
    }

    // Close any Quick Input widgets that may have appeared
    const quickInputVisible = await quickInput.isVisible({ timeout: 500 }).catch(() => false);
    if (quickInputVisible) {
      await page.keyboard.press('Escape');
      await quickInput.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});
    }

    // Ensure workbench is focused before closing tabs - click in the editor area to ensure focus
    await workbench.click({ timeout: 5000 }).catch(() => {});
    // On desktop, also try clicking the editor area directly to ensure focus
    const { EDITOR } = await import('./locators.js');
    const editorArea = page.locator(`.editor-container, ${EDITOR}`);
    await editorArea.first().click({ timeout: 2000, force: true }).catch(() => {});

    // Re-query to get fresh tab reference
    const currentWelcomeTabs = page.locator(TAB).filter({ hasText: /Welcome|Walkthrough/i });
    const currentCount = await currentWelcomeTabs.count();
    if (currentCount === 0) {
      attempts++;
      continue;
    }

    const welcomeTab = currentWelcomeTabs.first();
    
    // Wait for tab to be attached (exists in DOM)
    const tabAttached = await welcomeTab.waitFor({ state: 'attached', timeout: 5000 }).catch(() => false);
    if (!tabAttached) {
      attempts++;
      continue;
    }

    // Ensure Quick Input is closed before interacting with tabs
    const quickInputStillVisible = await quickInput.isVisible({ timeout: 500 }).catch(() => false);
    if (quickInputStillVisible) {
      await page.keyboard.press('Escape');
      await quickInput.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});
    }

    // Select the tab first to ensure it's active - use force: true on desktop for reliability
    await workbench.click({ timeout: 2000 }).catch(() => {});
    await welcomeTab.click({ timeout: 5000, force: isDesktop });
    // Wait for tab to be selected - this is critical for closing to work
    await expect(welcomeTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });

    // Try close button first (more reliable than keyboard shortcut)
    const closeButton = welcomeTab.locator(TAB_CLOSE_BUTTON);
    const closeButtonVisible = await closeButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (closeButtonVisible) {
      // Ensure tab is still selected before clicking close button
      await welcomeTab.click({ timeout: 2000, force: isDesktop }).catch(() => {});
      // On desktop, use evaluate() to click close button directly for better reliability
      if (isDesktop) {
        // Use evaluate() to click close button directly, bypassing Playwright's visibility checks
        await closeButton.evaluate((el: HTMLElement) => el.click()).catch(
          () => closeButton.click({ timeout: 5000, force: true })
        );
      } else {
        await closeButton.click({ timeout: 5000 });
      }
      // Wait for tab to be fully removed from DOM - use longer timeout for CI
      const tabDetached = await welcomeTab.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => false);
      if (!tabDetached) {
        // If close button didn't work, try keyboard shortcut as fallback
        await workbench.click({ timeout: 1000 }).catch(() => {});
        await welcomeTab.click({ timeout: 1000, force: isDesktop }).catch(() => {});
        await page.keyboard.press('Control+w');
        await welcomeTab.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
      }
    } else {
      // Fall back to keyboard shortcut if close button not visible
      // Ensure workbench has focus before using keyboard shortcut
      await workbench.click({ timeout: 2000 }).catch(() => {});
      await welcomeTab.click({ timeout: 1000, force: isDesktop }).catch(() => {});
      await page.keyboard.press('Control+w');
      // Wait for tab to be detached - use longer timeout for CI
      await welcomeTab.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
    }

    // Wait for tab container to update before checking for more tabs
    await tabContainer.waitFor({ state: 'attached', timeout: 2000 }).catch(() => {});
    
    // Verify the tab was actually closed - re-query to avoid stale references
    const verifyTabs = page.locator(TAB).filter({ hasText: /Welcome|Walkthrough/i });
    const remainingCount = await verifyTabs.count();
    if (remainingCount === 0) {
      // Tab was closed successfully - wait a bit more to ensure no new tabs appear
      await tabContainer.waitFor({ state: 'attached', timeout: 2000 }).catch(() => {});
      const finalVerify = page.locator(TAB).filter({ hasText: /Welcome|Walkthrough/i });
      const finalCount = await finalVerify.count();
      if (finalCount === 0) {
        // Verify by checking all tab texts
        const allTabs = page.locator(TAB);
        const allTabTexts = await allTabs.allTextContents();
        const hasWelcomeTab = allTabTexts.some(text => /Welcome|Walkthrough/i.test(text));
        if (!hasWelcomeTab) {
          break; // Successfully closed all welcome tabs
        }
      }
    }
    
    attempts++;
  }
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
    await settingsTab.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
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
