/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page, Locator, expect } from '@playwright/test';
import { saveScreenshot } from '../shared/screenshotUtils';
import { typingSpeed } from '../utils/helpers';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import { isDesktop } from '../fixtures';
import { waitForRetrieveProgressNotificationToAppear } from './notifications';

/**
 * Command metadata from package.json
 * Maps command IDs to their icons and state information
 */
type CommandMetadata = {
  commandId: string;
  icon: string | { light: string; dark: string };
  activeIcon?: string; // Icon when command represents active state
};

/**
 * Page Object Model for the Org Browser extension in VS Code web
 * Encapsulates interactions with the Org Browser UI
 */
export class OrgBrowserPage {
  // Core elements
  public readonly page: Page;
  public readonly activityBarItem: Locator;
  public readonly sidebar: Locator;

  // Command registry from package.json
  private static readonly COMMANDS: Record<string, CommandMetadata> = {
    toggleLocalOnly: {
      commandId: 'sfdxOrgBrowser.toggleLocalOnly',
      icon: '$(circle-large-outline)'
    },
    toggleLocalOnlyOff: {
      commandId: 'sfdxOrgBrowser.toggleLocalOnlyOff',
      icon: '$(pass-filled)'
    },
    toggleHideManaged: {
      commandId: 'sfdxOrgBrowser.toggleHideManaged',
      icon: { light: 'resources/light/package.svg', dark: 'resources/dark/package.svg' }
    },
    toggleHideManagedOff: {
      commandId: 'sfdxOrgBrowser.toggleHideManagedOff',
      icon: { light: 'resources/light/package-filtered.svg', dark: 'resources/dark/package-filtered.svg' }
    },
    search: {
      commandId: 'sfdxOrgBrowser.search',
      icon: '$(search)'
    },
    clearSearch: {
      commandId: 'sfdxOrgBrowser.clearSearch',
      icon: '$(close)'
    },
    refreshType: {
      commandId: 'sfdxOrgBrowser.refreshType',
      icon: { light: 'resources/light/refresh.svg', dark: 'resources/dark/refresh.svg' }
    },
    retrieveMetadata: {
      commandId: 'sfdxOrgBrowser.retrieveMetadata',
      icon: { light: 'resources/light/retrieve.svg', dark: 'resources/dark/retrieve.svg' }
    }
  };

  constructor(page: Page) {
    this.page = page;

    // Core UI elements
    this.activityBarItem = page.locator('.activitybar a[aria-label*="Org Browser"]');
    this.sidebar = page.locator(
      '.sidebar, #workbench\\.parts\\.sidebar, [role="complementary"], .part.sidebar, .monaco-sidebar'
    );
  }

