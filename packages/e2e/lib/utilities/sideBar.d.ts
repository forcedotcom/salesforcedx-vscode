import { DefaultTreeItem, Locator, TreeItem, ViewSection, WebElement, Workbench } from 'vscode-extension-tester';
export declare function expandProjectInSideBar(workbench: Workbench, projectName: string): Promise<ViewSection>;
export declare function getVisibleItemsFromSidebar(workbench: Workbench, projectName: string): Promise<string[]>;
export declare function getFilteredVisibleTreeViewItems(workbench: Workbench, projectName: string, searchString: string): Promise<DefaultTreeItem[]>;
export declare function getFilteredVisibleTreeViewItemLabels(workbench: Workbench, projectName: string, searchString: string): Promise<string[]>;
export declare function getVisibleChild(defaultTreeItem: DefaultTreeItem, name: string): Promise<TreeItem | undefined>;
export declare function getVisibleChildren(defaultTreeItem: DefaultTreeItem): Promise<TreeItem[]>;
export declare function getVisibleItems(treeItem: TreeItem, locator: Locator): Promise<WebElement[]>;
export declare function verifyProjectLoaded(projectName: string): Promise<void>;
