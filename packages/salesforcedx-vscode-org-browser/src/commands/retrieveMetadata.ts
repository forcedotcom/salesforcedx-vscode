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
import { nls } from '../messages';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { OrgBrowserRetrieveService } from '../services/orgBrowserMetadataRetrieveService';
import { OrgBrowserTreeItem, getIconPath } from '../tree/orgBrowserNode';

export const retrieveOrgBrowserTreeItemCommand = async (
  node: OrgBrowserTreeItem | undefined,
  treeProvider: MetadataTypeTreeProvider
): Promise<void> => {
  if (!node) {
    void vscode.window.showErrorMessage(nls.localize('retrieve_failed', 'No tree item selected'));
    return;
  }
  const result = await Effect.runPromise(retrieveEffect(node, treeProvider));
  if (typeof result === 'string') {
    void vscode.window.showInformationMessage(nls.localize('retrieve_canceled'));
  }
};

const retrieveEffect = (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
  // void since we catch all the errors and show the vscode error message
): Effect.Effect<RetrieveResult | SuccessfulCancelResult | void, never> =>
  /* eslint-disable @typescript-eslint/consistent-type-assertions */
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

    // When retrieving at type level (wildcard), explicitly list all components from the org
    // This ensures all components are retrieved instead of relying on wildcard expansion
    let membersToRetrieve: MetadataMember[] = [target.value];
    if (target.value.fullName === '*') {
      const describeService = yield* api.services.MetadataDescribeService;
      const components = yield* describeService.listMetadata(target.value.type);
      // Convert listMetadata results to MetadataMember format
      membersToRetrieve = components
        .filter(c => c.fullName && c.type)
        .map(c => ({ type: c.type, fullName: c.fullName! }));

      // If no components found, return early
      if (membersToRetrieve.length === 0) {
        void vscode.window.showInformationMessage(
          nls.localize('retrieve_no_components', `No ${target.value.type} components found in org`)
        );
        return;
      }
    }

    const localComponents = yield* retrieveService.buildComponentSetFromSource(membersToRetrieve, dirs);

    if (!(yield* confirmOverwrite(localComponents, target.value))) {
      return Brand.nominal<SuccessfulCancelResult>()('User canceled');
    }

    // Run the retrieve operation
    const result = yield* (yield* OrgBrowserRetrieveService).retrieve(membersToRetrieve, target.value.fullName !== '*');

    if (typeof result !== 'string')
      // Handle post-retrieve UI updates
      yield* Effect.gen(function* () {
        if (node.kind === 'component') {
          node.iconPath = getIconPath(true);
          node.filePresent = true;
          treeProvider.fireChangeEvent(node);
        } else if (node.kind === 'customObject') {
          // For CustomObject nodes, refresh children and update icon directly
          // Since we just retrieved it, we know the files are present
          yield* Effect.promise(async () => {
            await treeProvider.refreshType(node);
            // Update the icon directly after refresh (files are present since we just retrieved)
            // Re-find the node from cache in case refreshType created a new instance
            const cachedNode = node.id ? treeProvider.findTreeItemById(node.id) : node;
            if (cachedNode) {
              cachedNode.iconPath = getIconPath(true);
              cachedNode.filePresent = true;
              treeProvider.fireChangeEvent(cachedNode);
            } else {
              // Fallback: update the original node
              node.iconPath = getIconPath(true);
              node.filePresent = true;
              treeProvider.fireChangeEvent(node);
            }
          });
        } else {
          yield* Effect.promise(async () => {
            await treeProvider.refreshType(node);
          });
        }
      }).pipe(Effect.provide(AllServicesLayer));

    return result;
  }).pipe(
    Effect.withSpan('orgBrowserRetrieveMetadataCommand'),
    Effect.provide(AllServicesLayer),
    Effect.catchAll(error =>
      Effect.sync(() => {
        void vscode.window.showErrorMessage(nls.localize('retrieve_failed', String(error)));
      })
    )
  ) as Effect.Effect<RetrieveResult | SuccessfulCancelResult | void, never>;
/* eslint-enable @typescript-eslint/consistent-type-assertions */

const getRetrieveTarget = (node: OrgBrowserTreeItem): Option.Option<MetadataMember> => {
  if (!node?.kind) {
    return Option.none();
  }
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
      nls.localize('confirm_overwrite', String(localComponents.size), target.type),
      'Yes',
      'No'
    );
    return answer === 'Yes';
  });
