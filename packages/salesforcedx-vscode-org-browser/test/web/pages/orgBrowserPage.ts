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
   * Wait for the project file system to be loaded in Explorer
   */
  private async waitForProject(): Promise<void> {
    // Wait for Explorer view

    try {
      await Promise.any(
        ['[aria-label*="Explorer"]', '.explorer-viewlet', '#workbench\\.parts\\.sidebar .explorer-folders-view'].map(
          selector => this.page.waitForSelector(selector, { state: 'visible', timeout: 15000 })
        )
      );
    } catch {
      throw new Error('Explorer view not found - file system may not be initialized');
    }

    // Wait for sfdx-project.json file

    try {
      await Promise.any(
        [
          'text=sfdx-project.json',
          '.monaco-list-row:has-text("sfdx-project.json")',
          '[aria-label*="sfdx-project.json"]'
        ].map(selector => this.page.waitForSelector(selector, { state: 'visible', timeout: 15000 }))
      );
    } catch {
      throw new Error('sfdx-project.json not found - Salesforce project may not be loaded');
    }
  }

  /**
   * Open the Org Browser by clicking its activity bar item
   */
  public async openOrgBrowser(): Promise<void> {
    await this.waitForProject();
    await this.activityBarItem.waitFor({ timeout: 15000 });
    await this.activityBarItem.click();
    await this.sidebar.waitFor({ timeout: 10000 });
    console.log('✅ Org Browser opened');

    // Ensure we have actual metadata types loaded (not just empty tree structure)
    await this.page.locator('[role="treeitem"][aria-level="1"]').first().waitFor({ timeout: 15000 });
    console.log('✅ Metadata types loaded');
  }

  public async expandFolder(folderItem: Locator): Promise<void> {
    console.log('🔍 Attempting to expand folder...');

    // Click to expand the folder
    await folderItem.click({ timeout: 5000 });
    console.log('✅ Successfully clicked folder item');

    try {
      await this.page
        .waitForSelector('.monaco-list-row[aria-busy="true"]', {
          state: 'visible',
          timeout: 5000
        })
        .then(() =>
          this.page.waitForSelector('.monaco-list-row[aria-busy="true"]', {
            state: 'hidden',
            timeout: 5000
          })
        )
        .catch(() => {
          console.log('No visible folder expansion indicators detected');
        });
    } catch {
      console.log('Could not detect folder expansion, continuing anyway');
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Find a specific metadata type by name using type-to-search navigation
   * Much more reliable than scrolling in virtualized lists
   * @param typeName The name of the metadata type to find (e.g., 'CustomObject', 'Report')
   * @returns The locator for the found element, or null if not found
   */
  public async findMetadataType(typeName: string): Promise<Locator> {
    console.log(`🔍 Looking for "${typeName}" metadata type using type-to-search...`);

    // Create a precise locator that matches exact tree items at aria-level 1
    const metadataTypeLocator = this.page.locator(
      `[role="treeitem"][aria-level="1"][aria-label="${typeName} "], [role="treeitem"][aria-level="1"][aria-label^="${typeName},"]`
    );

    // Check if already visible
    if (await metadataTypeLocator.first().isVisible({ timeout: 1000 })) {
      console.log(`✅ "${typeName}" already visible`);
      return metadataTypeLocator.first();
    }

    console.log(`"${typeName}" not visible, using type-to-search navigation...`);

    // Fallback: Use VS Code's type-to-search feature
    console.log('Using type-to-search navigation...');

    const treeContainer = this.page.locator('.monaco-list').first();

    // Click on the tree to focus it
    await treeContainer.click();
    console.log('✅ Focused tree container');

    await this.page.keyboard.type(typeName, { delay: 1 });
    console.log(`✅ Typed "${typeName}" to search`);

    // Wait a moment for the navigation to complete
    await this.page.waitForTimeout(500);

    // Check if the target element is now visible
    if (await metadataTypeLocator.first().isVisible({ timeout: 2000 })) {
      const foundText = await metadataTypeLocator.first().textContent();
      const foundLabel = await metadataTypeLocator.first().getAttribute('aria-label');
      console.log(`✅ "${typeName}" found via type-to-search: text="${foundText}", aria-label="${foundLabel}"`);
      return metadataTypeLocator.first();
    }

    throw new Error(`❌ "${typeName}" not found even with type-to-search`);
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
  public async getMetadataItem(metadataType: string, itemName: string, level = 2): Promise<Locator> {
    console.log(`Looking for metadata item "${itemName}" under "${metadataType}"`);

    // All metadata items are at aria-level >= 2 (metadata types are level 1)
    const metadataItem = this.page.getByRole('treeitem', { level, name: itemName });

    // Check if already visible
    if (await metadataItem.first().isVisible({ timeout: 1000 })) {
      console.log(`✅ "${itemName}" already visible`);
      return metadataItem.first();
    }

    await this.page.keyboard.type(itemName, { delay: 1 });
    console.log(`✅ Typed "${itemName}" to search`);

    if (await metadataItem.first().isVisible({ timeout: 2000 })) {
      const foundText = await metadataItem.first().textContent();
      const foundLabel = await metadataItem.first().getAttribute('aria-label');
      console.log(`✅ "${itemName}" found via type-to-search: text="${foundText}", aria-label="${foundLabel}"`);
      return metadataItem.first();
    }

    throw new Error(`❌ Metadata item "${itemName}" not found under "${metadataType}"`);
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

  /**
   * Find a folder within a foldered metadata type
   * @param metadataType The parent metadata type (e.g., 'Report', 'Dashboard')
   * @param folderName The folder name (e.g., 'unfiled$Public')
   * @returns The locator for the found folder, or null if not found
   */
  public async findFolder(metadataType: string, folderName: string): Promise<Locator | null> {
    debugger;
    console.log(`🔍 Looking for folder "${folderName}" under "${metadataType}"...`);

    // Create a precise locator that matches folder items at aria-level 2
    const folderLocator = this.page.locator(`[role="treeitem"][aria-level="2"][aria-label*="${folderName}"]`);

    // Check if already visible (most common case)
    if (await folderLocator.first().isVisible({ timeout: 1000 })) {
      console.log(`✅ Folder "${folderName}" already visible`);
      return folderLocator.first();
    }

    console.log(`Folder "${folderName}" not visible, using type-to-search...`);

    try {
      // Primary: Try scrollIntoViewIfNeeded for elements that exist in DOM
      await folderLocator.first().scrollIntoViewIfNeeded();
      console.log(`✅ Folder "${folderName}" found via scrollIntoViewIfNeeded`);
      return folderLocator.first();
    } catch {
      // Fallback: Use type-to-search for folders
      console.log('Using type-to-search for folder...');

      const treeContainer = this.page.locator('.monaco-list').first();

      // Click on the tree to focus it
      await treeContainer.click();
      console.log('✅ Focused tree container for folder search');

      // Type the first few characters of the folder name
      const searchTerm = folderName.startsWith('unfiled') ? 'unf' : folderName.substring(0, 3);
      await this.page.keyboard.type(searchTerm, { delay: 100 });
      console.log(`✅ Typed "${searchTerm}" to search for folder`);

      // Wait a moment for the navigation to complete
      await this.page.waitForTimeout(500);

      // Check if the target folder is now visible
      if (await folderLocator.first().isVisible({ timeout: 2000 })) {
        console.log(`✅ Folder "${folderName}" found via type-to-search`);
        return folderLocator.first();
      }

      console.log(`❌ Folder "${folderName}" not found even with type-to-search`);
      return null;
    }
  }
}
