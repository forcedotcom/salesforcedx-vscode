/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

export type SyncState = 'synced' | 'localOnly' | 'remoteOnly' | 'conflict' | 'remoteDeleted' | 'notPresent' | 'unknown';

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
  | 'customObject'
  /** virtual root node for pending source tracking changes */
  | 'changesRoot'
  /** group node under changesRoot (local, remote, conflicts) */
  | 'changesGroup'
  /** a changed component in the pending changes section */
  | 'changedComponent';

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
  /** Source tracking sync state (takes precedence over filePresent when available) */
  syncState?: SyncState;
  namespace?: string;
  /** Primary local file path for navigation (first file from ComponentSet lookup) */
  localPath?: string;
};

// Types that have folders
const FOLDER_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);
export const isFolderType = (xmlName: string): boolean => FOLDER_TYPES.has(xmlName);

export const SINGLE_FILE_ADAPTER = 'matchingContentFile';

export class OrgBrowserTreeItem extends vscode.TreeItem {
  public readonly kind: OrgBrowserTreeItemKind;
  /** Metadata Type that you could use to retrieve the node */
  public readonly xmlName: string;
  public readonly folderName?: string;
  /** the name of the component that you could use to retrieve the node.  One of the [xmlName] */
  public readonly componentName?: string;
  public readonly namespace?: string;
  public readonly syncState?: SyncState;
  public readonly localPath?: string;

  constructor(inputs: OrgBrowserTreeItemInputs) {
    const collapsibleKinds: OrgBrowserTreeItemKind[] = [
      'type',
      'folderType',
      'folder',
      'customObject',
      'changesRoot',
      'changesGroup'
    ];
    super(
      inputs.label,
      collapsibleKinds.includes(inputs.kind)
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.namespace = inputs.namespace;
    this.kind = inputs.kind;
    this.xmlName = inputs.xmlName;
    this.folderName = inputs.folderName;
    this.componentName = inputs.componentName;
    this.syncState = inputs.syncState;
    this.localPath = inputs.localPath;

    if (inputs.syncState) {
      this.iconPath = getSyncIcon(inputs.syncState);
      this.description = getSyncDescription(inputs.syncState);
    } else if (inputs.filePresent !== undefined) {
      this.iconPath = getIconPath(inputs.filePresent);
    }

    const baseContextValue = inputs.syncState ? `${inputs.kind}_${inputs.syncState}` : inputs.kind;
    this.contextValue = inputs.localPath ? `${baseContextValue}_local` : baseContextValue;

    this.id = calculateId(inputs);
  }
}

export const getIconPath = (filePresent: boolean): vscode.ThemeIcon =>
  filePresent ? new vscode.ThemeIcon('pass-filled') : new vscode.ThemeIcon('circle-large-outline');

const getSyncIcon = (state: SyncState): vscode.ThemeIcon => {
  switch (state) {
    case 'synced':
      return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
    case 'localOnly':
      return new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('charts.yellow'));
    case 'remoteOnly':
      return new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('charts.blue'));
    case 'conflict':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    case 'remoteDeleted':
      return new vscode.ThemeIcon('trash', new vscode.ThemeColor('list.errorForeground'));
    case 'notPresent':
      return new vscode.ThemeIcon('circle-large-outline');
    case 'unknown':
      return new vscode.ThemeIcon('circle-large-outline');
  }
};

const getSyncDescription = (state: SyncState): string | undefined => {
  switch (state) {
    case 'localOnly':
      return 'modified locally';
    case 'remoteOnly':
      return 'modified in org';
    case 'conflict':
      return 'conflict';
    case 'remoteDeleted':
      return 'deleted in org';
    default:
      return undefined;
  }
};

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
