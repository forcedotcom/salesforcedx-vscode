/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

type OrgBrowserNodeKind =
  /** a normal metadata type */
  | 'type'
  /** a metadata type that has a folder (Dashboard, Document, EmailTemplate, Report) */
  | 'folderType'
  /** a folder in one of the folder types*/
  | 'folder'
  /** a component that can be retrieved*/
  | 'component'
  /** a custom object (so that its fields can be displayed and retrieved*/
  | 'customObject';

export type OrgBrowserNodeInputs = {
  kind: OrgBrowserNodeKind;
  /** Metadata Type that you could use to retrieve the node */
  xmlName: string;
  folderName?: string;
  componentName?: string;
  // The label to display in the tree
  label: string;
};

// Types that have folders (Dashboard, Document, EmailTemplate, Report)
const FOLDER_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);
export const isFolderType = (xmlName: string): boolean => FOLDER_TYPES.has(xmlName);

export const calculateType = (xmlName: string): OrgBrowserNodeKind => {
  if (xmlName === 'CustomObject') {
    return 'customObject';
  }
  return isFolderType(xmlName) ? 'folder' : 'type';
};
export class OrgBrowserNode extends vscode.TreeItem {
  public readonly kind: OrgBrowserNodeKind;
  public readonly xmlName: string;
  public readonly folderName?: string;
  /** the name of the component that you could use to retrieve the node.  One of the [xmlName] */
  public readonly componentName?: string;

  constructor(inputs: OrgBrowserNodeInputs) {
    super(
      inputs.label,
      inputs.kind === 'component' ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.kind = inputs.kind;
    this.xmlName = inputs.xmlName;
    this.folderName = inputs.folderName;
    this.componentName = inputs.componentName;

    // Set context value for menu contributions
    this.contextValue = inputs.kind;

    this.id = calculateId(inputs);
  }
}

const calculateId = (inputs: OrgBrowserNodeInputs): string => {
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
