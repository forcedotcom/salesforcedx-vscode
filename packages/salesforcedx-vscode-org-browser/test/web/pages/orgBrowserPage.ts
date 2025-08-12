/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, Locator } from '@playwright/test';
import { saveScreenshot } from '../shared/screenshotUtils';

/**
 * Page Object Model for the Org Browser extension in VS Code web
 * Encapsulates interactions with the Org Browser UI
 */
export class OrgBrowserPage {
  // Core elements
  public readonly page: Page;
  public readonly activityBarItem: Locator;
  public readonly sidebar: Locator;

  // Tree elements
  public readonly treeItems: Locator;

  // Notification elements
  public readonly errorNotifications: Locator;

  constructor(page: Page) {
    this.page = page;

    // Core UI elements
    this.activityBarItem = page.locator('.activitybar a[aria-label*="Org Browser"]');
    this.sidebar = page.locator(
      '.sidebar, #workbench\\.parts\\.sidebar, [role="complementary"], .part.sidebar, .monaco-sidebar'
    );

    // Tree elements
    this.treeItems = page.locator('[role="treeitem"], .monaco-list-row, .monaco-tree-row');

    // Notification elements - use broader selectors to catch all possible notifications
    this.errorNotifications = page.locator(
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
  }

  /**
   * Open the Org Browser by clicking its activity bar item
   */
  public async openOrgBrowser(): Promise<void> {
    // Wait for activity bar to be ready
    await this.activityBarItem.waitFor({ timeout: 15000 });
    console.log('🔍 Looking for Org Browser activity bar item...');

    // Click on the Org Browser tab
    await this.activityBarItem.click();
    console.log('✅ Clicked Org Browser activity bar item - switching from Explorer to Org Browser');

    // Wait for the view switch to complete and sidebar to open
    await this.sidebar.waitFor({ timeout: 10000 });
    console.log('✅ Sidebar opened');

    // Wait for tree items to load - look for actual tree rows instead of fixed timeout
    await this.page
      .waitForSelector('.monaco-list-row', {
        timeout: 15000,
        state: 'attached'
      })
      .catch(e => console.log('Waiting for tree items timed out:', e.message));

    // Additional check to ensure tree is populated
    const itemCount = await this.treeItems.count();
    if (itemCount > 0) {
      console.log(`✅ Tree loaded with ${itemCount} items`);
    } else {
      console.log('⚠️ Tree appears to be empty after waiting');
    }
  }

  /**
   * Find a specific metadata type by name using more idiomatic Playwright patterns
   * @param typeName The name of the metadata type to find (e.g., 'CustomObject', 'Account')
   * @param timeout Maximum time to wait for the element in ms (default: 15000)
   * @returns The locator for the found element, or null if not found
   */
  public async findMetadataType(typeName: string, timeout = 15000): Promise<Locator | null> {
    console.log(`Waiting for "${typeName}" to appear...`);

    try {
      // Use the more idiomatic approach: waitForSelector with text selector
      await this.page.waitForSelector(`text=${typeName}`, { timeout });
      console.log(`"${typeName}" appeared in the DOM`);

      // Get the tree item using filter for more precise matching
      const treeItem = this.treeItems.filter({ hasText: typeName });
      const count = await treeItem.count();

      if (count > 0) {
        console.log(`Found "${typeName}" using tree item search`);
        return treeItem.first();
      }
    } catch (error) {
      console.log(`Timeout waiting for "${typeName}" to appear: ${String(error)}`);
    }

    return null;
  }

  /**
   * Expand a metadata type by clicking on it
   */
  public async expandMetadataType(typeItem: Locator): Promise<void> {
    console.log('🔍 Attempting to expand tree item...');

    // Get the initial count of tree rows before expansion
    const initialRowCount = await this.page.locator('.monaco-list-row').count();

    // Click to expand
    await typeItem.click({ timeout: 5000 });
    console.log('✅ Successfully clicked tree item');

    // Wait for more rows to appear (indicating expansion)
    try {
      // Wait for the tree to update (either more rows or changed aria-expanded state)
      await Promise.race([
        // Option 1: Wait for more list rows to appear
        this.page.waitForFunction(
          data => document.querySelectorAll(data.selector).length > data.count,
          { selector: '.monaco-list-row', count: initialRowCount },
          { timeout: 5000 }
        ),

        // Option 2: Wait for a loading indicator to appear and disappear
        this.page
          .waitForSelector('.monaco-list-row[aria-busy="true"]', {
            state: 'visible',
            timeout: 2000
          })
          .then(() =>
            this.page.waitForSelector('.monaco-list-row[aria-busy="true"]', {
              state: 'hidden',
              timeout: 3000
            })
          )
          .catch(() => {})
      ]).catch(() => {
        // If neither option works, we'll check the count manually
        console.log('No visible expansion indicators detected');
      });

      // Verify expansion by comparing row counts
      const newRowCount = await this.page.locator('.monaco-list-row').count();
      if (newRowCount > initialRowCount) {
        console.log(`✅ Tree expanded: rows increased from ${initialRowCount} to ${newRowCount}`);
      } else {
        console.log('No change in row count detected, but continuing');
      }
    } catch {
      // If all waiting methods fail, fall back to a small timeout
      console.log('Could not detect expansion, continuing anyway');
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Check for error notifications in VS Code
   */
  public async getErrorNotifications(): Promise<string[]> {
    const errorCount = await this.errorNotifications.count();
    const errorTexts: string[] = [];

    if (errorCount > 0) {
      console.log(`Found ${errorCount} error notification(s):`);

      for (let i = 0; i < errorCount; i++) {
        const notification = this.errorNotifications.nth(i);

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
      const jsErrorTexts = await this.page.evaluate(() => {
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
  }

  /**
   * Take a screenshot of the current page state
   * @param fileName Name of the screenshot file (will be saved in test-results directory)
   * @param fullPage Whether to take a full page screenshot
   */
  public async takeScreenshot(fileName: string, fullPage = false): Promise<void> {
    const filePath = await saveScreenshot(this.page, fileName, fullPage);
    if (filePath) {
      console.log(`✅ Screenshot saved to ${filePath}`);
    } else {
      console.log('❌ Failed to save screenshot');
    }
  }

  /**
   * Get a specific metadata item under a metadata type
   * @param metadataType The parent metadata type (e.g., 'CustomObject', 'AIApplication')
   * @param itemName The specific metadata item name (e.g., 'Account', 'Broker__c')
   * @returns The locator for the metadata item
   */
  public async getMetadataItem(metadataType: string, itemName: string): Promise<Locator | null> {
    try {
      console.log(`Looking for metadata item "${itemName}" under "${metadataType}"`);

      // All metadata items are at aria-level >= 2 (metadata types are level 1)
      // Use a more specific selector for level 2+ elements containing the item name
      const metadataItem = this.page
        .locator(`.monaco-list-row[aria-label*="${itemName}"]`)
        .filter({ hasText: itemName })
        .first();

      const count = await metadataItem.count();

      if (count > 0) {
        // Verify this is actually a metadata item (level >= 2) not a metadata type
        const ariaLevel = await metadataItem.getAttribute('aria-level');
        const level = ariaLevel ? parseInt(ariaLevel, 10) : 0;

        if (level >= 2) {
          const text = await metadataItem.textContent();
          console.log(`Found metadata item: ${text?.trim()}`);
          return metadataItem;
        }
      }

      console.log(`Metadata item "${itemName}" not found under "${metadataType}"`);
      return null;
    } catch (error) {
      console.log(`Error finding metadata item "${itemName}" under "${metadataType}":`, error);
      return null;
    }
  }

  /**
   * Click the retrieve metadata button for a tree item
   * Uses both Playwright click and JavaScript click for reliability
   * @param item The locator for the tree item
   * @returns True if the button was clicked successfully, false otherwise
   */
  // eslint-disable-next-line class-methods-use-this
  public async clickRetrieveButton(item: Locator): Promise<boolean> {
    console.log('Attempting to click retrieve button');

    // First hover over the row to make action buttons visible
    await item.hover();
    console.log('✅ Hovered over row to reveal action buttons');

    // Find the retrieve button within this specific row
    const retrieveButton = item.locator('.action-label[aria-label="Retrieve Metadata"]').first();

    // Wait for the button to become visible after hover
    try {
      await retrieveButton.waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      console.log('❌ Retrieve button not visible after hover');
      return false;
    }

    // Log which row we're clicking
    const rowText = (await item.textContent()) ?? '';
    console.log(`Clicking retrieve button in row: ${rowText.trim().slice(0, 200)}`);

    try {
      // Click the retrieve button
      await retrieveButton.click({ force: true });
      console.log('✅ Successfully clicked retrieve button');
      return true;
    } catch (error) {
      console.log('❌ Failed to click retrieve button:', error);
      return false;
    }
  }

  /**
   * Check for progress notifications in VS Code
   * @returns Array of progress notification texts
   */
  public async getProgressNotifications(): Promise<string[]> {
    const progressSelectors = [
      '.monaco-workbench .notifications-toasts .notification-toast-container .notification-list-item',
      '.monaco-workbench .notifications-center .notification-list-item',
      '.notification-list-item:not(.error)'
    ];

    const progressNotifications = this.page.locator(progressSelectors.join(','));
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
  }

  /**
   * Wait for progress notification to appear
   * @param timeout Maximum time to wait in milliseconds
   * @returns True if notification appeared, false if timeout
   */
  public async waitForProgressNotificationToAppear(timeout: number): Promise<boolean> {
    try {
      // More idiomatic: wait for a selector with specific text content
      await this.page.waitForSelector('text=Retrieving', { timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for progress notification to disappear (indicating completion)
   * @param timeout Maximum time to wait in milliseconds
   * @returns True if notification disappeared, false if timeout
   */
  public async waitForProgressNotificationToDisappear(timeout = 30000): Promise<boolean> {
    try {
      // More idiomatic: wait for the notification element to be hidden
      const notification = this.page.locator('.notification-list-item:not(.error)');
      await notification.waitFor({ state: 'hidden', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for any file to open in the editor
   * @param timeout Maximum time to wait in milliseconds
   * @returns True if any file opened, false if timeout
   */
  public async waitForFileToOpenInEditor(timeout = 10000): Promise<boolean> {
    try {
      await this.page.waitForFunction(
        () => {
          const editorTabs = Array.from(document.querySelectorAll('.monaco-workbench .tabs-container .tab'));
          // Look for any tab that's not the welcome/walkthrough tab
          for (const tab of editorTabs) {
            const tabText = tab.textContent ?? '';
            // Skip welcome/walkthrough tabs
            if (!tabText.includes('Welcome') && !tabText.includes('Walkthrough') && !tabText.includes('Get Started')) {
              return true;
            }
          }
          return false;
        },
        { timeout }
      );
      return true;
    } catch {
      return false;
    }
  }
}
