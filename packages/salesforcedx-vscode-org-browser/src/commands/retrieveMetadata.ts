/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataTypeTreeProvider } from '../tree/metadataTypeTreeProvider';
import type { ComponentSet, MetadataMember, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Brand from 'effect/Brand';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import type { SuccessfulCancelResult } from 'salesforcedx-vscode-services/src/vscode/cancellation';
import * as vscode from 'vscode';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { OrgBrowserRetrieveService } from '../services/orgBrowserMetadataRetrieveService';
import { OrgBrowserTreeItem, getIconPath } from '../tree/orgBrowserNode';

export const retrieveOrgBrowserTreeItemCommand = async (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
): Promise<void> => {
  const result = await Effect.runPromise(retrieveEffect(node, treeProvider));
  if (typeof result === 'string') {
    vscode.window.showInformationMessage('Retrieve canceled');
  }
};

const retrieveEffect = (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
  // void since we catch all the errors and show the vscode error message
): Effect.Effect<RetrieveResult | SuccessfulCancelResult | void, never, never> =>
  Effect.gen(function* () {
    const target = getRetrieveTarget(node);
    if (target._tag === 'None') {
      return;
    }

    yield* Effect.annotateCurrentSpan({ target: target.value.fullName });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const [projectService, retrieveService] = yield* Effect.all([
      api.services.ProjectService,
      api.services.MetadataRetrieveService
    ]);

    const dirs = (yield* projectService.getSfProject).getPackageDirectories().map(directory => directory.fullPath);

    const localComponents = yield* retrieveService.buildComponentSetFromSource([target.value], dirs);

    if (!(yield* confirmOverwrite(localComponents, target.value))) {
      return Brand.nominal<SuccessfulCancelResult>()('User canceled');
    }

    // Run the retrieve operation
    const result = yield* (yield* OrgBrowserRetrieveService).retrieve([target.value], target.value.fullName !== '*');

    if (typeof result !== 'string')
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

const getRetrieveTarget = (node: OrgBrowserTreeItem): Option.Option<MetadataMember> => {
  if (node.kind === 'folderType') {
    // folderType nodes don't have retrieve functionality
    return Option.none();
  }
  if (node.kind === 'type') {
    // called retrieve on the entire type
    return Option.some({ type: node.xmlName, fullName: '*' });
  }

  if ((node.kind === 'component' || node.kind === 'customObject') && node.componentName !== undefined) {
    return Option.some({ type: node.xmlName, fullName: node.componentName });
  }
  return Option.none();
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
