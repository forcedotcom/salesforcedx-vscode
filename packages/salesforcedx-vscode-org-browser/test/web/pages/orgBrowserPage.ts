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
   * Wait for VS Code to fully load
   */
  public async waitForVSCodeLoad(timeout = 30000): Promise<void> {
    await this.page.waitForSelector('.monaco-workbench', { timeout });
    console.log('✅ VS Code workbench loaded');
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
   * Get all metadata types in the Org Browser
   */
  public async getAllMetadataTypes(): Promise<Locator[]> {
    return await this.treeItems.all();
  }

  /**
   * Find a specific metadata type by name
   * First waits for the element to appear, then locates it in the tree
   * @param typeName The name of the metadata type to find (e.g., 'CustomObject', 'Account')
   * @param timeout Maximum time to wait for the element in ms (default: 15000)
   * @returns The locator for the found element, or null if not found
   */
  public async findMetadataType(typeName: string, timeout = 15000): Promise<Locator | null> {
    console.log(`Waiting for "${typeName}" to appear...`);

    try {
      // First wait for the element to appear in the DOM
      await this.page.waitForSelector(`text=${typeName}`, { timeout });
      console.log(`"${typeName}" appeared in the DOM`);

      // Now find the specific element in the tree
      const allTypes = await this.getAllMetadataTypes();

      for (const item of allTypes) {
        const [text, ariaLabel, title] = await Promise.all([
          item.textContent(),
          item.getAttribute('aria-label'),
          item.getAttribute('title')
        ]);
        if (text?.includes(typeName) || ariaLabel?.includes(typeName) || title?.includes(typeName)) {
          console.log(`Found "${typeName}" using tree item search`);
          return item;
        }
      }

      console.log(`"${typeName}" was in DOM but not found in tree items`);
      return null;
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
      console.log(`Found ${errorCount} notification element(s):`);

      for (let i = 0; i < errorCount; i++) {
        const notification = this.errorNotifications.nth(i);

        // Try to get text content
        const errorText = await notification.textContent();
        if (errorText && !errorTexts.includes(errorText)) {
          errorTexts.push(errorText);
        }

        // Also try to get aria-label which might contain the error message
        const ariaLabel = await notification.getAttribute('aria-label');
        if (ariaLabel && !errorTexts.includes(ariaLabel)) {
          errorTexts.push(ariaLabel);
        }
      }

      // Log the unique notifications
      console.log(`Found ${errorTexts.length} unique notification(s):`);
      errorTexts.forEach((text, index) => {
        console.log(`  Notification ${index + 1}: "${text}"`);
      });
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
   * Hover over a tree item to reveal action buttons
   * Uses both Playwright hover and JavaScript event simulation for reliability
   * @param item The locator for the tree item to hover over
   */
  public async hoverToRevealActions(item: Locator): Promise<void> {
    console.log('Hovering over item to reveal action buttons');

    // First try standard hover with increased timeout
    await item.hover({ timeout: 5000 });
    await this.page.waitForTimeout(1000);

    // Then try JavaScript hover simulation for better reliability
    await this.page.evaluate(() => {
      const element = document.evaluate(
        '//*[contains(@class, "monaco-list-row") and contains(@class, "focused")]',
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;

      if (element instanceof HTMLElement) {
        // Dispatch mouseenter and mouseover events
        ['mouseenter', 'mouseover', 'mousemove'].forEach(eventType => {
          const event = new MouseEvent(eventType, {
            view: window,
            bubbles: true,
            cancelable: true
          });
          element.dispatchEvent(event);
        });
      }
    });

    // Wait a moment for the action buttons to appear
    await this.page.waitForTimeout(500);
  }

  /**
   * Find the "Retrieve Metadata" button for a tree item
   * @param item The locator for the tree item
   * @returns The locator for the Retrieve Metadata button, or null if not found
   */
  public async findRetrieveButton(item: Locator): Promise<Locator | null> {
    // Get the parent row of the item
    const row = item.locator('xpath=ancestor::div[contains(@class, "monaco-list-row")]').first();

    // Get all action buttons in the row
    const allActionButtons = await row.locator('.monaco-action-bar a.action-label').all();

    // Find the button with exact aria-label "Retrieve Metadata"
    for (let i = 0; i < allActionButtons.length; i++) {
      const label = (await allActionButtons[i].getAttribute('aria-label')) ?? '';
      if (label === 'Retrieve Metadata') {
        console.log(`Found Retrieve Metadata button at index ${i}`);
        // Use 'this' to reference the class to satisfy linter
        await this.page.evaluate(() => console.debug('Found retrieve button'));
        return allActionButtons[i];
      }
    }

    return null;
  }

  /**
   * Click the retrieve metadata button for a tree item
   * Uses both Playwright click and JavaScript click for reliability
   * @param item The locator for the tree item
   * @returns True if the button was clicked successfully, false otherwise
   */
  public async clickRetrieveButton(item: Locator): Promise<boolean> {
    // First hover to reveal the action buttons
    await this.hoverToRevealActions(item);

    // Find the retrieve button
    const retrieveButton = await this.findRetrieveButton(item);

    if (!retrieveButton) {
      console.log('❌ Could not find retrieve button with aria-label="Retrieve Metadata"');
      return false;
    }

    // Take a screenshot showing the hover state with retrieve button
    await this.takeScreenshot('hover-with-retrieve-button.png');

    // Try to click the button using JavaScript for reliability
    const itemText = await item.textContent();
    if (!itemText) {
      return false;
    }

    const success = await this.page.evaluate(text => {
      // Find the specific tree item first
      const treeItems = Array.from(document.querySelectorAll('.monaco-list-row'));
      let targetRow = null;

      for (const row of treeItems) {
        const rowText = row.textContent;
        if (rowText?.includes(text)) {
          targetRow = row;
          break;
        }
      }

      if (!targetRow) {
        return false;
      }

      // Find the retrieve button within this specific row
      const button = targetRow.querySelector('a.action-label[aria-label="Retrieve Metadata"]');

      if (!button || !(button instanceof HTMLElement)) {
        return false;
      }

      try {
        // Make button visible and click it
        button.style.visibility = 'visible';
        button.style.display = 'inline-block';
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';

        // Force into view and click
        button.scrollIntoView({ behavior: 'auto', block: 'center' });
        button.click();

        return true;
      } catch {
        return false;
      }
    }, itemText);

    return success;
  }
}
