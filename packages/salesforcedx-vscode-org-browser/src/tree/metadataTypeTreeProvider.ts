/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { MetadataDescribeService } from 'salesforcedx-vscode-services/src/core/metadataDescribeService';
import * as vscode from 'vscode';
import { ExtensionProviderService, ExtensionProviderServiceLive } from '../services/extensionProvider';
import { isFolderType, OrgBrowserNode } from './orgBrowserNode';

type MetadataDescribeResultItem = Effect.Effect.Success<ReturnType<MetadataDescribeService['describe']>>[number];
type CustomObjectField = Effect.Effect.Success<
  ReturnType<MetadataDescribeService['describeCustomObject']>
>['fields'][number];
type MetadataListResultItem = Effect.Effect.Success<ReturnType<MetadataDescribeService['listMetadata']>>[number];
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
    Effect.flatMap(svcProvider => svcProvider.getServicesApi),
    Effect.flatMap(api => {
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
            Effect.map(result =>
              result.fields
                // TO REVIEW: only custom fields can be retrieved.  Is it useful to show the standard fields?  If so, we could hide the retrieve icon
                .filter(f => f.custom)
                .toSorted((a, b) => (a.name < b.name ? -1 : 1))
                .map(customObjectToOrgBrowserNode(element))
            )
          );
        }

        if (element.kind === 'type') {
          return isFolderType(element.xmlName)
            ? describeService
                .listMetadata(`${element.xmlName}Folder`)
                .pipe(Effect.map(folders => folders.map(listMetadataToFolder(element))))
            : describeService
                .listMetadata(element.xmlName)
                .pipe(Effect.map(components => components.map(listMetadataToComponent(element))));
        }
        if (element.kind === 'folderType') {
          return describeService
            .listMetadata(`${element.xmlName}Folder`)
            .pipe(Effect.map(folders => folders.map(listMetadataToFolder(element))));
        }
        if (element.kind === 'folder') {
          const { xmlName, folderName } = element;
          if (!xmlName || !folderName) return Effect.succeed([]);
          return describeService
            .listMetadata(xmlName, folderName)
            .pipe(Effect.map(components => components.map(listMetadataToFolderType(element))));
        }

        return Effect.fail(new Error(`Invalid node kind: ${element.kind}`));
      }).pipe(Effect.provide(allLayers));
    }),
    Effect.provide(ExtensionProviderServiceLive)
  );

const listMetadataToComponent =
  (element: OrgBrowserNode) =>
  (c: MetadataListResultItem): OrgBrowserNode =>
    new OrgBrowserNode({
      kind: element.xmlName === 'CustomObject' ? 'customObject' : 'component',
      xmlName: element.xmlName,
      componentName: c.fullName,
      label: c.fullName
    });

const listMetadataToFolder =
  (element: OrgBrowserNode) =>
  (f: MetadataListResultItem): OrgBrowserNode =>
    new OrgBrowserNode({
      kind: 'folder',
      xmlName: element.xmlName,
      folderName: f.fullName,
      label: f.fullName
    });

const listMetadataToFolderType =
  (element: OrgBrowserNode) =>
  (c: MetadataListResultItem): OrgBrowserNode =>
    new OrgBrowserNode({
      kind: 'component',
      xmlName: element.xmlName,
      folderName: element.folderName,
      componentName: c.fullName,
      label: c.fullName
    });

const mdapiDescribeToOrgBrowserNode = (t: MetadataDescribeResultItem): OrgBrowserNode =>
  new OrgBrowserNode({
    kind: isFolderType(t.xmlName) ? 'folderType' : 'type',
    xmlName: t.xmlName,
    label: t.xmlName
  });

const customObjectToOrgBrowserNode =
  (element: OrgBrowserNode) =>
  (f: CustomObjectField): OrgBrowserNode =>
    new OrgBrowserNode({
      kind: 'component',
      xmlName: 'CustomField',
      componentName: `${element.componentName}.${f.name}`,
      label: getFieldLabel(f)
    });

/** build out the label for a CustomField */
const getFieldLabel = (f: CustomObjectField): string => {
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
