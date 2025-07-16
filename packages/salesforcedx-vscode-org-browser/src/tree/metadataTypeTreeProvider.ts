/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { pipe, Effect, Layer } from 'effect';
import * as vscode from 'vscode';
import { ExtensionProviderService, ExtensionProviderServiceLive } from '../services/extensionProvider';
import { MetadataDescribeService, MetadataDescribeServiceLive } from '../services/metadataDescribeService';
import { isFolderType, OrgBrowserNode } from './orgBrowserNode';

export const toTreeItem = (node: OrgBrowserNode): vscode.TreeItem => node;
export class MetadataTypeTreeProvider implements vscode.TreeDataProvider<OrgBrowserNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<OrgBrowserNode | undefined | void> = new vscode.EventEmitter();
  public readonly onDidChangeTreeData: vscode.Event<OrgBrowserNode | undefined | void> =
    this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refreshes only the given type node in the tree.
   */
  public refreshType(typeName: string): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      const kind = isFolderType(typeName) ? 'folderType' : 'type';
      this._onDidChangeTreeData.fire(new OrgBrowserNode(kind, typeName));
    });
  }

  // eslint-disable-next-line class-methods-use-this
  public getTreeItem(element: OrgBrowserNode): vscode.TreeItem {
    return element;
  }

  // eslint-disable-next-line class-methods-use-this
  public async getChildren(element?: OrgBrowserNode): Promise<OrgBrowserNode[]> {
    const program = pipe(
      Effect.flatMap(ExtensionProviderService, svcProvider =>
        Effect.flatMap(svcProvider.getServicesApi, api => {
          const fsWithChannel = Layer.provideMerge(
            api.services.FsServiceLive,
            api.services.ChannelServiceLayer('Salesforce Org Browser')
          );
          const allLayers = Layer.mergeAll(
            MetadataDescribeServiceLive,
            api.services.ConnectionServiceLive,
            api.services.ConfigServiceLive,
            api.services.WorkspaceServiceLive,
            fsWithChannel
          );
          return Effect.flatMap(MetadataDescribeService, describeService => {
            if (!element) {
              return describeService.describe(false).pipe(
                Effect.map(types =>
                  Array.from(types)
                    .toSorted((a, b) => (a.xmlName < b.xmlName ? -1 : 1))
                    .map(t => new OrgBrowserNode(isFolderType(t.xmlName) ? 'folderType' : 'type', t.xmlName))
                )
              );
            }
            if (element.kind === 'type') {
              if (isFolderType(element.xmlName)) {
                return describeService
                  .listMetadata(`${element.xmlName}Folder`)
                  .pipe(
                    Effect.map(folders => folders.map(f => new OrgBrowserNode('folder', element.xmlName, f.fullName)))
                  );
              } else {
                return describeService.listMetadata(element.xmlName).pipe(
                  Effect.map(components =>
                    components.map(c => {
                      const n = new OrgBrowserNode('component', element.xmlName, undefined, c.fullName);
                      n.collapsibleState = vscode.TreeItemCollapsibleState.None;
                      return n;
                    })
                  )
                );
              }
            }
            if (element.kind === 'folderType') {
              return describeService
                .listMetadata(`${element.xmlName}Folder`)
                .pipe(
                  Effect.map(folders => folders.map(f => new OrgBrowserNode('folder', element.xmlName, f.fullName)))
                );
            }
            if (element.kind === 'folder') {
              const { xmlName, folderName } = element;
              if (!xmlName || !folderName) return Effect.succeed([]);
              return describeService
                .listMetadata(xmlName, folderName)
                .pipe(
                  Effect.map(components =>
                    components.map(c => new OrgBrowserNode('component', xmlName, folderName, c.fullName))
                  )
                );
            }

            return Effect.succeed([]);
          }).pipe(Effect.provide(allLayers));
        })
      ),
      Effect.provide(ExtensionProviderServiceLive)
    );
    return await Effect.runPromise(program);
  }
}
