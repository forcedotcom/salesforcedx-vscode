/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, Locator, expect } from '@playwright/test';
import { saveScreenshot } from '../shared/screenshotUtils';
import { typingSpeed } from '../utils/headless-helpers';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';

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
    // Wait for the backend metadata types request to complete (SOAP metadata list)
    const typesResp = this.page.waitForResponse(
      resp => /\/services\/Soap\/m\/\d+\.0/.test(resp.url()) && resp.status() === 200,
      { timeout: 30_000 }
    );

    // Trigger navigation to Org Browser and wait for the types response
    await Promise.all([typesResp, this.activityBarItem.click()]);

    await expect(this.sidebar, 'Sidebar for Org Browser should be visible').toBeVisible({ timeout: 10_000 });

    // Now assert at least 5 top-level items are present
    await expect(
      this.page.locator('[role="treeitem"][aria-level="1"]').nth(4),
      'Sidebar should have at least 5 metadata types'
    ).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(this.page, 'orgBrowserPage.openOrgBrowser.metadataTypesLoaded.png', true);
  }

  public async expandFolder(folderItem: Locator): Promise<void> {
    // Start waiting for the response, then click to trigger it.
    await Promise.all([
      this.awaitMdapiResponse(),
      folderItem.click({ timeout: 5000 }),
      expect(
        folderItem.locator('.monaco-tl-twistie'),
        'Folder twistie should show expanded state after metadata response'
      ).toContainClass('codicon-tree-item-expanded', { timeout: 6_000 })
    ]);
  }

  public async awaitMdapiResponse(): Promise<void> {
    await this.page.waitForResponse(
      response => /\/services\/Soap\/m\/\d+\.0/.test(response.url()) && response.status() === 200,
      { timeout: 30_000 }
    );
  }

  /**
   * Find a specific metadata type by name using type-to-search navigation
   * Much more reliable than scrolling in virtualized lists
   * @param typeName The name of the metadata type to find (e.g., 'CustomObject', 'Report')
   * @returns The locator for the found element, or null if not found
   */
  public async findMetadataType(typeName: string): Promise<Locator> {
    // Create a precise locator that matches exact tree items at aria-level 1
    const metadataTypeLocator = this.page.locator(
      `[role="treeitem"][aria-level="1"][aria-label="${typeName} "], [role="treeitem"][aria-level="1"][aria-label^="${typeName},"]`
    );

    // Check if already visible
    if (await metadataTypeLocator.first().isVisible()) {
      return metadataTypeLocator.first();
    }

    await Promise.all([
      this.awaitMdapiResponse(),
      this.page.locator('[role="treeitem"][aria-level="1"]').nth(1).click()
    ]);

    await this.page.keyboard.type(typeName, { delay: typingSpeed });

    // Check if the target element is now visible
    if (await metadataTypeLocator.first().isVisible({ timeout: 3000 })) {
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
    // All metadata items are at aria-level >= 2 (metadata types are level 1)
    const metadataItem = this.page.getByRole('treeitem', { level, name: itemName, exact: true });

    // Check if already visible
    if (await metadataItem.first().isVisible({ timeout: 1000 })) {
      return metadataItem.first();
    }

    const retryableFind = (page: Page): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        yield* Effect.promise(() => page.keyboard.type(itemName, { delay: typingSpeed }));
        yield* Effect.tryPromise({
          try: () =>
            expect(metadataItem.first()).toBeVisible({
              timeout: 500
            }),
          catch: () => new Error(`❌ Metadata item "${itemName}" not found under "${metadataType}"`)
        });
      });

    await Effect.runPromise(Effect.retry(retryableFind(this.page), Schedule.fixed('500 millis')));

    return metadataItem.first();
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
}
