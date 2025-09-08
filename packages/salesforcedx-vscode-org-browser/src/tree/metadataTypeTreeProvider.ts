/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { MetadataRegistryService } from 'salesforcedx-vscode-services/src/core/metadataRegistryService';
import { MetadataRetrieveService } from 'salesforcedx-vscode-services/src/core/metadataRetrieveService';
import { SdkLayer } from 'salesforcedx-vscode-services/src/observability/spans';
import { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import * as vscode from 'vscode';
import { ExtensionProviderService, ExtensionProviderServiceLive } from '../services/extensionProvider';
import { createCustomFieldNode } from './customField';
import { getFileGlob, fileIsPresent } from './filePresence';
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

  // eslint-disable-next-line class-methods-use-this
  public async getChildren(element?: OrgBrowserTreeItem, refresh = false): Promise<OrgBrowserTreeItem[]> {
    return await Effect.runPromise(getChildrenOfTreeItem(element, refresh));
  }
}

const getChildrenOfTreeItem = (
  element: OrgBrowserTreeItem | undefined,
  refresh: boolean
): Effect.Effect<OrgBrowserTreeItem[], Error, never> =>
  ExtensionProviderService.pipe(
    Effect.flatMap(svcProvider => svcProvider.getServicesApi),
    Effect.flatMap(api => {
      const allLayers = Layer.mergeAll(
        api.services.MetadataDescribeServiceLive,
        api.services.MetadataRegistryServiceLive,
        api.services.MetadataRetrieveServiceLive,
        api.services.ConnectionServiceLive,
        api.services.ConfigServiceLive,
        api.services.WorkspaceServiceLive,
        api.services.SettingsServiceLive,
        api.services.SdkLayer,
        api.services.MetadataRegistryServiceLive,
        Layer.provideMerge(api.services.FsServiceLive, api.services.ChannelServiceLayer('Salesforce Org Browser'))
      );
      return Effect.flatMap(api.services.MetadataDescribeService, describeService => {
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
          return describeService.describeCustomObject(element.componentName!).pipe(
            Effect.flatMap(result =>
              Effect.all(
                result.fields
                  // TO REVIEW: only custom fields can be retrieved.  Is it useful to show the standard fields?  If so, we could hide the retrieve icon
                  .filter(f => f.custom)
                  .toSorted((a, b) => (a.name < b.name ? -1 : 1))
                  .map(createCustomFieldNode(element)),
                { concurrency: 'unbounded' }
              )
            )
          );
        }
        if (element.kind === 'folderType' || (element.kind === 'type' && isFolderType(element.xmlName))) {
          return describeService
            .listMetadata(`${element.xmlName}Folder`)
            .pipe(Effect.map(folders => folders.map(listMetadataToFolder(element))));
        }
        if (element.kind === 'type') {
          return describeService
            .listMetadata(element.xmlName)
            .pipe(
              Effect.flatMap(components =>
                Effect.all(components.map(listMetadataToComponent(element)), { concurrency: 'unbounded' })
              )
            );
        }
        if (element.kind === 'folder') {
          const { xmlName, folderName } = element;
          if (!xmlName || !folderName) return Effect.succeed([]);
          return describeService
            .listMetadata(xmlName, folderName)
            .pipe(
              Effect.flatMap(components =>
                Effect.all(components.map(listMetadataToFolderItem(element)), { concurrency: 'unbounded' })
              )
            );
        }

        return Effect.fail(new Error(`Invalid node kind: ${element.kind}`));
      }).pipe(Effect.provide(allLayers));
    }),
    Effect.withSpan('getChildrenOfTreeItem'),
    Effect.provide(ExtensionProviderServiceLive)
  );

const listMetadataToComponent =
  (element: OrgBrowserTreeItem) =>
  (
    c: MetadataListResultItem
  ): Effect.Effect<OrgBrowserTreeItem, Error, MetadataRetrieveService | MetadataRegistryService | WorkspaceService> =>
    Effect.gen(function* () {
      const globs = yield* getFileGlob(element.xmlName)(c);
      const isPresent = yield* fileIsPresent(globs[0]);

      return new OrgBrowserTreeItem({
        kind: element.xmlName === 'CustomObject' ? 'customObject' : 'component',
        xmlName: element.xmlName,
        componentName: c.fullName,
        label: c.fullName,
        filePresent: isPresent
      });
    }).pipe(
      Effect.withSpan('listMetadataToComponent', {
        attributes: { xmlName: element.xmlName, componentName: c.fullName }
      }),
      Effect.provide(SdkLayer)
    );

const listMetadataToFolder =
  (element: OrgBrowserTreeItem) =>
  (f: MetadataListResultItem): OrgBrowserTreeItem =>
    new OrgBrowserTreeItem({
      kind: 'folder',
      xmlName: element.xmlName,
      folderName: f.fullName,
      label: f.fullName
    });

const listMetadataToFolderItem =
  (element: OrgBrowserTreeItem) =>
  (
    c: MetadataListResultItem
  ): Effect.Effect<OrgBrowserTreeItem, Error, MetadataRetrieveService | MetadataRegistryService | WorkspaceService> =>
    Effect.gen(function* () {
      const globs = yield* getFileGlob(element.xmlName)(c);
      const isPresent = yield* fileIsPresent(globs[0]);

      return new OrgBrowserTreeItem({
        kind: 'component',
        xmlName: element.xmlName,
        folderName: element.folderName,
        componentName: c.fullName,
        label: c.fullName,
        filePresent: isPresent
      });
    }).pipe(
      Effect.withSpan('listMetadataToFolderItem', {
        attributes: { xmlName: element.xmlName, componentName: c.fullName }
      }),
      Effect.provide(SdkLayer)
    );

const mdapiDescribeToOrgBrowserNode = (t: MetadataDescribeResultItem): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({
    kind: isFolderType(t.xmlName) ? 'folderType' : 'type',
    xmlName: t.xmlName,
    label: t.xmlName
  });
