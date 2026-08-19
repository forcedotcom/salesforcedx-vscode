/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, Locator, expect } from '@playwright/test';
import {
  activeQuickInputTextField,
  saveScreenshot,
  typingSpeed,
  waitForWorkspaceReady,
  TAB
} from '@salesforce/playwright-vscode-ext';

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
    await waitForWorkspaceReady(this.page, 60_000);
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
      expect(this.sidebar, 'Sidebar for Org Browser should be visible').toBeVisible({ timeout: 10_000 }),
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

  /** Open the text-filter prompt and fill it, retrying if VS Code replaces the Quick Input widget. */
  public async fillTextFilter(value: string): Promise<void> {
    const input = activeQuickInputTextField(this.page);

    await expect(async () => {
      if (!(await input.isVisible().catch(() => false))) {
        const filterButton = this.page
          .locator('[aria-label="Filter by Type/Component"], [aria-label="Edit Filter (active)"]')
          .filter({ visible: true })
          .first();
        await expect(filterButton).toBeVisible({ timeout: 5000 });
        await filterButton.click();
      }

      await expect(input).toBeVisible({ timeout: 5000 });
      await input.fill(value, { force: true });
      await expect(input).toHaveValue(value, { timeout: 5000 });
    }).toPass({ timeout: 30_000, intervals: [250, 500, 1000] });
  }

  /** Fill and commit the text filter, retrying the complete interaction if its prompt closes early. */
  public async applyTextFilter(value: string): Promise<void> {
    const input = activeQuickInputTextField(this.page);

    await expect(async () => {
      await this.fillTextFilter(value);
      await this.page.keyboard.press('Enter');
      await expect(input).toBeHidden({ timeout: 5000 });
    }).toPass({ timeout: 30_000, intervals: [250, 500, 1000] });
  }

  public async expandFolder(folderName: string, level?: number): Promise<void> {
    const folderItem = (
      level
        ? this.sidebar.getByRole('treeitem', { name: exactTreeItemName(folderName), level })
        : this.sidebar.getByRole('treeitem', { name: exactTreeItemName(folderName) })
    ).first();

    // A catalog-backed expansion can briefly collapse again when its first discovery
    // snapshot is empty. Re-drive the twistie until a completed discovery leaves the
    // node expanded instead of waiting forever on the result of a single click.
    await expect(async () => {
      await expect(folderItem, `${folderName} should be visible`).toBeVisible({ timeout: 5000 });
      if ((await folderItem.getAttribute('aria-expanded')) !== 'true') {
        await folderItem.locator('.monaco-tl-twistie').click({ timeout: 5000 });
      }
      await expect(folderItem, `${folderName} should be expanded`).toHaveAttribute('aria-expanded', 'true', {
        timeout: 5000
      });
      await expect(folderItem.locator('.monaco-tl-twistie'), `${folderName} should finish loading`).not.toContainClass(
        'codicon-tree-item-loading',
        { timeout: 10_000 }
      );
    }).toPass({ timeout: 60_000, intervals: [1000, 2000, 3000] });

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

    // Focus the expanded parent before type-ahead. Catalog refreshes can replace the
    // focused row, so retry both expansion and navigation until the requested child
    // is present in the virtualized tree.
    await expect(async () => {
      await this.expandFolder(metadataType, level - 1);
      const parent = this.sidebar
        .getByRole('treeitem', { level: level - 1, name: exactTreeItemName(metadataType) })
        .first();
      await parent.focus();
      await this.page.waitForTimeout(1000);
      await this.page.keyboard.type(itemName, { delay: typingSpeed });
      await expect(
        metadataItem.first(),
        `Metadata item "${itemName}" should be available under "${metadataType}" after discovery`
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 60_000, intervals: [1000, 2000, 3000] });
    await saveScreenshot(this.page, `getMetadataItem.${metadataType}.${itemName}.png`, true);
    return metadataItem.first();
  }

  /**
   * Click the retrieve metadata button for a tree item
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
    // Keep Playwright's actionability checks: a forced click can target a row while VS Code is replacing
    // it during a tree refresh, causing the menu command to be invoked without its tree-item argument.
    await retrieveButton.click();
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
