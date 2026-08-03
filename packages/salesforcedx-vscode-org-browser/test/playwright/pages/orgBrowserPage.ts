/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, Locator, expect, type FrameLocator } from '@playwright/test';
import { saveScreenshot, typingSpeed, waitForWorkspaceReady, TAB } from '@salesforce/playwright-vscode-ext';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';

/**
 * Exact tree-item name match, tolerant of VS Code's `"<label>, has actions"` suffix
 * (1.125+) on rows with hover actions. Matches "CustomObject", not "CustomObjectTranslation".
 */
const exactTreeItemName = (name: string): RegExp =>
  new RegExp(`^${name.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}(,|$)`);

/**
 * Page Object Model for the Org Browser extension in VS Code web
 * Encapsulates interactions with the Org Browser UI
 */
export class OrgBrowserPage {
  // Core elements
  public readonly page: Page;
  public readonly activityBarItem: Locator;
  public readonly sidebar: FrameLocator;

  constructor(page: Page) {
    this.page = page;

    // Core UI elements
    this.activityBarItem = page.locator('.activitybar a[aria-label*="Org Browser"]');
    this.sidebar = page.locator('iframe.webview.ready').last().contentFrame().locator('#active-frame').contentFrame();
  }

  public get showLocalToggle(): Locator {
    return this.sidebar.getByRole('checkbox', { name: 'Local' });
  }

  public get showOrgToggle(): Locator {
    return this.sidebar.getByRole('checkbox', { name: 'Org' });
  }

  public get filterInput(): Locator {
    return this.sidebar.getByRole('searchbox', { name: 'Filter metadata' });
  }

  /** Wait for the project file system to be loaded in Explorer */
  public async waitForProject(): Promise<void> {
    await waitForWorkspaceReady(this.page, 15_000);
  }

  /** Open the Org Browser by clicking its activity bar item */
  public async openOrgBrowser(): Promise<void> {
    await this.waitForProject();
    await expect(this.activityBarItem, 'Activity bar item for Org Browser should be visible').toBeVisible({
      timeout: 15_000
    });

    // Trigger navigation to Org Browser and wait for the types response
    await Promise.all([
      this.activityBarItem.click(),
      expect(this.sidebar.locator('#main'), 'Org Browser webview should be visible').toBeVisible({ timeout: 10_000 }),
      //  assert at least 5 top-level items are present
      expect(
        this.sidebar.getByRole('treeitem', { level: 1 }).nth(4),
        'Sidebar should have at least 5 metadata types'
      ).toBeVisible({ timeout: 60_000 })
    ]);

    await saveScreenshot(this.page, 'orgBrowserPage.openOrgBrowser.metadataTypesLoaded.png', true);
  }

  /**
   * True root-level type count via `aria-setsize` — VS Code sets this from the tree
   * model's full child count for the level, so it reflects the type list after the
   * provider's own filtering regardless of which rows are currently scrolled into view.
   * A DOM node count under-counts once the list exceeds the viewport, since virtualized
   * rows outside it are absent from the DOM entirely (not merely hidden).
   */
  public async getRootTypeCount(): Promise<number> {
    const firstRootItem = this.sidebar.getByRole('treeitem', { level: 1 }).first();
    if ((await firstRootItem.count()) === 0) return 0;
    const setSize = await firstRootItem.getAttribute('aria-setsize');
    return setSize === null ? 0 : Number(setSize);
  }

  /** Poll {@link getRootTypeCount} until it reaches `expected` (the tree re-fetches asynchronously after a filter toggle). */
  public async waitForRootTypeCount(expected: number, timeout = 10_000): Promise<void> {
    await expect.poll(() => this.getRootTypeCount(), { timeout }).toBe(expected);
  }

  /**
   * Snapshot the current root type count, tolerating the moment right after
   * `openOrgBrowser`/`expandFolder` where the previously-visible row can be
   * unmounted (virtualized list scroll) before the next row settles — a
   * `getRootTypeCount()` sampled exactly then would read 0 even though the
   * type list itself is non-empty.
   */
  public async getStableRootTypeCount(timeout = 10_000): Promise<number> {
    await expect.poll(() => this.getRootTypeCount(), { timeout }).toBeGreaterThan(0);
    return this.getRootTypeCount();
  }

  public async expandFolder(folderName: string, level?: number): Promise<void> {
    const folderItem = level
      ? this.sidebar.getByRole('treeitem', { name: exactTreeItemName(folderName), level })
      : this.sidebar.getByRole('treeitem', { name: exactTreeItemName(folderName) });
    if ((await folderItem.getAttribute('aria-expanded')) !== 'true') await folderItem.click({ timeout: 5000 });
    await expect(folderItem, 'Folder should show expanded state after metadata response').toHaveAttribute(
      'aria-expanded',
      'true',
      { timeout: 60_000 }
    );
    await expect(folderItem, 'Folder should finish loading').not.toHaveAttribute('aria-busy', 'true', {
      timeout: 60_000
    });
    await saveScreenshot(this.page, `expandFolder.${await folderItem.textContent()}.png`, true);
  }

  /**
   * Find a specific metadata type by name using type-to-search navigation
   * Much more reliable than scrolling in virtualized lists
   * @param typeName The name of the metadata type to find (e.g., 'CustomObject', 'Report')
   * @returns The locator for the found element, or null if not found
   */
  public async findMetadataType(typeName: string): Promise<Locator> {
    // Match the exact type at aria-level 1, tolerant of trailing accessible-name
    // decorations (e.g. ", has actions") but not sibling types like
    // CustomObjectTranslation. See exactTreeItemName.
    const metadataTypeLocator = this.sidebar.getByRole('treeitem', { level: 1, name: exactTreeItemName(typeName) });

    // Check if already visible
    if (await metadataTypeLocator.first().isVisible()) {
      return metadataTypeLocator.first();
    }

    await this.sidebar
      .getByRole('treeitem', {
        level: 1,
        includeHidden: true
      })
      .nth(1)
      .click();

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
    const metadataItem = this.sidebar.getByRole('treeitem', { level, name: exactTreeItemName(itemName) });

    // Check if already visible
    if (await metadataItem.first().isVisible({ timeout: 1000 })) {
      return metadataItem.first();
    }

    const retryableFind = (page: Page) =>
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
    const retrieveButton = item.getByRole('button', { name: /^Retrieve / }).first();

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
      .locator(TAB)
      .filter({
        hasNotText: /Welcome|Walkthrough|Get Started|Settings/
      })
      .first()
      .waitFor({ state: 'visible', timeout });
    await saveScreenshot(this.page, 'waitForFileToOpenInEditor.png', true);
  }
}
