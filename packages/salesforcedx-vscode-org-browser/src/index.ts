/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { retrieveEffect } from './commands/retrieveMetadata';
import { EXTENSION_NAME, TREE_VIEW_ID } from './constants';
import { nls } from './messages';
import { AllServicesLayer, buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem } from './tree/orgBrowserNode';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const coreConfig = vscode.workspace.getConfiguration('salesforcedx-vscode-core');
  const useLegacyOrgBrowser = coreConfig.get<boolean>('useLegacyOrgBrowser', false);

  if (useLegacyOrgBrowser) {
    console.log('Salesforce Org Browser extension disabled via setting (legacy org browser enabled)');
    return;
  }

  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await Effect.runPromise(activateEffect(context).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(deactivateEffect().pipe(Effect.provide(AllServicesLayer)));

// export for testing
export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (_context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel('Salesforce Org Browser extension activating');

  const treeProvider = new MetadataTypeTreeProvider();
  // Register the tree provider
  vscode.window.registerTreeDataProvider(TREE_VIEW_ID, treeProvider);

  // Create registerCommand pre-loaded with AllServicesLayer for proper tracing
  const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);

  // Register commands
  yield* registerCommand(`${TREE_VIEW_ID}.refreshType`, (node: OrgBrowserTreeItem) =>
    Effect.promise(() => treeProvider.refreshType(node))
  );
  yield* registerCommand(`${TREE_VIEW_ID}.collapseAll`, () =>
    Effect.promise(() => vscode.commands.executeCommand(`workbench.actions.treeView.${TREE_VIEW_ID}.collapseAll`))
  );
  yield* registerCommand(`${TREE_VIEW_ID}.retrieveMetadata`, (node: OrgBrowserTreeItem) =>
    retrieveEffect(node, treeProvider).pipe(
      Effect.tap(result =>
        typeof result === 'string'
          ? Effect.sync(() => {
              void vscode.window.showInformationMessage(nls.localize('retrieve_canceled'));
            })
          : Effect.void
      )
    )
  );
  const targetOrgRef = yield* api.services.TargetOrgRef();
  yield* Effect.forkDaemon(
    Stream.merge(
      // get the initial state
      Stream.fromEffect(SubscriptionRef.get(targetOrgRef)),
      // get the ongoing changes
      targetOrgRef.changes
    ).pipe(
      Stream.filter(isNotUndefined),
      Stream.map(org => org.orgId),
      Stream.changes,
      Stream.tap(orgId => svc.appendToChannel(`Target org changed to ${orgId ?? '<NOT SET>'}`)),
      Stream.tap(() => svc.appendToChannel('Org changed, will try to update OrgBrowser')),
      Stream.runForEach(() => Effect.promise(() => treeProvider.refreshType()))
    )
  );

  // Append completion message
  yield* svc.appendToChannel('Salesforce Org Browser activation complete.');
});

export const deactivateEffect = Effect.fn(`deactivation:${EXTENSION_NAME}`)(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel('Salesforce Org Browser extension is now deactivated!');
});
