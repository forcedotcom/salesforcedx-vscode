/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  By,
  DefaultTreeItem,
  Locator,
  TreeItem,
  ViewItem,
  ViewSection,
  WebElement,
  Workbench
} from 'vscode-extension-tester';
import { debug, Duration, log, pause } from './miscellaneous';
import { expect } from 'chai';
import { getWorkbench, reloadWindow, showExplorerView } from './workbench';

export async function expandProjectInSideBar(workbench: Workbench, projectName: string): Promise<ViewSection> {
  debug('expandProjectInSideBar()');
  await showExplorerView();

  const sidebar = workbench.getSideBar();
  expect(await sidebar.isDisplayed()).to.equal(true);

  const content = sidebar.getContent();
  const treeViewSection = await content.getSection(projectName);
  await treeViewSection.expand();
  return treeViewSection;
}

export async function getVisibleItemsFromSidebar(workbench: Workbench, projectName: string): Promise<string[]> {
  debug('getVisibleItemsFromSidebar()');
  const treeViewSection = await expandProjectInSideBar(workbench, projectName);

  // Warning, we can only retrieve the items which are visible.
  const visibleItems = (await treeViewSection.getVisibleItems()) as DefaultTreeItem[];
  const visibleItemsLabels = await Promise.all(visibleItems.map(item => item.getLabel().then(label => label)));

  return visibleItemsLabels;
}

export async function getFilteredVisibleTreeViewItems(
  workbench: Workbench,
  projectName: string,
  searchString: string
): Promise<DefaultTreeItem[]> {
  debug('getFilteredVisibleTreeViewItems()');
  const treeViewSection = await expandProjectInSideBar(workbench, projectName);

  // Warning, we can only retrieve the items which are visible.
  const visibleItems = (await treeViewSection.getVisibleItems()) as DefaultTreeItem[];
  const filteredItems = await visibleItems.reduce(
    async (previousPromise: Promise<DefaultTreeItem[]>, currentItem: DefaultTreeItem) => {
      const results = await previousPromise;
      const label = await currentItem.getLabel();
      if (label.startsWith(searchString)) {
        results.push(currentItem);
      }

      return results;
    },
    Promise.resolve([])
  );

  return filteredItems;
}

// It's a tree, but it's also a list.  Everything in the view is actually flat
// and returned from the call to visibleItems.reduce().
export async function getFilteredVisibleTreeViewItemLabels(
  workbench: Workbench,
  projectName: string,
  searchString: string
): Promise<string[]> {
  const treeViewSection = await expandProjectInSideBar(workbench, projectName);

  // Warning, we can only retrieve the items which are visible.
  const visibleItems = (await treeViewSection.getVisibleItems()) as DefaultTreeItem[];
  const filteredItems = (await visibleItems.reduce(
    async (previousPromise: Promise<string[]>, currentItem: ViewItem) => {
      const results = await previousPromise;
      const label = await (currentItem as TreeItem).getLabel();
      if (label.startsWith(searchString)) {
        results.push(label);
      }

      return results;
    },
    Promise.resolve([])
  )) as string[];

  return filteredItems;
}

export async function getVisibleChild(defaultTreeItem: DefaultTreeItem, name: string): Promise<TreeItem | undefined> {
  const children = await getVisibleChildren(defaultTreeItem);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const label = await child.getLabel();
    if (label === name) {
      return child;
    }
  }

  return undefined;
}

// Replicate DefaultTreeItem.getChildren()
// getVisibleChildren() is very much like DefaultTreeItem.getChildren(), except it calls
// getVisibleItems().
export async function getVisibleChildren(defaultTreeItem: DefaultTreeItem): Promise<TreeItem[]> {
  console.log(`${defaultTreeItem}`);
  // const rows = await getVisibleItems(
  //   defaultTreeItem,
  //   defaultTreeItem.locatorMap.DefaultTreeSection.itemRow as string
  // );

  // const items = await Promise.all(
  //   rows.map(async (row) =>
  //     new DefaultTreeItem(
  //       defaultTreeItem.locatorMap,
  //       // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  //       row as any,
  //       defaultTreeItem.viewPart
  //     ).wait()
  //   )
  // );

  return [];
}

// Replicate TreeItem.getChildItems()
// This function returns a list of all visible items within the tree, and not just the children of a node.
export async function getVisibleItems(treeItem: TreeItem, locator: Locator): Promise<WebElement[]> {
  await treeItem.expand();
  const rows = await treeItem.findElement(By.xpath('..')).findElements(locator);

  return [...rows.values()];
}

export async function verifyProjectLoaded(projectName: string) {
  log(`${projectName} - Verifying project was created...`);

  // Reload the VS Code window
  await pause(Duration.seconds(5));
  const workbench = getWorkbench();
  await reloadWindow(Duration.seconds(10));
  await showExplorerView();

  const sidebar = await workbench.getSideBar().wait();
  const content = await sidebar.getContent().wait();
  const treeViewSection = await content.getSection(projectName);
  if (!treeViewSection) {
    throw new Error(
      'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
    );
  }

  const forceAppTreeItem = (await treeViewSection.findItem('force-app')) as DefaultTreeItem;
  if (!forceAppTreeItem) {
    throw new Error(
      'In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)'
    );
  }

  await (await forceAppTreeItem.wait()).expand();
  log(`${projectName} - Verifying project complete`);
}
