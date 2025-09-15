/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';
import * as vscode from 'vscode';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { createCustomFieldNode } from './customField';
import { backgroundFilePresenceCheckQueue } from './filePresence';
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
   * Refreshes only the given type node in the tree.  Fires the onDidChangeTreeData so you don't have to
   */
  public async refreshType(node?: OrgBrowserTreeItem): Promise<void> {
    await this.getChildren(node, true);
    this._onDidChangeTreeData.fire(node);
  }

  // eslint-disable-next-line class-methods-use-this
  public getTreeItem(element: OrgBrowserTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: OrgBrowserTreeItem, refresh = false): Promise<OrgBrowserTreeItem[]> {
    return await Effect.runPromise(getChildrenOfTreeItem(element, refresh, this));
  }
}

const getChildrenOfTreeItem = (
  element: OrgBrowserTreeItem | undefined,
  refresh: boolean,
  treeProvider: MetadataTypeTreeProvider
): Effect.Effect<OrgBrowserTreeItem[], Error, never> =>
  ExtensionProviderService.pipe(
    Effect.flatMap(svcProvider => svcProvider.getServicesApi),
    Effect.flatMap(api => api.services.MetadataDescribeService),
    Effect.flatMap(describeService => {
      if (!element) {
        return describeService
          .describe(refresh)
          .pipe(
            Effect.map(types =>
              types.toSorted((a, b) => (a.xmlName < b.xmlName ? -1 : 1)).map(mdapiDescribeToOrgBrowserNode)
            )
          );
      }
      if (element.kind === 'customObject') {
        // assertion: componentName is not undefined for customObject nodes.  TODO: clever TS to enforce that
        return describeService
          .describeCustomObject(
            element.namespace ? `${element.namespace}__${element.componentName!}` : element.componentName!
          )
          .pipe(
            Effect.flatMap(result =>
              Effect.all(
                result.fields
                  // TO REVIEW: only custom fields can be retrieved.  Is it useful to show the standard fields?  If so, we could hide the retrieve icon
                  .filter(f => f.custom)
                  .toSorted((a, b) => (a.name < b.name ? -1 : 1))
                  .map(createCustomFieldNode(treeProvider)(element)),
                { concurrency: 'unbounded' }
              )
            )
          );
      }
      if (element.kind === 'folderType' || (element.kind === 'type' && isFolderType(element.xmlName))) {
        return describeService
          .listMetadata(`${element.xmlName}Folder`)
          .pipe(Effect.map(folders => folders.filter(globalMetadataFilter).map(listMetadataToFolder(element))));
      }
      if (element.kind === 'type') {
        return describeService.listMetadata(element.xmlName).pipe(
          Effect.flatMap(components =>
            Effect.all(components.filter(globalMetadataFilter).map(listMetadataToComponent(treeProvider)(element)), {
              concurrency: 'unbounded'
            })
          )
        );
      }
      if (element.kind === 'folder') {
        const { xmlName, folderName } = element;
        if (!xmlName || !folderName) return Effect.succeed([]);
        return describeService.listMetadata(xmlName, folderName).pipe(
          Effect.flatMap(components =>
            Effect.all(components.filter(globalMetadataFilter).map(listMetadataToFolderItem(treeProvider)(element)), {
              concurrency: 'unbounded'
            })
          )
        );
      }

      return Effect.die(new Error(`Invalid node kind: ${element.kind}`));
    }),
    Effect.provide(AllServicesLayer),
    Effect.withSpan('getChildrenOfTreeItem', { attributes: { element: element?.xmlName } })
  );

const listMetadataToComponent =
  (treeProvider: MetadataTypeTreeProvider) =>
  (element: OrgBrowserTreeItem) =>
  (c: MetadataListResultItem): Effect.Effect<OrgBrowserTreeItem, Error, never> =>
    Effect.gen(function* () {
      const treeItem = new OrgBrowserTreeItem({
        kind: element.xmlName === 'CustomObject' ? 'customObject' : 'component',
        namespace: c.namespacePrefix,
        xmlName: element.xmlName,
        componentName: c.fullName,
        label: c.fullName
      });
      yield* Queue.offer(backgroundFilePresenceCheckQueue, {
        treeItem,
        c,
        treeProvider,
        parent: element,
        originalSpan: yield* Effect.currentSpan
      });
      return treeItem;
    }).pipe(
      Effect.withSpan('listMetadataToComponent', {
        attributes: { xmlName: element.xmlName, componentName: c.fullName }
      })
    );

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
  (treeProvider: MetadataTypeTreeProvider) =>
  (element: OrgBrowserTreeItem) =>
  (c: MetadataListResultItem): Effect.Effect<OrgBrowserTreeItem, Error, never> =>
    Effect.gen(function* () {
      const treeItem = new OrgBrowserTreeItem({
        kind: 'component',
        namespace: c.namespacePrefix,
        xmlName: element.xmlName,
        folderName: element.folderName,
        componentName: c.fullName,
        label: c.fullName
      });
      yield* Queue.offer(backgroundFilePresenceCheckQueue, {
        treeItem,
        c,
        treeProvider,
        parent: element,
        originalSpan: yield* Effect.currentSpan
      });
      return treeItem;
    }).pipe(
      Effect.withSpan('listMetadataToFolderItem', {
        attributes: { xmlName: element.xmlName, componentName: c.fullName }
      })
    );

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
