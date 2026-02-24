/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { AllServicesLayer } from '../services/extensionProvider';
import { createCustomFieldNode } from './customField';
import { isFolderType, OrgBrowserTreeItem } from './orgBrowserNode';
import { MetadataListResultItem, MetadataDescribeResultItem } from './types';

export class MetadataTypeTreeProvider implements vscode.TreeDataProvider<OrgBrowserTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<OrgBrowserTreeItem | undefined | void> = new vscode.EventEmitter();
  public readonly onDidChangeTreeData: vscode.Event<OrgBrowserTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  /** fire the onDidChangeTreeData event for the node to cause vscode ui to update */
  public fireChangeEvent(node?: OrgBrowserTreeItem): void {
    this._onDidChangeTreeData.fire(node);
  }

  /**
   * Refreshes only the given type node in the tree. Firing causes VS Code to call getChildren once.
   */
  public async refreshType(node?: OrgBrowserTreeItem): Promise<void> {
    this._onDidChangeTreeData.fire(node);
  }

  // eslint-disable-next-line class-methods-use-this
  public getTreeItem(element: OrgBrowserTreeItem): vscode.TreeItem {
    return element;
  }

  // eslint-disable-next-line class-methods-use-this
  public async getChildren(element?: OrgBrowserTreeItem, refresh = false): Promise<OrgBrowserTreeItem[]> {
    return await Effect.runPromise(getChildrenOfTreeItem(element, refresh));
  }
}

const getChildrenOfTreeItem = (element: OrgBrowserTreeItem | undefined, refresh: boolean) =>
  Effect.gen(function* () {
    const svcProvider = yield* ExtensionProviderService;
    const api = yield* svcProvider.getServicesApi;
    // this could be the initial load, before the org is set.  Prevents duplication loads of root
    if (!(yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId) {
      return yield* Effect.succeed([]);
    }
    if (!element) {
      const types = yield* api.services.MetadataDescribeService.describe(refresh);
      return types.toSorted((a, b) => (a.xmlName < b.xmlName ? -1 : 1)).map(mdapiDescribeToOrgBrowserNode);
    }
    if (element.kind === 'customObject') {
      // assertion: componentName is not undefined for customObject nodes.  TODO: clever TS to enforce that
      const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
      const objectName = element.namespace
        ? `${element.namespace}__${element.componentName!}`
        : element.componentName!;
      const result = yield* api.services.MetadataDescribeService.describeCustomObject(objectName);
      return yield* Effect.all(
        result.fields
          // TO REVIEW: only custom fields can be retrieved.  Is it useful to show the standard fields?  If so, we could hide the retrieve icon
          .filter(f => f.custom)
          .toSorted((a, b) => (a.name < b.name ? -1 : 1))
          .map(createCustomFieldNode(projectComponentSet)(element)),
        { concurrency: 'unbounded' }
      );
    }
    if (element.kind === 'folderType' || (element.kind === 'type' && isFolderType(element.xmlName))) {
      return yield* api.services.MetadataDescribeService.listMetadata(`${element.xmlName}Folder`).pipe(
        Effect.map(folders => folders.filter(globalMetadataFilter).map(listMetadataToFolder(element)))
      );
    }
    if (element.kind === 'type') {
      const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
      return yield* api.services.MetadataDescribeService.listMetadata(element.xmlName).pipe(
        Effect.flatMap(components =>
          Stream.fromIterable(components.filter(globalMetadataFilter)).pipe(
            Stream.map(c => listMetadataToComponent(projectComponentSet)(element)(c)),
            Stream.runCollect,
            Effect.map(chunk => Array.from(chunk))
          )
        )
      );
    }
    if (element.kind === 'folder') {
      const { xmlName, folderName } = element;
      if (!xmlName || !folderName) return yield* Effect.succeed([]);
      const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
      return yield* api.services.MetadataDescribeService.listMetadata(xmlName, folderName).pipe(
        Effect.flatMap(components =>
          Stream.fromIterable(components.filter(globalMetadataFilter)).pipe(
            Stream.map(c => listMetadataToFolderItem(projectComponentSet)(element)(c)),
            Stream.runCollect,
            Effect.map(chunk => Array.from(chunk))
          )
        )
      );
    }

    return yield* Effect.die(new Error(`Unsupported node kind: ${JSON.stringify(element)}`));
  }).pipe(
    Effect.withSpan('getChildrenOfTreeItem', { attributes: { element: element?.xmlName, refresh } }),
    Effect.provide(AllServicesLayer)
  );

const listMetadataToComponent =
  (projectComponentSet: ComponentSet) =>
  (element: OrgBrowserTreeItem) =>
  (c: MetadataListResultItem): OrgBrowserTreeItem => {
    const filePaths = projectComponentSet.getComponentFilenamesByNameAndType({
      fullName: c.fullName,
      type: c.type
    });
    return new OrgBrowserTreeItem({
      kind: element.xmlName === 'CustomObject' ? 'customObject' : 'component',
      namespace: c.namespacePrefix,
      xmlName: element.xmlName,
      componentName: c.fullName,
      label: c.fullName,
      filePresent: filePaths.length > 0
    });
  };

const listMetadataToFolder =
  (element: OrgBrowserTreeItem) =>
  (c: MetadataListResultItem): OrgBrowserTreeItem =>
    new OrgBrowserTreeItem({
      kind: 'folder',
      xmlName: element.xmlName,
      namespace: c.namespacePrefix,
      folderName: c.fullName,
      label: c.fullName
    });

const listMetadataToFolderItem =
  (projectComponentSet: ComponentSet) =>
  (element: OrgBrowserTreeItem) =>
  (c: MetadataListResultItem): OrgBrowserTreeItem => {
    const filePaths = projectComponentSet.getComponentFilenamesByNameAndType({
      fullName: c.fullName,
      type: c.type
    });
    return new OrgBrowserTreeItem({
      kind: 'component',
      namespace: c.namespacePrefix,
      xmlName: element.xmlName,
      folderName: element.folderName,
      componentName: c.fullName,
      label: c.fullName,
      filePresent: filePaths.length > 0
    });
  };

const mdapiDescribeToOrgBrowserNode = (t: MetadataDescribeResultItem): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({
    kind: isFolderType(t.xmlName) ? 'folderType' : 'type',
    xmlName: t.xmlName,
    label: t.xmlName
  });

/** applies to all listMetadata calls */
const globalMetadataFilter = (i: MetadataListResultItem): boolean => hasFullName(i) && isSupportedManageableState(i);

const hasFullName = (i: MetadataListResultItem): boolean => Boolean(i.fullName);
const isSupportedManageableState = (i: MetadataListResultItem): boolean =>
  !i.manageableState || ['unmanaged', 'installedEditable', 'deprecatedEditable'].includes(i.manageableState);
