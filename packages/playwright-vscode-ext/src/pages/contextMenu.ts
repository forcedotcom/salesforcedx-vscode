/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page, Locator } from '@playwright/test';
import { EDITOR_WITH_URI, CONTEXT_MENU } from '../utils/locators';
import { executeCommandWithCommandPalette } from './commands';

/** Opens context menu on an editor. If fileName is provided, matches editor by URI/name (partial match). */
const openEditorContextMenu = async (page: Page, fileName?: string): Promise<Locator> => {
  let editor: Locator;
  if (fileName) {
    // Wait for at least one editor to be visible first
    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 10_000 });

    // Try to find editor by matching fileName in data-uri
    // Check all editors and find one that matches
    const allEditors = page.locator(EDITOR_WITH_URI);
    const count = await allEditors.count();
    let foundEditor: Locator | undefined;
    const dataUris: string[] = [];
    for (let i = 0; i < count; i++) {
      const editorLocator = allEditors.nth(i);
      const dataUri = await editorLocator.getAttribute('data-uri');
      if (dataUri) {
        dataUris.push(dataUri);
        if (dataUri.includes(fileName)) {
          foundEditor = editorLocator;
          break;
        }
      }
    }
    if (!foundEditor) {
      throw new Error(
        `No editor found with fileName containing "${fileName}". Available data-uris: ${dataUris.join(', ')}`
      );
    }
    editor = foundEditor;
  } else {
    editor = page.locator(EDITOR_WITH_URI).first();
  }
  await editor.waitFor({ state: 'visible', timeout: 10_000 });
  await editor.click({ button: 'right' });
  const contextMenu = page.locator(CONTEXT_MENU);
  await contextMenu.waitFor({ state: 'visible', timeout: 5000 });
  return contextMenu;
};

/** Opens context menu on a file/folder in the explorer sidebar */
const openExplorerContextMenu = async (page: Page, itemName: string | RegExp): Promise<Locator> => {
  await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
  const treeItem = page.getByRole('treeitem', { name: itemName });
  await treeItem.waitFor({ state: 'visible', timeout: 10_000 });
  // Scroll into view to ensure item is visible before right-clicking
  await treeItem.scrollIntoViewIfNeeded();
  // Hover first to ensure item is ready
  await treeItem.hover({ timeout: 2000 }).catch(() => {
    // Hover might fail if item is already visible, continue
  });
  await treeItem.click({ button: 'right' });
  const contextMenu = page.locator(CONTEXT_MENU);
  await contextMenu.waitFor({ state: 'visible', timeout: 5000 });
  return contextMenu;
};

/** Selects an item from an open context menu by name */
const selectContextMenuItem = async (page: Page, itemName: string | RegExp): Promise<void> => {
  const contextMenu = page.locator(CONTEXT_MENU);
  // Wait for menu to be fully rendered
  await contextMenu.waitFor({ state: 'visible', timeout: 5000 });
  const menuItems = contextMenu.getByRole('menuitem');
  const count = await menuItems.count();
  if (count === 0) {
    const menuText = await contextMenu.textContent();
    throw new Error(`No menu items found in context menu. Menu content: ${menuText}`);
  }
  // Try to find the menu item - use getByRole with name for better matching
  const matchingItem =
    typeof itemName === 'string'
      ? contextMenu.getByRole('menuitem', { name: itemName })
      : menuItems.filter({ hasText: itemName }).first();
  const isVisible = await matchingItem.isVisible({ timeout: 1000 }).catch(() => false);
  if (!isVisible) {
    // Debug: log all available menu items
    const allItems: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await menuItems.nth(i).textContent();
      if (text) allItems.push(text.trim());
    }
    throw new Error(`Menu item matching "${itemName}" not found. Available items: ${allItems.join(' | ')}`);
  }
  // Scroll into view and ensure item is actionable
  await matchingItem.scrollIntoViewIfNeeded();
  // Wait for the item to be stable and actionable
  await matchingItem.waitFor({ state: 'visible', timeout: 2000 });
  // Click the menu item directly - more reliable than hover + Enter on Windows
  await matchingItem.click({ timeout: 5000 });
  // Wait for menu to close after action to confirm it was executed
  await contextMenu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
    // Menu might close instantly or might not close if action failed
  });
};

/** Opens editor context menu and selects an item. If fileName is provided, matches editor by URI/name (partial match). */
export const executeEditorContextMenuCommand = async (
  page: Page,
  itemName: string | RegExp,
  fileName?: string
): Promise<void> => {
  await openEditorContextMenu(page, fileName);
  await selectContextMenuItem(page, itemName);
};

/** Opens explorer context menu on item and selects a command */
export const executeExplorerContextMenuCommand = async (
  page: Page,
  explorerItemName: string | RegExp,
  menuItemName: string | RegExp
): Promise<void> => {
  await openExplorerContextMenu(page, explorerItemName);
  await selectContextMenuItem(page, menuItemName);
};
