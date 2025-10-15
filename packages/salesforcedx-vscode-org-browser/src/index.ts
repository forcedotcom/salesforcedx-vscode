/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { retrieveOrgBrowserTreeItemCommand } from './commands/retrieveMetadata';
import { EXTENSION_NAME, TREE_VIEW_ID } from './constants';
import { AllServicesLayer, ExtensionProviderService } from './services/extensionProvider';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem } from './tree/orgBrowserNode';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const coreConfig = vscode.workspace.getConfiguration('salesforcedx-vscode-core');
  const useNewOrgBrowser = coreConfig.get<boolean>('useNewOrgBrowser', true);

  if (!useNewOrgBrowser) {
    console.log('Salesforce Org Browser extension disabled via setting');
    return;
  }

  return Effect.runPromise(Effect.provide(activateEffect(context), AllServicesLayer));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(Effect.provide(deactivateEffect, AllServicesLayer));

// export for testing
export const activateEffect = (
  context: vscode.ExtensionContext
): Effect.Effect<void, Error, ExtensionProviderService> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const svc = yield* api.services.ChannelService;
    yield* svc.appendToChannel('Salesforce Org Browser extension activating');

    const treeProvider = new MetadataTypeTreeProvider();
    // Register the tree provider
    vscode.window.registerTreeDataProvider(TREE_VIEW_ID, treeProvider);

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.refreshType`, async (node: OrgBrowserTreeItem) => {
        await treeProvider.refreshType(node);
      }),
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.collapseAll`, () => {
        vscode.commands.executeCommand(`workbench.actions.treeView.${TREE_VIEW_ID}.collapseAll`);
      }),
      vscode.commands.registerCommand(`${TREE_VIEW_ID}.retrieveMetadata`, async (node: OrgBrowserTreeItem) => {
        await retrieveOrgBrowserTreeItemCommand(node, treeProvider);
      })
    );

    yield* Effect.forkDaemon(
      api.services.TargetOrgRef.changes.pipe(
        Stream.runForEach(org =>
          Effect.all([
            svc.appendToChannel(`Target org changed to ${JSON.stringify(org)}`),
            // if the org is blanked, we'll refresh the tree to get it set again from a fresh config/connection
            org.orgId ? Effect.void : Effect.promise(() => treeProvider.refreshType())
          ])
        )
      )
    );

    // Append completion message
    yield* svc.appendToChannel('Salesforce Org Browser activation complete.');
  }).pipe(Effect.withSpan(`activation:${EXTENSION_NAME}`), Effect.provide(AllServicesLayer));

export const deactivateEffect = ExtensionProviderService.pipe(
  Effect.flatMap(svcProvider => svcProvider.getServicesApi),
  Effect.flatMap(api => api.services.ChannelService),
  Effect.flatMap(svc => svc.appendToChannel('Salesforce Org Browser extension is now deactivated!')),
  Effect.withSpan(`deactivation:${EXTENSION_NAME}`),
  Effect.provide(AllServicesLayer)
);
