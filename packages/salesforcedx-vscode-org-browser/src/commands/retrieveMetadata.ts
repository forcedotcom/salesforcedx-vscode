/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { ExtensionProviderServiceLive } from '../services/extensionProvider';
import { MetadataRetrieveService, MetadataRetrieveServiceLive } from '../services/metadataRetrieveService';
import { MetadataTypeTreeProvider } from '../tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem, getIconPath } from '../tree/orgBrowserNode';

export const retrieveOrgBrowserTreeItemCommand = async (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
): Promise<void> => {
  const target = getRetrieveTarget(node);
  if (!target) return;

  const retrieveEffect = MetadataRetrieveService.pipe(
    Effect.flatMap(svc => svc.retrieve([target], node.kind === 'component')),
    Effect.catchAll(error =>
      Effect.sync(() => {
        vscode.window.showErrorMessage(`Retrieve failed: ${error.message}`);
      })
    ),
    Effect.provide(Layer.mergeAll(MetadataRetrieveServiceLive, ExtensionProviderServiceLive))
  );
  await Effect.runPromise(retrieveEffect);

  if (node.kind === 'component') {
    node.iconPath = getIconPath(true);
    treeProvider.fireChangeEvent(node);
  } else {
    await treeProvider.refreshType(node);
  }
};

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
