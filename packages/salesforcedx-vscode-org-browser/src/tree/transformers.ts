/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { isFolderType, OrgBrowserTreeItem } from './orgBrowserNode';
import { MetadataDescribeResultItem, MetadataListResultItem } from './types';

/** Transform metadata describe result to tree node */
export const describeResultToNode = (t: MetadataDescribeResultItem): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({
    kind: isFolderType(t.xmlName) ? 'folderType' : 'type',
    xmlName: t.xmlName,
    label: t.xmlName
  });

/** Transform list metadata result to component node (pure, no side effects) */
export const listResultToComponentNode = (element: OrgBrowserTreeItem, c: MetadataListResultItem): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({
    kind: element.xmlName === 'CustomObject' ? 'customObject' : 'component',
    namespace: c.namespacePrefix,
    xmlName: element.xmlName,
    componentName: c.fullName,
    label: c.fullName
  });

/** Transform list metadata result to folder node */
export const listResultToFolderNode = (element: OrgBrowserTreeItem, c: MetadataListResultItem): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({
    kind: 'folder',
    xmlName: element.xmlName,
    namespace: c.namespacePrefix,
    folderName: c.fullName,
    label: c.fullName
  });

/** Transform list metadata result to folder item node (pure, no side effects) */
export const listResultToFolderItemNode = (
  element: OrgBrowserTreeItem,
  c: MetadataListResultItem
): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({
    kind: 'component',
    namespace: c.namespacePrefix,
    xmlName: element.xmlName,
    folderName: element.folderName,
    componentName: c.fullName,
    label: c.fullName
  });

/** Create error display node */
export const createErrorNode = (message: string): OrgBrowserTreeItem => {
  const node = new OrgBrowserTreeItem({
    kind: 'type',
    xmlName: 'Error',
    label: `⚠️ ${message.length > 80 ? `${message.slice(0, 80)}...` : message}`
  });
  node.collapsibleState = vscode.TreeItemCollapsibleState.None;
  node.tooltip = message;
  return node;
};
