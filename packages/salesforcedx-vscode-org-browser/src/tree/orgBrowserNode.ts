/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

export type OrgBrowserNodeKind =
  /** a normal metadata type */
  | 'type'
  /** a metadata type that has a folder (Dashboard, Document, EmailTemplate, Report) */
  | 'folderType'
  /** a folder in one of the folder types*/
  | 'folder'
  /** a component that can be retrieved*/
  | 'component';

// Types that have folders (Dashboard, Document, EmailTemplate, Report)
const FOLDER_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);
export const isFolderType = (xmlName: string): boolean => FOLDER_TYPES.has(xmlName);
export class OrgBrowserNode extends vscode.TreeItem {
  constructor(
    public readonly kind: OrgBrowserNodeKind,
    public readonly xmlName: string,
    public readonly folderName?: string,
    public readonly componentName?: string
  ) {
    super(
      kind === 'type' || kind === 'folderType' ? xmlName : kind === 'folder' ? folderName! : componentName!,
      kind === 'component' ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
    );

    // Set context value for menu contributions
    this.contextValue = kind;

    this.id =
      kind === 'type' || kind === 'folderType'
        ? xmlName
        : kind === 'folder'
          ? `${xmlName}:${folderName}`
          : folderName
            ? `${xmlName}:${folderName}:${componentName}`
            : `${xmlName}:${componentName}`;
  }
}
