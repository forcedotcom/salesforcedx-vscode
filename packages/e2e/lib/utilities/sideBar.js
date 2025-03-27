"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandProjectInSideBar = expandProjectInSideBar;
exports.getVisibleItemsFromSidebar = getVisibleItemsFromSidebar;
exports.getFilteredVisibleTreeViewItems = getFilteredVisibleTreeViewItems;
exports.getFilteredVisibleTreeViewItemLabels = getFilteredVisibleTreeViewItemLabels;
exports.getVisibleChild = getVisibleChild;
exports.getVisibleChildren = getVisibleChildren;
exports.getVisibleItems = getVisibleItems;
exports.verifyProjectLoaded = verifyProjectLoaded;
const vscode_extension_tester_1 = require("vscode-extension-tester");
const miscellaneous_1 = require("./miscellaneous");
const chai_1 = require("chai");
const workbench_1 = require("./workbench");
async function expandProjectInSideBar(workbench, projectName) {
    (0, miscellaneous_1.debug)('expandProjectInSideBar()');
    await (0, workbench_1.showExplorerView)();
    const sidebar = workbench.getSideBar();
    (0, chai_1.expect)(await sidebar.isDisplayed()).to.equal(true);
    const content = sidebar.getContent();
    const treeViewSection = await content.getSection(projectName);
    await treeViewSection.expand();
    return treeViewSection;
}
async function getVisibleItemsFromSidebar(workbench, projectName) {
    (0, miscellaneous_1.debug)('getVisibleItemsFromSidebar()');
    const treeViewSection = await expandProjectInSideBar(workbench, projectName);
    // Warning, we can only retrieve the items which are visible.
    const visibleItems = (await treeViewSection.getVisibleItems());
    const visibleItemsLabels = await Promise.all(visibleItems.map(item => item.getLabel().then(label => label)));
    return visibleItemsLabels;
}
async function getFilteredVisibleTreeViewItems(workbench, projectName, searchString) {
    (0, miscellaneous_1.debug)('getFilteredVisibleTreeViewItems()');
    const treeViewSection = await expandProjectInSideBar(workbench, projectName);
    // Warning, we can only retrieve the items which are visible.
    const visibleItems = (await treeViewSection.getVisibleItems());
    const filteredItems = await visibleItems.reduce(async (previousPromise, currentItem) => {
        const results = await previousPromise;
        const label = await currentItem.getLabel();
        if (label.startsWith(searchString)) {
            results.push(currentItem);
        }
        return results;
    }, Promise.resolve([]));
    return filteredItems;
}
// It's a tree, but it's also a list.  Everything in the view is actually flat
// and returned from the call to visibleItems.reduce().
async function getFilteredVisibleTreeViewItemLabels(workbench, projectName, searchString) {
    const treeViewSection = await expandProjectInSideBar(workbench, projectName);
    // Warning, we can only retrieve the items which are visible.
    const visibleItems = (await treeViewSection.getVisibleItems());
    const filteredItems = (await visibleItems.reduce(async (previousPromise, currentItem) => {
        const results = await previousPromise;
        const label = await currentItem.getLabel();
        if (label.startsWith(searchString)) {
            results.push(label);
        }
        return results;
    }, Promise.resolve([])));
    return filteredItems;
}
async function getVisibleChild(defaultTreeItem, name) {
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
async function getVisibleChildren(defaultTreeItem) {
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
async function getVisibleItems(treeItem, locator) {
    await treeItem.expand();
    const rows = await treeItem.findElement(vscode_extension_tester_1.By.xpath('..')).findElements(locator);
    return [...rows.values()];
}
async function verifyProjectLoaded(projectName) {
    (0, miscellaneous_1.log)(`${projectName} - Verifying project was created...`);
    // Reload the VS Code window
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(5));
    const workbench = (0, workbench_1.getWorkbench)();
    await (0, workbench_1.reloadWindow)(miscellaneous_1.Duration.seconds(10));
    await (0, workbench_1.showExplorerView)();
    const sidebar = await workbench.getSideBar().wait();
    const content = await sidebar.getContent().wait();
    const treeViewSection = await content.getSection(projectName);
    if (!treeViewSection) {
        throw new Error('In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)');
    }
    const forceAppTreeItem = (await treeViewSection.findItem('force-app'));
    if (!forceAppTreeItem) {
        throw new Error('In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)');
    }
    await (await forceAppTreeItem.wait()).expand();
    (0, miscellaneous_1.log)(`${projectName} - Verifying project complete`);
}
//# sourceMappingURL=sideBar.js.map