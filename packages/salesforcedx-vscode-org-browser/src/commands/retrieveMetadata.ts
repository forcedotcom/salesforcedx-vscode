/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataTypeTreeProvider } from '../tree/metadataTypeTreeProvider';
import type { ComponentSet, MetadataMember, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { OrgBrowserTreeItem, getIconPath } from '../tree/orgBrowserNode';

export const retrieveOrgBrowserTreeItemCommand = async (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
): Promise<void> => {
  const target = getRetrieveTarget(node);

  if (!target) {
    return;
  }

  await Effect.runPromise(retrieveEffect(node, treeProvider, target));
};

const retrieveEffect = (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider,
  target: MetadataMember
): Effect.Effect<RetrieveResult | void, never, never> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const dirs = (yield* (yield* api.services.ProjectService).getSfProject)
      .getPackageDirectories()
      .map(directory => directory.fullPath);

    const compSet = yield* (yield* api.services.MetadataRetrieveService).buildComponentSetFromSource([target], dirs);

    if (!(yield* confirmOverwrite(compSet))) return;

    // Run the retrieve operation
    const result = yield* (yield* api.services.MetadataRetrieveService).retrieve([target]);

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
    Effect.provide(AllServicesLayer),
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

const confirmOverwrite = (compSet: ComponentSet): Effect.Effect<boolean> =>
  Effect.promise(async () => {
    if (compSet.size === 0) return true;
    const answer = await vscode.window.showInformationMessage(
      // TODO: i18n
      `Overwrite local files for ${compSet.size} metadata component${compSet.size === 1 ? '' : 's'}?`,
      'Yes',
      'No'
    );
    return answer === 'Yes';
  });
