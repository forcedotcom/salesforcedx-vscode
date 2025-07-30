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

    // Notification elements
    this.errorNotifications = page.locator(
      '.notifications-container .notification-list-item.error, .notifications-container .notification-list-item-message[class*="error"]'
    );
  }

  /**
   * Wait for VS Code to fully load
   */
  public async waitForVSCodeLoad(timeout = 30000): Promise<void> {
    await this.page.waitForSelector('.monaco-workbench', { timeout });
    console.log('✅ VS Code workbench loaded');
  }

  /**
   * Open the Org Browser by clicking its activity bar item
   */
  public async open(): Promise<void> {
    // Wait for activity bar to be ready
    await this.activityBarItem.waitFor({ timeout: 15000 });
    console.log('🔍 Looking for Org Browser activity bar item...');

    // Click on the Org Browser tab
    await this.activityBarItem.click();
    console.log('✅ Clicked Org Browser activity bar item - switching from Explorer to Org Browser');

    // Wait for the view switch to complete and sidebar to open
    await this.sidebar.waitFor({ timeout: 10000 });
    console.log('✅ Sidebar opened');

    // Wait for tree items to load
    await this.page.waitForTimeout(5000);
  }

  /**
   * Get all metadata types in the Org Browser
   */
  public async getAllMetadataTypes(): Promise<Locator[]> {
    return await this.treeItems.all();
  }

  /**
   * Find a specific metadata type by name
   */
  public async findMetadataType(typeName: string): Promise<Locator | null> {
    const allTypes = await this.getAllMetadataTypes();

    for (const item of allTypes) {
      const text = await item.textContent();
      const ariaLabel = await item.getAttribute('aria-label');
      const title = await item.getAttribute('title');

      if (text?.includes(typeName) || ariaLabel?.includes(typeName) || title?.includes(typeName)) {
        return item;
      }
    }

    return null;
  }

  /**
   * Expand a metadata type by clicking on it
   */
  public async expandMetadataType(typeItem: Locator): Promise<void> {
    console.log('🔍 Attempting to expand tree item...');
    await typeItem.click({ timeout: 5000 });
    console.log('✅ Successfully clicked tree item');

    // Wait for expansion/loading
    await this.page.waitForTimeout(1000);
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
        const errorText = await this.errorNotifications.nth(i).textContent();
        if (errorText) {
          errorTexts.push(errorText);
        }
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
}
