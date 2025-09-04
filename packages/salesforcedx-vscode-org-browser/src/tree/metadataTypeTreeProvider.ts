/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import type { DescribeSObjectResult } from 'jsforce';
import * as vscode from 'vscode';
import { ExtensionProviderService, ExtensionProviderServiceLive } from '../services/extensionProvider';
import { isFolderType, OrgBrowserNode } from './orgBrowserNode';

export class MetadataTypeTreeProvider implements vscode.TreeDataProvider<OrgBrowserNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<OrgBrowserNode | undefined | void> = new vscode.EventEmitter();
  public readonly onDidChangeTreeData: vscode.Event<OrgBrowserNode | undefined | void> =
    this._onDidChangeTreeData.event;

  /**
   * Refreshes only the given type node in the tree.
   */
  public async refreshType(node?: OrgBrowserNode): Promise<void> {
    await this.getChildren(node, true);
    this._onDidChangeTreeData.fire(node);
  }

  // eslint-disable-next-line class-methods-use-this
  public getTreeItem(element: OrgBrowserNode): vscode.TreeItem {
    return element;
  }

  // eslint-disable-next-line class-methods-use-this
  public async getChildren(element?: OrgBrowserNode, refresh = false): Promise<OrgBrowserNode[]> {
    return await Effect.runPromise(program(element, refresh));
  }
}

const program = (
  element: OrgBrowserNode | undefined,
  refresh: boolean
): Effect.Effect<OrgBrowserNode[], Error, never> =>
  ExtensionProviderService.pipe(
    Effect.flatMap(svcProvider =>
      Effect.flatMap(svcProvider.getServicesApi, api => {
        const allLayers = Layer.mergeAll(
          api.services.MetadataDescribeServiceLive,
          api.services.ConnectionServiceLive,
          api.services.ConfigServiceLive,
          api.services.WorkspaceServiceLive,
          api.services.SettingsServiceLive,
          Layer.provideMerge(api.services.FsServiceLive, api.services.ChannelServiceLayer('Salesforce Org Browser'))
        );
        return Effect.flatMap(api.services.MetadataDescribeService, describeService => {
          if (!element) {
            return describeService.describe(refresh).pipe(
              Effect.map(types =>
                Array.from(types)
                  .toSorted((a, b) => (a.xmlName < b.xmlName ? -1 : 1))
                  .map(
                    t =>
                      new OrgBrowserNode({
                        kind: isFolderType(t.xmlName) ? 'folderType' : 'type',
                        xmlName: t.xmlName,
                        label: t.xmlName
                      })
                  )
              )
            );
          }
          // return the custom fields for the object
          if (element.kind === 'customObject') {
            // assertion: componentName is not undefined for customObject nodes.  TODO: clever TS to enforce that
            return describeService.describeCustomObject(element.componentName!).pipe(
              Effect.map(result =>
                result.fields
                  // TO REVIEW: only custom fields can be retrieved.  Is it useful to show the standard fields?  If so, we could hide the retrieve icon
                  .filter(f => f.custom)
                  .toSorted((a, b) => (a.name < b.name ? -1 : 1))
                  .map(
                    f =>
                      new OrgBrowserNode({
                        kind: 'component',
                        xmlName: 'CustomField',
                        componentName: `${element.componentName}.${f.name}`,
                        label: getFieldLabel(f)
                      })
                  )
              )
            );
          }

          if (element.kind === 'type') {
            if (isFolderType(element.xmlName)) {
              return describeService.listMetadata(`${element.xmlName}Folder`).pipe(
                Effect.map(folders =>
                  folders.map(
                    f =>
                      new OrgBrowserNode({
                        kind: 'folder',
                        xmlName: element.xmlName,
                        folderName: f.fullName,
                        label: f.fullName
                      })
                  )
                )
              );
            } else {
              return describeService.listMetadata(element.xmlName).pipe(
                Effect.map(components =>
                  components.map(
                    c =>
                      new OrgBrowserNode({
                        kind: element.xmlName === 'CustomObject' ? 'customObject' : 'component',
                        xmlName: element.xmlName,
                        componentName: c.fullName,
                        label: c.fullName
                      })
                  )
                )
              );
            }
          }
          if (element.kind === 'folderType') {
            return describeService.listMetadata(`${element.xmlName}Folder`).pipe(
              Effect.map(folders =>
                folders.map(
                  f =>
                    new OrgBrowserNode({
                      kind: 'folder',
                      xmlName: element.xmlName,
                      folderName: f.fullName,
                      label: f.fullName
                    })
                )
              )
            );
          }
          if (element.kind === 'folder') {
            const { xmlName, folderName } = element;
            if (!xmlName || !folderName) return Effect.succeed([]);
            return describeService.listMetadata(xmlName, folderName).pipe(
              Effect.map(components =>
                components.map(
                  c =>
                    new OrgBrowserNode({
                      kind: 'component',
                      xmlName,
                      folderName,
                      componentName: c.fullName,
                      label: c.fullName
                    })
                )
              )
            );
          }

          return Effect.fail(new Error(`Invalid node kind: ${element.kind}`));
        }).pipe(Effect.provide(allLayers));
      })
    ),
    Effect.provide(ExtensionProviderServiceLive)
  );

/** build out the label for a CustomField */
const getFieldLabel = (f: DescribeSObjectResult['fields'][number]): string => {
  switch (f.type) {
    case 'string':
    case 'textarea':
    case 'email':
      return `${f.name} | ${f.type} | length: ${f.length?.toLocaleString()}`;
    case 'reference':
      return `${f.relationshipName} | reference`;
    case 'double':
    case 'currency':
    case 'percent':
      return `${f.name} | ${f.type} | scale: ${f.scale} | precision: ${f.precision}`;
    default:
      return `${f.name} | ${f.type}`;
  }
};
