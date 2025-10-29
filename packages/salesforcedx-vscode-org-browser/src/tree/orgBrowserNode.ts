/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

type OrgBrowserTreeItemKind =
  /** a normal metadata type */
  | 'type'
  /** a metadata type that has a folder (Dashboard, Document, EmailTemplate, Report) */
  | 'folderType'
  /** a folder in one of the folder types*/
  | 'folder'
  /** a component that can be retrieved, the lowest level of the tree */
  | 'component'
  /** a custom object (so that its fields can be displayed and retrieved*/
  | 'customObject';

type OrgBrowserTreeItemInputs = {
  kind: OrgBrowserTreeItemKind;
  /** Metadata Type that you could use to retrieve the node */
  xmlName: string;
  folderName?: string;
  componentName?: string;
  // The label to display in the tree
  label: string;
  /** Whether the file is present in the local workspace */
  filePresent?: boolean;
  namespace?: string;
};

// Types that have folders
const FOLDER_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);
export const isFolderType = (xmlName: string): boolean => FOLDER_TYPES.has(xmlName);

export class OrgBrowserTreeItem extends vscode.TreeItem {
  public readonly kind: OrgBrowserTreeItemKind;
  /** Metadata Type that you could use to retrieve the node */
  public readonly xmlName: string;
  public readonly folderName?: string;
  /** the name of the component that you could use to retrieve the node.  One of the [xmlName] */
  public readonly componentName?: string;
  public readonly namespace?: string;

  constructor(inputs: OrgBrowserTreeItemInputs) {
    super(
      inputs.label,
      inputs.kind === 'component' ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.namespace = inputs.namespace;
    this.kind = inputs.kind;
    this.xmlName = inputs.xmlName;
    this.folderName = inputs.folderName;
    this.componentName = inputs.componentName;

    // not defined intentionally results in no icon.
    if (inputs.filePresent !== undefined) {
      this.iconPath = getIconPath(inputs.filePresent);
    }

    // Set context value for menu contributions
    this.contextValue = inputs.kind;

    this.id = calculateId(inputs);
  }
}
export const getIconPath = (filePresent: boolean): vscode.ThemeIcon =>
  filePresent ? new vscode.ThemeIcon('pass-filled') : new vscode.ThemeIcon('circle-large-outline');

const calculateId = (inputs: OrgBrowserTreeItemInputs): string => {
  // top-level types
  if (inputs.kind === 'type' || inputs.kind === 'folderType') {
    return inputs.xmlName;
  }
  if (inputs.kind === 'customObject' || inputs.kind === 'component') {
    return `${inputs.xmlName}:${inputs.componentName}`;
  }
  if (inputs.kind === 'folder') {
    return `${inputs.xmlName}:${inputs.folderName}`;
  }

  return `${inputs.xmlName}:${inputs.folderName}:${inputs.componentName}`;
};
