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

  constructor(page: Page) {
    this.page = page;

    // Core UI elements
    this.activityBarItem = page.locator('.activitybar a[aria-label*="Org Browser"]');
    this.sidebar = page.locator(
      '.sidebar, #workbench\\.parts\\.sidebar, [role="complementary"], .part.sidebar, .monaco-sidebar'
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
    await expect(this.sidebar, 'Sidebar for Org Browser should be visible').toBeVisible({ timeout: 10_000 });

    await this.noProgressActivity();

    // Assert at least 5 top-level items are present
    await expect(this.page.locator('[role="treeitem"][aria-level="1"]').nth(4)).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(this.page, 'orgBrowserPage.openOrgBrowser.metadataTypesLoaded.png', true);
    console.log('✅ Metadata types loaded');
  }

  /** the progress bar at the top of the orgBrowser.  Use this to ensure that some action completed */
  public async noProgressActivity(): Promise<void> {
    await Promise.race([this.ProgressActivity(), this.page.waitForTimeout(500)]); // give it a half second to start before waiting for it to stop
    await expect(
      this.page.locator('#workbench\.parts\.sidebar > div.content ').getByRole('progressbar', { includeHidden: true })
    ).toBeHidden({
      timeout: 15_000
    });
  }

  public async ProgressActivity(): Promise<void> {
    await expect(
      this.page.locator('#workbench\.parts\.sidebar > div.content ').getByRole('progressbar', { includeHidden: true })
    ).toBeVisible({
      timeout: 15_000
    });
  }

  public async expandFolder(folderItem: Locator): Promise<void> {
    console.log('🔍 Attempting to expand folder...');
    // Click to expand the folder
    await folderItem.click({ timeout: 5000 });
    await this.noProgressActivity();
    await this.page.mouse.wheel(0, this.page.viewportSize()?.height ?? 1080 * 0.75);

    console.log('✅ Successfully clicked folder item');
  }

  /**
   * Find a specific metadata type by name using type-to-search navigation
   * Much more reliable than scrolling in virtualized lists
   * @param typeName The name of the metadata type to find (e.g., 'CustomObject', 'Report')
   * @returns The locator for the found element, or null if not found
   */
  public async findMetadataType(typeName: string): Promise<Locator> {
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
    const secondType = this.page.locator('[role="treeitem"][aria-level="1"]').nth(1);

    await secondType.click();
    console.log('✅ clicked on the tree to focus it');
    await this.noProgressActivity(); // me might have kick off a md-list by clicking on whatever was there in the list
    await this.page.keyboard.type(typeName, { delay: typingSpeed });

    console.log(`✅ Typed "${typeName}" to search`);

    // Wait a moment for the navigation to complete
    await this.page.waitForTimeout(500);

    // Check if the target element is now visible
    if (await metadataTypeLocator.first().isVisible({ timeout: 2000 })) {
      const foundText = await metadataTypeLocator.first().textContent();
      const foundLabel = await metadataTypeLocator.first().getAttribute('aria-label');
      console.log(`✅ "${typeName}" found via type-to-search: text="${foundText}", aria-label="${foundLabel}"`);
      await saveScreenshot(this.page, `orgBrowserPage.findMetadataType.${typeName}.png`, true);
      return metadataTypeLocator.first();
    }
    throw new Error(`❌ "${typeName}" not found even with type-to-search`);
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
    // First hover over the row to make action buttons visible
    await item.hover();

    // Find the retrieve button within this specific row
    const retrieveButton = item.locator('.action-label[aria-label="Retrieve Metadata"]').first();

    await expect(retrieveButton, 'Retrieve button should be visible').toBeVisible({ timeout: 3000 });
    // Log which row we're clicking
    console.log(`Clicking retrieve button in row: ${((await item.textContent()) ?? '').trim().slice(0, 200)}`);

    // Click the retrieve button
    await retrieveButton.click({ force: true });
    return true;
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