  /**
   * Check if a command is available in the command palette
   * Opens command palette, types the command, and checks if it appears in results
   * @param commandId The command ID to check (e.g., 'sfdxOrgBrowser.toggleLocalOnly')
   * @returns True if command is available, false otherwise
   */
  private async isCommandAvailable(commandId: string): Promise<boolean> {
    // Ensure Org Browser view is active - commands are only available when view is active
    await this.ensureViewActive();

    try {
      // Open command palette
      await this.page.keyboard.press('F1');
      await this.page.locator('.quick-input-widget').waitFor({ state: 'visible', timeout: 3000 });

      // Type the command ID (VS Code shows commands by ID or title)
      await this.page.locator('.quick-input-widget input').fill(commandId);
      await this.page.waitForTimeout(500); // Wait for results to filter

      // Check if any command result contains the command ID
      const commandResults = this.page.locator('.quick-input-list .monaco-list-row');
      const count = await commandResults.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const result = commandResults.nth(i);
        const label = await result
          .locator('.monaco-highlighted-label, .label-name')
          .textContent()
          .catch(() => '');
        const description = await result.textContent().catch(() => '');
        if (label?.includes(commandId) || description?.includes(commandId)) {
          // Close palette
          await this.page.keyboard.press('Escape');
          return true;
        }
      }

      // Close palette
      await this.page.keyboard.press('Escape');
      return false;
    } catch {
      // If anything fails, try to close palette and return false
      await this.page.keyboard.press('Escape').catch(() => {});
      return false;
    }
  }

  /**
   * Execute a VS Code command via command palette (without ensuring view is active)
   * Used for commands that don't require view context, like focusing sidebar
   * @param commandId The VS Code command ID to execute (e.g., 'workbench.action.focusSideBar')
   */
  private async executeVSCodeCommand(commandId: string): Promise<void> {
    // Check if command palette is already open
    const palette = this.page.locator('.quick-input-widget');
    const isAlreadyOpen = await palette.isVisible({ timeout: 500 }).catch(() => false);

    if (!isAlreadyOpen) {
      // Open command palette if not already open
      await this.page.keyboard.press('F1');
      await palette.waitFor({ state: 'visible', timeout: 3000 });
    }

    // Fill in the command ID
    await palette.locator('input').fill(commandId);
    await this.page.waitForTimeout(500); // Wait for results to filter
    await this.page.keyboard.press('Enter');
    // Wait for command palette to close
    await palette.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
  }

  /**
   * Execute a command via command palette (internal generic method)
   * Handles case where palette may already be open from previous interactions
   * @param commandId The command ID to execute (e.g., 'sfdxOrgBrowser.toggleLocalOnly')
   */
  private async executeCommandViaPalette(commandId: string): Promise<void> {
    // Ensure Org Browser view is active - commands are only available when view is active
    await this.ensureViewActive();

    // Check if command palette is already open
    const palette = this.page.locator('.quick-input-widget');
    const isAlreadyOpen = await palette.isVisible({ timeout: 500 }).catch(() => false);

    if (!isAlreadyOpen) {
      // Open command palette if not already open
      await this.page.keyboard.press('F1');
      await palette.waitFor({ state: 'visible', timeout: 3000 });
    }

    // Fill in the command ID
    await palette.locator('input').fill(commandId);
    await this.page.waitForTimeout(500); // Wait for results to filter
    await this.page.keyboard.press('Enter');
    // Wait for command palette to close
    await palette.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
  }

  /**
   * Execute toggle local only command via command palette
   * Determines which command to use based on current state
   */
  private async executeToggleLocalOnlyViaPalette(): Promise<void> {
    // Ensure view is active before reading state
    await this.ensureViewActive();
    const message = await this.getTreeViewMessage();
    const isFilterOn = message?.includes('Local files only') ?? false;
    const commandId = isFilterOn
      ? OrgBrowserPage.COMMANDS.toggleLocalOnly.commandId
      : OrgBrowserPage.COMMANDS.toggleLocalOnlyOff.commandId;
    await this.executeCommandViaPalette(commandId);
  }

  /**
   * Execute toggle hide managed command via command palette
   * Determines which command to use based on current state
   */
  private async executeToggleHideManagedViaPalette(): Promise<void> {
    // Ensure view is active before reading state
    await this.ensureViewActive();
    const message = await this.getTreeViewMessage();
    const isFilterOn = message?.includes('Hiding managed packages') ?? false;
    const commandId = isFilterOn
      ? OrgBrowserPage.COMMANDS.toggleHideManaged.commandId
      : OrgBrowserPage.COMMANDS.toggleHideManagedOff.commandId;
    await this.executeCommandViaPalette(commandId);
  }

  /**
   * Execute search command via command palette
   */
  private async executeSearchViaPalette(): Promise<void> {
    await this.executeCommandViaPalette(OrgBrowserPage.COMMANDS.search.commandId);
  }

  /**
   * Execute clear search command via command palette
   */
  private async executeClearSearchViaPalette(): Promise<void> {
    await this.executeCommandViaPalette(OrgBrowserPage.COMMANDS.clearSearch.commandId);
  }

  /**
   * Ensure Org Browser view is active
   * Uses VS Code command to reveal/activate the Org Browser view
   */
  private async ensureViewActive(): Promise<void> {
    // Use VS Code command to reveal/activate Org Browser view
    // This command will focus the sidebar and activate Org Browser view if needed
    await this.executeVSCodeCommand('workbench.view.extension.sfdxOrgBrowser');

    // Wait for sidebar to be visible
    await expect(this.sidebar, 'Sidebar should be visible after revealing view').toBeVisible({ timeout: 5000 });

    // Check if Org Browser view is active
    const hasActiveAttribute = await this.activityBarItem
      .getAttribute('aria-selected')
      .then(attr => attr === 'true')
      .catch(() => false);

    const hasActiveClass = await this.activityBarItem
      .evaluate((el: HTMLElement) => el.classList.contains('active'))
      .catch(() => false);

    // If not active, click the activity bar item to activate it
    // This ensures the view context is correct for commands
    if (!hasActiveAttribute && !hasActiveClass) {
      await this.activityBarItem.click({ timeout: 2000 });
      // Wait for it to become active
      await expect(this.activityBarItem, 'Activity bar item should be active after click')
        .toHaveAttribute('aria-selected', 'true', { timeout: 5000 })
        .catch(() => {
          // Fallback: check for active class
          return expect(this.activityBarItem, 'Activity bar item should have active class').toHaveClass(/active/, {
            timeout: 5000
          });
        });
    }
  }

  /**
   * Wait for the project file system to be loaded in Explorer
   */
  public async waitForProject(): Promise<void> {
    // Wait for Explorer view

    try {
      await Promise.any(
        ['[aria-label*="Explorer"]', '.explorer-viewlet', '#workbench\\.parts\\.sidebar .explorer-folders-view'].map(
          selector => this.page.waitForSelector(selector, { state: 'visible', timeout: 15_000 })
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
        ].map(selector => this.page.waitForSelector(selector, { state: 'visible', timeout: 15_000 }))
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
   * @param level The tree item level (default: 2 for metadata items)
   * @returns The locator for the metadata item
   */
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
    await saveScreenshot(this.page, 'waitForFileToOpenInEditor.png', true);
  }

  /**
   * Ensure a specific metadata type has its components loaded via listMetadata API call
   * Expands the type folder if needed and waits for the API response
   * @param typeName The metadata type name (e.g., 'CustomObject', 'Report')
   */
  public async ensureMetadataTypeLoaded(typeName: string): Promise<void> {
    // Try to find the type with a reasonable timeout
    // Use the same locator pattern as expandFolder for consistency
    let typeLocator = this.page.getByRole('treeitem', { name: typeName, exact: true });

    // Check if type is visible
    const isVisible = await typeLocator.isVisible({ timeout: 5000 }).catch(() => false);

    // If not visible, ensure tree is ready and try to find it using findMetadataType
    if (!isVisible) {
      // First, ensure the tree is ready (at least one tree item should be visible)
      // This is important right after openOrgBrowser() when the tree might still be loading
      try {
        await expect(
          this.sidebar.getByRole('treeitem', { level: 1 }).first(),
          'Tree should have at least one metadata type visible'
        ).toBeVisible({ timeout: 10_000 });
      } catch {
        // If tree isn't ready, try to open Org Browser to ensure it's active
        // This handles cases where the view might have lost focus
        await this.openOrgBrowser();
      }

      // Now try to find the type using findMetadataType (handles type-to-search)
      typeLocator = await this.findMetadataType(typeName);
    }

    // Now check if already expanded by looking for twistie state
    const twistie = typeLocator.locator('.monaco-tl-twistie');
    const isExpanded = await twistie
      .evaluate((el: HTMLElement) => el.classList.contains('codicon-tree-item-expanded'))
      .catch(() => false);

    if (isExpanded) {
      // Already expanded - wait for any pending API response and ensure children are loaded
      if (!isDesktop) {
        await this.awaitMdapiResponse();
      }
      // Also check that it's not in a loading state
      await expect(twistie, 'Twistie should not be in loading state').not.toContainClass('codicon-tree-item-loading', {
        timeout: 5000
      });
      return;
    }

    // Type not expanded - expand it (expandFolder will use the same locator pattern)
    // Since we've already found the type, expandFolder should be able to find it
    await this.expandFolder(typeName);
  }

  /**
   * Focus the sidebar/tree view to ensure keyboard input goes to the tree, not the editor
   */
  private async focusSidebar(): Promise<void> {
    // Click on the sidebar to ensure focus is on the tree view
    // This is important when focus might be in the editor
    await this.sidebar.click({ timeout: 2000 }).catch(() =>
      // If clicking fails, try clicking on a visible tree item
      this.sidebar
        .getByRole('treeitem', { level: 1 })
        .first()
        .click({ timeout: 2000 })
        .catch(() =>
          // If that also fails, just try to focus the sidebar element
          this.sidebar.focus({ timeout: 2000 }).catch(() =>
            // Last resort: use keyboard shortcut to focus sidebar (Cmd+B or Ctrl+B)
            this.page.keyboard.press('Meta+b').catch(() => {})
          )
        )
    );
    // Small delay to ensure focus is registered
    await this.page.waitForTimeout(100);
  }

  /**
   * Retrieve a named metadata item with full completion flow
   * Handles: finding type, expanding, getting item, clicking retrieve, waiting for completion
   * @param metadataType The metadata type (e.g., 'CustomObject', 'CustomTab')
   * @param itemName The item name (e.g., 'Broker__c')
   * @param options Optional configuration
   * @returns The retrieved item locator
   */
  public async retrieveMetadataItem(
    metadataType: string,
    itemName: string,
    options: { waitForFilePresence?: boolean } = {}
  ): Promise<Locator> {
    const { waitForFilePresence = true } = options;

    // Ensure type is loaded and expanded
    // expandFolder already waits for API response, ensures expansion, and waits for loading to complete
    // It also handles scrolling and re-expansion to ensure children are rendered
    await this.ensureMetadataTypeLoaded(metadataType);

    // Verify the type still has visible children (tree may have re-rendered after ensureMetadataTypeLoaded)
    // If children aren't visible, use expandFolder for consistency - it handles all edge cases
    const firstLevel2Item = this.sidebar.getByRole('treeitem', { level: 2 }).first();
    const hasVisibleChildren = await firstLevel2Item.isVisible({ timeout: 1000 }).catch(() => false);

    if (!hasVisibleChildren) {
      // Children not visible - use expandFolder to ensure expansion (handles scrolling, re-expansion, etc.)
      await this.expandFolder(metadataType);
    }

    // Get the metadata item
    const item = await this.getMetadataItem(metadataType, itemName, 2);

    // Click retrieve button
    const clicked = await this.clickRetrieveButton(item);
    if (!clicked) {
      throw new Error(`Failed to click retrieve button for ${metadataType}:${itemName}`);
    }

    // Wait for retrieval progress notification
    await waitForRetrieveProgressNotificationToAppear(this.page, 60_000);

    // Wait for file to open in editor (completion signal)
    await this.waitForFileToOpenInEditor(120_000);

    // Wait for file presence check if requested
    if (waitForFilePresence) {
      await this.waitForFilePresenceCheck();
    }

    // Return the item locator (may need to re-find if tree re-rendered)
    return await this.getMetadataItem(metadataType, itemName);
  }

  /**
   * Retrieve a metadata item with override confirmation
   * Handles the full flow: retrieve → overwrite confirmation → wait for completion
   * @param metadataType The metadata type (e.g., 'CustomObject', 'CustomTab')
   * @param itemName The item name (e.g., 'Broker__c')
   * @param expectedTypeInMessage Optional override for type name in confirmation message (defaults to metadataType)
   */
  public async retrieveMetadataItemWithOverride(
    metadataType: string,
    itemName: string,
    expectedTypeInMessage?: string
  ): Promise<void> {
    const typeInMessage = expectedTypeInMessage ?? metadataType;

    // Get the item
    const item = await this.getMetadataItem(metadataType, itemName);

    // Click retrieve button (will trigger overwrite confirmation)
    await this.clickRetrieveButton(item);

    // Wait for overwrite notification and click Yes
    const overwrite = this.page
      .locator('.monaco-workbench .notification-list-item')
      .filter({ hasText: /Overwrite\s+local\s+files\s+for/i })
      .first();
    await expect(overwrite, 'Overwrite notification should appear').toBeVisible();
    await expect(overwrite, `Overwrite notification should mention ${typeInMessage}`).toContainText(
      new RegExp(
        `Overwrite\\s+local\\s+files\\s+for\\s+\\d+\\s+${typeInMessage.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\?`,
        'i'
      )
    );

    await overwrite.getByRole('button', { name: /^Yes$/ }).click();

    // Wait for retrieving notification
    const retrieving = this.page
      .locator('.monaco-workbench .notification-list-item')
      .filter({ hasText: new RegExp(`Retrieving\\s+${typeInMessage.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') })
      .first();
    await expect(retrieving, 'Retrieving notification should appear').toBeVisible({ timeout: 60_000 });
  }

  /**
   * Get the org name displayed in the tree view description
   * @returns The org name text or null if not found
   */
  public async getOrgName(): Promise<string | null> {
    // The org name is displayed in the tree view title/description
    const treeViewTitle = this.sidebar.locator('.view-title, .view-header-title, [aria-label*="Org Browser"]').first();
    if (await treeViewTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await treeViewTitle.textContent();
      return text?.trim() ?? null;
    }
    return null;
  }

  /**
   * Toggle the "Show Local Only" filter
   * Tries UI button first, falls back to command palette if button not visible
   */
  public async toggleShowLocalOnly(): Promise<void> {
    await this.ensureViewActive();

    // Get current state BEFORE toggling
    const messageBefore = await this.getTreeViewMessage();
    const wasFilterOnBefore = messageBefore?.includes('Local files only') ?? false;

    // Try UI button first
    const viewTitleActions = this.sidebar.locator('.view-title .actions, .view-header .actions').first();
    const toggleButton = viewTitleActions
      .locator('.action-label[aria-label*="Show Local Only"], .action-label[aria-label*="Toggle Local Only"]')
      .first();

    if (await toggleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.focusSidebar();
      await toggleButton.click();
    } else {
      await this.executeToggleLocalOnlyViaPalette();
    }

    // Wait for state change
    await expect(async () => {
      const message = await this.getTreeViewMessage();
      const hasMessage = message?.includes('Local files only') ?? false;
      return hasMessage === !wasFilterOnBefore;
    }, 'Filter message should update after toggle').toPass({ timeout: 5000 });
  }

  /**
   * Toggle the "Hide Managed Packages" filter
   * Tries UI button first, falls back to command palette if button not visible
   */
  public async toggleHideManaged(): Promise<void> {
    await this.ensureViewActive();

    // Get current state BEFORE toggling
    const messageBefore = await this.getTreeViewMessage();
    const wasFilterOnBefore = messageBefore?.includes('Hiding managed packages') ?? false;

    // Try UI button first
    const toggleButton = this.sidebar
      .locator(
        '[aria-label*="Hide Managed"], [aria-label*="Toggle Hide Managed"], .action-label[title*="Hide Managed"]'
      )
      .first();

    if (await toggleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.focusSidebar();
      await toggleButton.click();
    } else {
      await this.executeToggleHideManagedViaPalette();
    }

    // Wait for state change
    await expect(async () => {
      const message = await this.getTreeViewMessage();
      const hasMessage = message?.includes('Hiding managed packages') ?? false;
      return hasMessage === !wasFilterOnBefore;
    }, 'Filter message should update after toggle').toPass({ timeout: 5000 });
  }

  /**
   * Trigger search command and enter query
   * Tries UI button first, falls back to command palette if button not visible
   * @param query The search query to enter
   */
  public async search(query: string): Promise<void> {
    await this.ensureViewActive();

    // Try UI button first
    const searchButton = this.sidebar
      .locator('[aria-label*="Search"], .action-label[title*="Search"], .codicon-search')
      .first();

    if (await searchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.focusSidebar();
      await searchButton.click();
    } else {
      await this.executeSearchViaPalette();
    }

    // Wait for input box and enter query
    await this.page.waitForSelector('.quick-input-widget input', { state: 'visible', timeout: 5000 });
    await this.page.locator('.quick-input-widget input').fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForTreeViewMessage(`Searching: "${query}"`);
  }

  /**
   * Clear the search query
   * Tries UI button first, falls back to command palette if button not visible
   */
  public async clearSearch(): Promise<void> {
    await this.ensureViewActive();

    // Try UI button first
    const clearButton = this.sidebar
      .locator('[aria-label*="Clear Search"], .action-label[title*="Clear Search"], .codicon-close')
      .first();

    if (await clearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.focusSidebar();
      await clearButton.click();
    } else {
      await this.executeClearSearchViaPalette();
    }

    // Wait for search message to clear
    await expect(async () => {
      const message = await this.getTreeViewMessage();
      return !message?.includes('Searching:');
    }, 'Tree view message should clear search text').toPass({ timeout: 2000 });
  }

  /**
   * Check if search is currently active
   * @returns True if search is active, false otherwise
   */
  public async isSearchActive(): Promise<boolean> {
    // Method 1: Check if clear search button is visible (indicates active search)
    try {
      await this.ensureViewActive();
      const clearButton = this.sidebar
        .locator('[aria-label*="Clear Search"], .action-label[title*="Clear Search"], .codicon-close')
        .first();
      const buttonVisible = await clearButton.isVisible({ timeout: 1000 }).catch(() => false);
      if (buttonVisible) {
        return true;
      }
    } catch {
      // UI check failed, continue
    }

    // Method 2: Check root message for "Searching:" text
    const message = await this.getTreeViewMessage();
    return message?.includes('Searching:') ?? false;
  }

  /**
   * Get the current search term from the root message
   * @returns The search term if active, null otherwise
   */
  public async getSearchTerm(): Promise<string | null> {
    const message = await this.getTreeViewMessage();
    if (!message) return null;

    // Parse search term from message: Searching: "term"
    const searchMatch = message.match(/Searching:\s*"([^"]+)"/);
    return searchMatch ? searchMatch[1] : null;
  }

  /**
   * Get the count badge text for a metadata type
   * @param typeName The metadata type name
   * @returns The count text or null if not found
   */
  public async getTypeCount(typeName: string): Promise<string | null> {
    const typeItem = await this.findMetadataType(typeName);
    if (!typeItem) return null;

    // Look for count badge in the description (not the label)
    const description = typeItem.locator('.monaco-list-row-description');
    const text = await description.textContent();
    // Extract count from text like "(5)" or "(7/7)"
    const match = text?.match(/\((\d+)(?:\/(\d+))?\)/);
    return match ? (match[2] ? `${match[1]}/${match[2]}` : match[1]) : null;
  }

  /**
   * Check if a tree item has a file presence indicator
   * @param item The tree item locator
   * @returns True if item shows file is present locally
   */
  public async hasFilePresenceIndicator(item: Locator): Promise<boolean> {
    // File presence is indicated by icon changes or checkmarks
    // Use this.page to satisfy linter requirement for 'this' usage
    const indicator = item.locator('.codicon-file, .codicon-check, [aria-label*="file"]');
    return await indicator.isVisible({ timeout: 1000 }).catch(() =>
      // Use this.page to satisfy linter
      this.page
        .locator('body')
        .isVisible()
        .then(() => false)
    );
  }

  /**
   * Wait for "Checking local files..." message to appear and disappear
   */
  public async waitForFilePresenceCheck(): Promise<void> {
    // Wait for progress message to appear (may not appear if check is very fast)
    const progressMessage = this.page.locator('text="Checking local files..."');
    try {
      await expect(progressMessage, 'File presence check progress message should appear').toBeVisible({
        timeout: 5000
      });
    } catch {
      // If message doesn't appear, check may have completed too quickly - continue
    }

    // Wait for message to disappear (check complete)
    await expect(progressMessage, 'File presence check should complete').not.toBeVisible({ timeout: 30_000 });
  }

  /**
   * Wait for count badge to appear on a metadata type
   * VS Code may render the count badge in the description element or as part of the label text
   */
  public async waitForCountBadge(typeName: string, timeout = 30_000): Promise<void> {
    const typeItem = await this.findMetadataType(typeName);

    // Try description element first (preferred location)
    const descriptionLocator = typeItem.locator('.monaco-list-row-description');
    const hasDescription = await descriptionLocator.isVisible({ timeout: 1000 }).catch(() => false);

    // Wait for count badge in description if it exists, otherwise check label text
    const targetLocator = hasDescription ? descriptionLocator : typeItem;
    const location = hasDescription ? 'description' : 'label';
    await expect(targetLocator, `Count badge should appear on ${typeName} ${location}`).toContainText(/\(\d+/, {
      timeout
    });
  }

  /**
   * Get the tree view message text
   * @returns The message text or null if not found
   */
  public async getTreeViewMessage(): Promise<string | null> {
    // VS Code renders treeView.message in the view container
    // The message appears in the tree view's message area, which VS Code renders
    // Try finding it in the Org Browser view container

    // First, find the Org Browser view container
    const orgBrowserView = this.sidebar.locator('[id*="sfdxOrgBrowser"]').first();

    // VS Code renders treeView.message as a message element within the view
    // Try multiple selectors that VS Code might use
    const messageSelectors = [
      orgBrowserView.locator('.view-message'),
      orgBrowserView.locator('.monaco-list-empty-message'),
      orgBrowserView.locator('[role="status"]'),
      // Also check parent containers
      this.sidebar.locator('.view-message'),
      this.sidebar.locator('.monaco-list-empty-message'),
      // Check view title area for message
      this.sidebar.locator('.view-title').locator('.view-message'),
      this.sidebar.locator('.view-header').locator('.view-message')
    ];

    for (const messageLocator of messageSelectors) {
      if (await messageLocator.isVisible({ timeout: 500 }).catch(() => false)) {
        const text = await messageLocator.textContent();
        if (
          text?.trim() &&
          (text.includes('Searching') || text.includes('Local files') || text.includes('Hiding managed'))
        ) {
          return text.trim();
        }
      }
    }

    // Fallback: Search for text patterns anywhere in sidebar (slower but more comprehensive)
    try {
      const sidebarText = await this.sidebar.textContent();
      if (sidebarText) {
        const searchMatch = sidebarText.match(/Searching: ".*?"/);
        if (searchMatch) return searchMatch[0];

        if (sidebarText.includes('Local files only')) return 'Local files only';
        if (sidebarText.includes('Hiding managed packages')) return 'Hiding managed packages';
      }
    } catch {
      // Ignore errors in fallback
    }

    return null;
  }

  /**
   * Check if the "Show Local Only" filter button is in the active (checked) state
   * Checks command availability, UI button icons, and root message text
   * @returns True if filter is active, false if inactive
   */
  public async isLocalOnlyFilterActive(): Promise<boolean> {
    // Method 1: Check command availability
    // toggleLocalOnlyOff available = filter ON, toggleLocalOnly available = filter OFF
    const toggleOffAvailable = await this.isCommandAvailable(OrgBrowserPage.COMMANDS.toggleLocalOnlyOff.commandId);
    if (toggleOffAvailable) {
      return true;
    }
    const toggleOnAvailable = await this.isCommandAvailable(OrgBrowserPage.COMMANDS.toggleLocalOnly.commandId);
    if (toggleOnAvailable) {
      return false;
    }

    // Method 2: Check root message text
    const message = await this.getTreeViewMessage();
    if (message?.includes('Local files only')) {
      return true;
    }

    // Method 3: Check UI button icon (fallback)
    try {
      await this.ensureViewActive();
      const viewTitleActions = this.sidebar.locator('.view-title .actions, .view-header .actions').first();
      const actionsVisible = await viewTitleActions.isVisible({ timeout: 1000 }).catch(() => false);

      if (actionsVisible) {
        const allButtons = viewTitleActions.locator('.action-label');
        const buttonCount = await allButtons.count();

        for (let i = 0; i < buttonCount; i++) {
          const button = allButtons.nth(i);
          const ariaLabel = await button.getAttribute('aria-label').catch(() => '');

          if (ariaLabel && (ariaLabel.includes('Show Local Only') || ariaLabel.includes('Toggle Local Only'))) {
            // Check if it has pass-filled icon (active)
            const hasPassFilled = await button
              .locator('.codicon-pass-filled')
              .isVisible({ timeout: 500 })
              .catch(() => false);
            if (hasPassFilled) {
              return true;
            }
            // If it has circle-large-outline, it's inactive
            const hasCircleOutline = await button
              .locator('.codicon-circle-large-outline')
              .isVisible({ timeout: 500 })
              .catch(() => false);
            if (hasCircleOutline) {
              return false;
            }
          }
        }
      }
    } catch {
      // UI check failed, continue
    }

    // Fallback: assume inactive if we can't determine state
    return false;
  }

  /**
   * Check if the "Hide Managed Packages" filter button is in the active (checked) state
   * Checks command availability, UI button icons, and root message text
   * @returns True if filter is active, false if inactive
   */
  public async isHideManagedFilterActive(): Promise<boolean> {
    // Method 1: Check command availability
    // toggleHideManagedOff available = filter ON, toggleHideManaged available = filter OFF
    const toggleOffAvailable = await this.isCommandAvailable(OrgBrowserPage.COMMANDS.toggleHideManagedOff.commandId);
    if (toggleOffAvailable) {
      return true;
    }
    const toggleOnAvailable = await this.isCommandAvailable(OrgBrowserPage.COMMANDS.toggleHideManaged.commandId);
    if (toggleOnAvailable) {
      return false;
    }

    // Method 2: Check root message text
    const message = await this.getTreeViewMessage();
    if (message?.includes('Hiding managed packages')) {
      return true;
    }

    // Method 3: Check UI button icon (fallback)
    try {
      await this.ensureViewActive();
      const activeButton = this.sidebar
        .locator(
          '[aria-label*="Hide Managed"], [aria-label*="Toggle Hide Managed"], .action-label[title*="Hide Managed"]'
        )
        .first();

      const isVisible = await activeButton.isVisible({ timeout: 2000 }).catch(() => false);
      if (isVisible) {
        // Check if the button has the filtered icon (active) or regular icon (inactive)
        // Active state uses package-filtered.svg, inactive uses package.svg
        const icon = activeButton.locator('img[src*="package-filtered"], img[src*="package"]').first();
        const iconSrc = await icon.getAttribute('src').catch(() => '');
        return iconSrc?.includes('package-filtered') ?? false;
      }
    } catch {
      // UI check failed, continue
    }

    // Fallback: assume inactive if we can't determine state
    return false;
  }

  /**
   * Wait for tree view message to contain specific text
   * @param expectedText Text that should appear in the message
   */
  public async waitForTreeViewMessage(expectedText: string, timeout = 5000): Promise<void> {
    await expect(async () => {
      const message = await this.getTreeViewMessage();
      if (!message) {
        throw new Error(`Tree view message not found. Expected to contain: "${expectedText}"`);
      }
      if (!message.includes(expectedText)) {
        throw new Error(`Tree view message is "${message}", expected to contain: "${expectedText}"`);
      }
      return message;
    }, `Tree view message should contain "${expectedText}"`).toPass({ timeout, intervals: [100, 200, 500] });
  }
}
