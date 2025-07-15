/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Effect } from 'effect';
import { ConfigServiceLive } from 'salesforcedx-vscode-services/src/core/configService';
import { ConnectionService, ConnectionServiceLive } from 'salesforcedx-vscode-services/src/core/connectionService';
import { ChannelServiceLayer } from 'salesforcedx-vscode-services/src/vscode/channelService';
import { FsServiceLive } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { WorkspaceService, WorkspaceServiceLive } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import * as vscode from 'vscode';
import { MetadataDescribeService } from '../services/metadataDescribeService';
import { OrgBrowserNode } from './orgBrowserNode';

export const toTreeItem = (node: OrgBrowserNode): vscode.TreeItem => node;

export class MetadataTypeTreeProvider implements vscode.TreeDataProvider<OrgBrowserNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<OrgBrowserNode | undefined | void> = new vscode.EventEmitter();
  public readonly onDidChangeTreeData: vscode.Event<OrgBrowserNode | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private readonly describeService: MetadataDescribeService) {}

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refreshes only the given type node in the tree.
   */
  public refreshType(typeName: string): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      this._onDidChangeTreeData.fire(new OrgBrowserNode('type', typeName));
    });
  }

  // eslint-disable-next-line class-methods-use-this
  public getTreeItem(element: OrgBrowserNode): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: OrgBrowserNode): Promise<OrgBrowserNode[]> {
    // Root: show all types
    if (!element) {
      const types = Array.from(
        await Effect.runPromise(
          this.describeService
            .describeAndStore(false)
            .pipe(
              Effect.provide(FsServiceLive),
              Effect.provide(ChannelServiceLayer('Salesforce Org Browser')),
              Effect.provide(ConfigServiceLive),
              Effect.provideService(WorkspaceService, WorkspaceServiceLive),
              Effect.provideService(ConnectionService, ConnectionServiceLive)
            )
        )
      );
      return types.toSorted((a, b) => (a.xmlName < b.xmlName ? -1 : 1)).map(t => new OrgBrowserNode('type', t.xmlName));
    }
    // Type node: show folders or components
    if (element.kind === 'type') {
      const types = Array.from(
        await Effect.runPromise(
          this.describeService
            .describeAndStore(false)
            .pipe(
              Effect.provide(FsServiceLive),
              Effect.provide(ChannelServiceLayer('Salesforce Org Browser')),
              Effect.provide(ConfigServiceLive),
              Effect.provideService(WorkspaceService, WorkspaceServiceLive),
              Effect.provideService(ConnectionService, ConnectionServiceLive)
            )
        )
      );
      const type = types.find(t => t.xmlName === element.xmlName);
      if (!type) return [];
      if (type.inFolder) {
        // List folders for this type
        const folders = await Effect.runPromise(
          this.describeService
            .listMetadata(`${type.xmlName}Folder`)
            .pipe(
              Effect.provide(FsServiceLive),
              Effect.provideService(ConnectionService, ConnectionServiceLive),
              Effect.provideService(WorkspaceService, WorkspaceServiceLive),
              Effect.provide(ConfigServiceLive),
              Effect.provide(ChannelServiceLayer('Salesforce Org Browser'))
            )
        );
        return folders.map(f => new OrgBrowserNode('folder', type.xmlName, f.fullName));
      } else {
        // List components for this type
        const components = await Effect.runPromise(
          this.describeService
            .listMetadata(type.xmlName)
            .pipe(
              Effect.provide(FsServiceLive),
              Effect.provideService(ConnectionService, ConnectionServiceLive),
              Effect.provideService(WorkspaceService, WorkspaceServiceLive),
              Effect.provide(ConfigServiceLive),
              Effect.provide(ChannelServiceLayer('Salesforce Org Browser'))
            )
        );
        return components.map(c => new OrgBrowserNode('component', type.xmlName, undefined, c.fullName));
      }
    }
    // Folder node: show components in folder
    if (element.kind === 'folder') {
      const { xmlName, folderName } = element;
      if (!xmlName || !folderName) return [];
      const components = await Effect.runPromise(
        this.describeService
          .listMetadata(xmlName, folderName)
          .pipe(
            Effect.provide(FsServiceLive),
            Effect.provideService(ConnectionService, ConnectionServiceLive),
            Effect.provideService(WorkspaceService, WorkspaceServiceLive),
            Effect.provide(ConfigServiceLive),
            Effect.provide(ChannelServiceLayer('Salesforce Org Browser'))
          )
      );
      return components.map(c => new OrgBrowserNode('component', xmlName, folderName, c.fullName));
    }
    // No children for component nodes
    return [];
  }
}
