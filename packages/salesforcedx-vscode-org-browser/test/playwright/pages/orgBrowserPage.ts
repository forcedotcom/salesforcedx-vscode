/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, Locator, expect } from '@playwright/test';
import { saveScreenshot, typingSpeed, waitForWorkspaceReady } from '@salesforce/playwright-vscode-ext';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import { isDesktop } from '../fixtures';

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

  /** Wait for the project file system to be loaded in Explorer */
  public async waitForProject(): Promise<void> {
    await waitForWorkspaceReady(this.page, 15_000);
  }

  /**
   * Open the Org Browser by clicking its activity bar item
   */
  public async openOrgBrowser(): Promise<void> {
    await this.waitForProject();
    await expect(this.activityBarItem, 'Activity bar item for Org Browser should be visible').toBeVisible({
      timeout: 15_000
    });

    // Trigger navigation to Org Browser and wait for the types response
    await Promise.all([
      this.awaitMdapiResponse(),
      this.activityBarItem.click(),
      expect(this.sidebar, 'Sidebar for Org Browser should be visible').toBeVisible({ timeout: 10_000 }),
      //  assert at least 5 top-level items are present
      expect(
        this.sidebar.getByRole('treeitem', { level: 1 }).nth(4),
        'Sidebar should have at least 5 metadata types'
      ).toBeVisible({ timeout: 30_000 })
    ]);

    await saveScreenshot(this.page, 'orgBrowserPage.openOrgBrowser.metadataTypesLoaded.png', true);
  }

  public async expandFolder(folderName: string): Promise<void> {
    const folderItem = this.page.getByRole('treeitem', { name: folderName, exact: true });
    const twistie = folderItem.locator('.monaco-tl-twistie');
    await Promise.all([
      folderItem.click({ timeout: 5000, delay: 100 }),
      // we need it to go from loading to expanded state
      ...(isDesktop
        ? [
            expect(twistie, 'Went to loading state')
              .toContainClass('codicon-tree-item-loading', { timeout: 2000 })
              .catch(() => undefined) // allow it to continue if it never hit loading state, but we at least delayed it before coming back to
          ]
        : [this.awaitMdapiResponse()])
    ]);
    // ensure it's done loading
    await expect(twistie, 'should finish loading').not.toContainClass('codicon-tree-item-loading', { timeout: 60_000 });
    if (await twistie.evaluate(el => el.classList.contains('collapsed'))) {
      await folderItem.click();
    }
    await expect(twistie, 'should finish loading').not.toContainClass('codicon-tree-item-loading', { timeout: 60_000 });

    await expect(twistie, 'Folder twistie should show expanded state after metadata response').toContainClass(
      'codicon-tree-item-expanded',
      { timeout: 6000 }
    );

    // there's an ugly scenario where the expand happens but none of the children are on the screen so you can't search them properly.
    await this.page.mouse.wheel(0, 50);
    await this.page.waitForTimeout(50);

    // locators get messed up because of the scroll
    const folderItemAgain = this.page.getByRole('treeitem', { name: folderName, exact: true });
    const twistieAgain = folderItemAgain.locator('.monaco-tl-twistie');

    // tapping to refocus;  But that also closes it.  So we need to tap twice to reopen and ensure it's open
    await Promise.all([
      folderItemAgain.click(),
      expect(twistieAgain, 'should be collapsed after scrolling').toContainClass('collapsed')
    ]);

    await expect(twistieAgain, 'should not be loading after collapse loading').not.toContainClass(
      'codicon-tree-item-loading'
    );

    await Promise.all([
      folderItemAgain.click(),
      expect(twistieAgain, 'should not be collapssed').not.toContainClass('collapsed')
    ]);

    await saveScreenshot(this.page, `expandFolder.${await folderItemAgain.textContent()}.png`, true);
  }

  public async awaitMdapiResponse(): Promise<void> {
    if (!isDesktop) {
      await this.page.waitForResponse(
        response => /\/services\/Soap\/m\/\d+\.0/.test(response.url()) && response.status() === 200,
        { timeout: 30_000 }
      );
    }
  }

  /**
   * Find a specific metadata type by name using type-to-search navigation
   * Much more reliable than scrolling in virtualized lists
   * @param typeName The name of the metadata type to find (e.g., 'CustomObject', 'Report')
   * @returns The locator for the found element, or null if not found
   */
  public async findMetadataType(typeName: string): Promise<Locator> {
    // Create a precise locator that matches exact tree items at aria-level 1
    const metadataTypeLocator = this.sidebar.getByRole('treeitem', { level: 1 }).filter({ hasText: typeName });

    // Check if already visible
    if (await metadataTypeLocator.first().isVisible()) {
      return metadataTypeLocator.first();
    }

    await Promise.all([
      this.awaitMdapiResponse(),
      this.sidebar
        .getByRole('treeitem', {
          level: 1,
          includeHidden: true
        })
        .nth(1)
        .click()
    ]);

    await this.page.waitForTimeout(700);
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
    const metadataItem = this.sidebar.getByRole('treeitem', { level, name: itemName, exact: true });

    // Check if already visible
    if (await metadataItem.first().isVisible({ timeout: 1000 })) {
      return metadataItem.first();
    }

    const retryableFind = (page: Page): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        yield* Effect.promise(() => page.waitForTimeout(1000));
        yield* Effect.promise(() => page.keyboard.type(itemName, { delay: typingSpeed }));
        yield* Effect.tryPromise({
          try: () =>
            expect(metadataItem.first()).toBeVisible({
              timeout: 500
            }),
          catch: () => new Error(`❌ Metadata item "${itemName}" not found under "${metadataType}"`)
        });
      });

    // Limit retries to prevent infinite loops (30 retries = ~15 seconds)
    await Effect.runPromise(Effect.retry(retryableFind(this.page), Schedule.recurs(30)));
    await saveScreenshot(this.page, `getMetadataItem.${metadataType}.${itemName}.png`, true);
    return metadataItem.first();
  }

  /**
   * Click the retrieve metadata button for a tree item
   * Uses both Playwright click and JavaScript click for reliability
   * @param item The locator for the tree item
   * @returns True if the button was clicked successfully, false otherwise
   */

  public async clickRetrieveButton(item: Locator): Promise<boolean> {
    // First hover over the row to make action buttons visible
    await item.hover();

    // Find the retrieve button within this specific row
    const retrieveButton = item.locator('.action-label[aria-label="Retrieve Metadata"]').first();

    await expect(retrieveButton, 'Retrieve button should be visible').toBeVisible({ timeout: 3000 });
    await saveScreenshot(this.page, 'clickRetrieveButton.png', true);
    // Click the retrieve button
    await retrieveButton.click({ force: true });
    return true;
  }

  // TODO: pass in a file name you expect.  Or have a new method that just waits for that element to be visible
  /**
   * Wait for any file to open in the editor
   * @param timeout Maximum time to wait in milliseconds
   * throws if no file opens
   */
  public async waitForFileToOpenInEditor(timeout = 10_000): Promise<void> {
    await this.page
      .locator('.monaco-workbench .tabs-container .tab')
      .filter({
        hasNotText: /Welcome|Walkthrough|Get Started|Settings/
      })
      .first()
      .waitFor({ state: 'visible', timeout });
    await saveScreenshot(this.page, 'waitForFileToOpenInEditor.png', true);
  }
}
