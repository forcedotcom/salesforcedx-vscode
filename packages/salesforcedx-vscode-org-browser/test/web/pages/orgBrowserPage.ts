/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, Locator, expect } from '@playwright/test';
import { saveScreenshot } from '../shared/screenshotUtils';
import { typingSpeed } from '../utils/headless-helpers';

/**
 * Page Object Model for the Org Browser extension in VS Code web
 * Encapsulates interactions with the Org Browser UI
 */
export class OrgBrowserPage {
  // Core elements
  public readonly page: Page;
  public readonly activityBarItem: Locator;
  public readonly sidebar: Locator;

  // Notification elements
  public readonly errorNotifications: Locator;

  constructor(page: Page) {
    this.page = page;

    // Core UI elements
    this.activityBarItem = page.locator('.activitybar a[aria-label*="Org Browser"]');
    this.sidebar = page.locator(
      '.sidebar, #workbench\\.parts\\.sidebar, [role="complementary"], .part.sidebar, .monaco-sidebar'
    );

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
  public async waitForProject(): Promise<void> {
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
    await expect(this.activityBarItem, 'Activity bar item for Org Browser should be visible').toBeVisible({
      timeout: 15000
    });
    await this.activityBarItem.click();
    await expect(this.sidebar, 'Sidebar for Org Browser should be visible').toBeVisible({ timeout: 10000 });
    console.log('✅ Org Browser opened');

    await this.noProgressActivity();

    // Assert at least 5 top-level items are present
    await expect(this.page.locator('[role="treeitem"][aria-level="1"]').nth(4)).toBeVisible({ timeout: 15000 });
    await this.takeScreenshot('orgBrowserPage.openOrgBrowser.metadataTypesLoaded.png', true);
    console.log('✅ Metadata types loaded');
  }

  /** the progress bar at the top of the orgBrowser.  Use this to ensure that some action completed */
  public async noProgressActivity(): Promise<void> {
    await expect(this.page.locator('#workbench\.parts\.sidebar > div.content ').getByRole('progressbar')).toBeHidden({
      timeout: 15_000
    });
  }

  public async expandFolder(folderItem: Locator): Promise<void> {
    console.log('🔍 Attempting to expand folder...');
    // Click to expand the folder
    await folderItem.click({ timeout: 5000 });
    await this.noProgressActivity();
    console.log('✅ Successfully clicked folder item');
  }

  /**
   * Find a specific metadata type by name using type-to-search navigation
   * Much more reliable than scrolling in virtualized lists
   * @param typeName The name of the metadata type to find (e.g., 'CustomObject', 'Report')
   * @returns The locator for the found element, or null if not found
   */
  public async findMetadataType(typeName: string): Promise<Locator> {
    if (process.env.DEBUG_MODE) {
      await this.page.pause();
    }
    console.log(`🔍 Looking for "${typeName}" metadata type`);

    // Create a precise locator that matches exact tree items at aria-level 1
    const metadataTypeLocator = this.page.locator(
      `[role="treeitem"][aria-level="1"][aria-label="${typeName} "], [role="treeitem"][aria-level="1"][aria-label^="${typeName},"]`
    );

    // Check if already visible
    if (await metadataTypeLocator.first().isVisible()) {
      console.log(`✅ "${typeName}" already visible`);
      return metadataTypeLocator.first();
    }

    /** what's with all this crazy scrolling?  The element don't exist in the DOM unless they're visible on the page.
     * VSCod is doing weird stuff to create and destroy them and you can text search only after clicking one, but the click causes the expansion (mdapi-list)
     * which can change the state of what's on the screen.  So we use the algo
     * 1. find a visible element
     * 2. hover then scroll to top
     * 3. click the top element (which might open but probably won't)
     * 4. type the name of what you're really looking for
     * */
    console.log(`"${typeName}" not visible, using type-to-search navigation...`);

    let lastVisible5th: Locator | undefined;
    let visible5th: Locator | undefined;
    while (
      (await visible5th?.textContent()) !== (await lastVisible5th?.textContent()) ||
      lastVisible5th === undefined ||
      visible5th === undefined
    ) {
      lastVisible5th = visible5th;
      visible5th = this.page.locator('[role="treeitem"][aria-level="1"]').nth(5);
      await visible5th.hover();
      await this.page.mouse.wheel(0, -10_000);
      // I know, I know, but playwright says "NOTE Wheel events may cause scrolling if they are not handled, and this method does not wait for the scrolling to finish before returning."
      await this.page.waitForTimeout(50);
    }

    const firstElement = this.page.locator('[role="treeitem"][aria-level="1"]').first();

    await firstElement.click();
    console.log('✅ clicked on the tree to focus it');
    await this.page.keyboard.type(typeName, { delay: typingSpeed });

    console.log(`✅ Typed "${typeName}" to search`);

    // Wait a moment for the navigation to complete
    await this.page.waitForTimeout(500);

    // Check if the target element is now visible
    if (await metadataTypeLocator.first().isVisible({ timeout: 2000 })) {
      const foundText = await metadataTypeLocator.first().textContent();
      const foundLabel = await metadataTypeLocator.first().getAttribute('aria-label');
      console.log(`✅ "${typeName}" found via type-to-search: text="${foundText}", aria-label="${foundLabel}"`);
      await this.takeScreenshot(`orgBrowserPage.findMetadataType.${typeName}.png`, true);
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
    if (!filePath) {
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

    await this.page.keyboard.type(itemName, { delay: typingSpeed });
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

    await expect(retrieveButton, 'Retrieve button should be visible').toBeVisible({ timeout: 3000 });
    // Log which row we're clicking
    const rowText = (await item.textContent()) ?? '';
    console.log(`Clicking retrieve button in row: ${rowText.trim().slice(0, 200)}`);

    // Click the retrieve button
    await retrieveButton.click({ force: true });
    console.log('✅ Successfully clicked retrieve button');
    return true;
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
  public async waitForRetrieveProgressNotificationToAppear(timeout: number): Promise<Locator> {
    const retrieving = this.page
      .locator('.monaco-workbench .notification-list-item')
      .filter({ hasText: /Retrieving\s+/i })
      .first();
    await expect(retrieving, 'Retrieving progress notification should be visible').toBeVisible({ timeout });
    return retrieving;
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

  // TODO: pass in a file name you expect.  Or have a new method that just waits for that element to be visible
  /**
   * Wait for any file to open in the editor
   * @param timeout Maximum time to wait in milliseconds
   * @returns True if any file opened, false if timeout
   */
  public async waitForFileToOpenInEditor(timeout = 10000): Promise<boolean> {
    try {
      await this.page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('.monaco-workbench .tabs-container .tab'))
            .map(tab => tab.textContent ?? '')
            .filter(tab => tab !== '')
            .filter(
              // Look for any tab that's not the welcome/walkthrough tab
              tabText =>
                !tabText.includes('Welcome') &&
                !tabText.includes('Walkthrough') &&
                !tabText.includes('Get Started') &&
                !tabText.includes('Settings')
            ).length > 0,
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
      await this.page.keyboard.type(searchTerm, { delay: 5 });
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
