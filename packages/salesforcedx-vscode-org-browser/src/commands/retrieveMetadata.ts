/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataMember, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import {
  AllServicesLayer,
  ExtensionProviderService,
  ExtensionProviderServiceLive
} from '../services/extensionProvider';
import { MetadataTypeTreeProvider } from '../tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem, getIconPath } from '../tree/orgBrowserNode';

export const retrieveOrgBrowserTreeItemCommand = async (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
): Promise<void> => {
  const target = getRetrieveTarget(node);
  if (!target) return;

  await Effect.runPromise(retrieveEffect(node, treeProvider, target));
};

const retrieveEffect = (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider,
  target: MetadataMember
): Effect.Effect<RetrieveResult | void, never, never> =>
  Effect.gen(function* () {
    const extensionProvider = yield* ExtensionProviderService;
    const api = yield* extensionProvider.getServicesApi;
    const allLayers = AllServicesLayer;

    // Run the retrieve operation
    const result = yield* Effect.provide(
      Effect.flatMap(api.services.MetadataRetrieveService, svc => svc.retrieve([target])),
      allLayers
    );

    // Handle post-retrieve UI updates
    yield* Effect.promise(async () => {
      if (node.kind === 'component') {
        node.iconPath = getIconPath(true);
        treeProvider.fireChangeEvent(node);
      } else {
        await treeProvider.refreshType(node);
      }
    });

    return result;
  }).pipe(
    Effect.provide(ExtensionProviderServiceLive),
    Effect.catchAll(error =>
      Effect.sync(() => {
        vscode.window.showErrorMessage(`Retrieve failed: ${String(error)}`);
      })
    )
  );

const getRetrieveTarget = (node: OrgBrowserTreeItem): MetadataMember | undefined => {
  if (node.kind === 'folderType') {
    // folderType nodes don't have retrieve functionality
    return undefined;
  }
  if (node.kind === 'type') {
    // called retrieve on the entire type
    return { type: node.xmlName, fullName: '*' };
  }

  if (node.kind === 'component' && node.componentName !== undefined) {
    return { type: node.xmlName, fullName: node.componentName };
  }
};
