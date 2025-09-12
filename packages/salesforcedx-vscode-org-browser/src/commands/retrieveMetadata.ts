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
import { OrgBrowserRetrieveService } from '../services/orgBrowserMetadataRetrieveService';
import { OrgBrowserTreeItem, getIconPath } from '../tree/orgBrowserNode';

export const retrieveOrgBrowserTreeItemCommand = async (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
): Promise<void> => {
  await Effect.runPromise(retrieveEffect(node, treeProvider));
};

const retrieveEffect = (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
): Effect.Effect<RetrieveResult | void, never, never> =>
  Effect.gen(function* () {
    const target = getRetrieveTarget(node);
    if (!target) {
      return;
    }
    yield* Effect.annotateCurrentSpan({ target: target.fullName });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const [projectService, retrieveService] = yield* Effect.all([
      api.services.ProjectService,
      api.services.MetadataRetrieveService
    ]);

    const dirs = (yield* projectService.getSfProject).getPackageDirectories().map(directory => directory.fullPath);

    console.log('dirs', dirs);
    const localComponents = yield* retrieveService.buildComponentSetFromSource([target], dirs);

    if (!(yield* confirmOverwrite(localComponents, target))) return;

    // Run the retrieve operation
    const result = yield* (yield* OrgBrowserRetrieveService).retrieve([target], true);

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
    Effect.withSpan('orgBrowserRetrieveMetadataCommand'),
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

  if ((node.kind === 'component' || node.kind === 'customObject') && node.componentName !== undefined) {
    return { type: node.xmlName, fullName: node.componentName };
  }
};

const confirmOverwrite = (localComponents: ComponentSet, target: MetadataMember): Effect.Effect<boolean> =>
  Effect.promise(async () => {
    if (localComponents.size === 0) return true;
    const answer = await vscode.window.showWarningMessage(
      // TODO: i18n
      `Overwrite local files for ${localComponents.size} ${target.type} ?`,
      'Yes',
      'No'
    );
    return answer === 'Yes';
  });
