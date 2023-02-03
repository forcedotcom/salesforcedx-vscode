/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DefaultTreeItem,
  TreeItem,
  ViewItem,
  Workbench
} from 'wdio-vscode-service';

export async function getFilteredVisibleTreeViewItems(workbench: Workbench, projectName: string, searchString: string): Promise<ViewItem[]> {
  const sidebar = workbench.getSideBar();
  const treeViewSection = await sidebar.getContent().getSection(projectName);
  await treeViewSection.expand();

  // Warning, we can only retrieve the items which are visible.
  const visibleItems = (await treeViewSection.getVisibleItems()) as DefaultTreeItem[];
  const filteredItems = (await visibleItems.reduce(async (previousPromise: Promise<ViewItem[]>, currentItem: ViewItem) => {
    const results = await previousPromise;
    const label = await (currentItem as TreeItem).getLabel();
    if (label.startsWith(searchString)) {
      results.push(currentItem);
    }

    return results;
  }, Promise.resolve([])) as ViewItem[]);

  return filteredItems;
}

export async function getFilteredVisibleTreeViewItemLabels(workbench: Workbench, projectName: string, searchString: string): Promise<string[]> {
  const sidebar = workbench.getSideBar();
  const treeViewSection = await sidebar.getContent().getSection(projectName);
  await treeViewSection.expand();

  // Warning, we can only retrieve the items which are visible.
  const visibleItems = (await treeViewSection.getVisibleItems()) as DefaultTreeItem[];
  const filteredItems = (await visibleItems.reduce(async (previousPromise: Promise<string[]>, currentItem: ViewItem) => {
    const results = await previousPromise;
    const label = await (currentItem as TreeItem).getLabel();
    if (label.startsWith(searchString)) {
      results.push(label);
    }

    return results;
  }, Promise.resolve([])) as string[]);

  return filteredItems;
}
