/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, Locator, expect } from '@playwright/test';
/**
 * Page Object Model for the Org Browser extension in VS Code web
 * Encapsulates interactions with the Org Browser UI
 */

/**
 * Check for error notifications in VS Code
 */
export const getErrorNotifications = async (page: Page): Promise<string[]> => {
  // Notification elements - use broader selectors to catch all possible notifications
  const errorNotifications = page.locator(
    [
      // Standard notification selectors
      '.notifications-container .notification-list-item.error',
      '.notifications-container .notification-list-item-message[class*="error"]',
      // Additional selectors for better coverage
      '.monaco-workbench .notifications-toasts .notification-toast-container .notification-list-item',
      '.monaco-workbench .notifications-center .notification-list-item',
      '.notification-list-item-message'
    ].join(',')
  );
  const errorCount = await errorNotifications.count();
  const errorTexts: string[] = [];

  if (errorCount > 0) {
    console.log(`Found ${errorCount} error notification(s):`);

    for (let i = 0; i < errorCount; i++) {
      const notification = errorNotifications.nth(i);

      // Try to get text content
      const errorText = await notification.textContent();
      if (errorText) {
        errorTexts.push(errorText);
        console.log(`  Notification ${i + 1}: "${errorText}"`);
      }

      // Also try to get aria-label which might contain the error message
      const ariaLabel = await notification.getAttribute('aria-label');
      if (ariaLabel && !errorTexts.includes(ariaLabel)) {
        errorTexts.push(ariaLabel);
        console.log(`  Notification ${i + 1} aria-label: "${ariaLabel}"`);
      }
    }
  } else {
    console.log('No error notifications found with standard selectors');

    // Try to find notifications using JavaScript evaluation for more coverage
    const jsErrorTexts = await page.evaluate(() => {
      const errors: string[] = [];

      // Try various selectors that might contain error messages
      const selectors = [
        '.monaco-workbench .notification-list-item',
        '.monaco-workbench .notification-list-item-message',
        '.monaco-workbench .notifications-list-container .monaco-list-row',
        '.notification-toast .notification-list-item',
        '[role="alert"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (element.textContent) {
            errors.push(element.textContent);
          }
        });
      }

      return errors;
    });

    // Add any errors found via JavaScript
    for (const text of jsErrorTexts) {
      if (!errorTexts.includes(text)) {
        errorTexts.push(text);
      }
    }

    if (jsErrorTexts.length > 0) {
      console.log(`Found ${jsErrorTexts.length} notifications via JavaScript evaluation`);
    }
  }

  return errorTexts;
};

/**
 * Check for progress notifications in VS Code
 * @returns Array of progress notification texts
 */
export const getProgressNotifications = async (page: Page): Promise<string[]> => {
  const progressSelectors = [
    '.monaco-workbench .notifications-toasts .notification-toast-container .notification-list-item',
    '.monaco-workbench .notifications-center .notification-list-item',
    '.notification-list-item:not(.error)'
  ];

  const progressNotifications = page.locator(progressSelectors.join(','));
  const count = await progressNotifications.count();

  if (count === 0) {
    return [];
  }

  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    const notification = progressNotifications.nth(i);
    const text = await notification.textContent();
    if (text) {
      texts.push(text.trim());
    }
  }

  return texts;
};

/**
 * Wait for progress notification to appear
 * @param timeout Maximum time to wait in milliseconds
 * @returns True if notification appeared, false if timeout
 */
export const waitForRetrieveProgressNotificationToAppear = async (page: Page, timeout: number): Promise<Locator> => {
  const retrieving = page
    .locator('.monaco-workbench .notification-list-item')
    .filter({ hasText: /Retrieving\s+/i })
    .first();
  await expect(retrieving, 'Retrieving progress notification should be visible').toBeVisible({ timeout });
  return retrieving;
};

/**
 * Wait for progress notification to disappear (indicating completion)
 * @param timeout Maximum time to wait in milliseconds
 * @returns True if notification disappeared, false if timeout
 */
export const waitForProgressNotificationToDisappear = async (page: Page, timeout = 30000): Promise<boolean> => {
  try {
    // More idiomatic: wait for the notification element to be hidden
    const notification = page.locator('.notification-list-item:not(.error)');
    await notification.waitFor({ state: 'hidden', timeout });
    return true;
  } catch {
    return false;
  }
};
