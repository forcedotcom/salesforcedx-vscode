/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { retrieveOrgBrowserTreeItemCommand } from './commands/retrieveMetadata';
import { EXTENSION_NAME, TREE_VIEW_ID } from './constants';
import { AllServicesLayer, ExtensionProviderService } from './services/extensionProvider';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem } from './tree/orgBrowserNode';

// the vscode APIs delegate quickly to Effects
export const activate = async (context: vscode.ExtensionContext): Promise<void> =>
  Effect.runPromise(Effect.provide(activateEffect(context), AllServicesLayer));

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(Effect.provide(deactivateEffect, AllServicesLayer));

// export for testing
export const activateEffect = (
  context: vscode.ExtensionContext
): Effect.Effect<void, Error, ExtensionProviderService> =>
  Effect.gen(function* () {
    const svc = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services.ChannelService;
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

    // Append completion message
    yield* svc.appendToChannel('Salesforce Org Browser activation complete.');
  }).pipe(Effect.withSpan(`activation:${EXTENSION_NAME}`), Effect.provide(AllServicesLayer));

export const deactivateEffect = ExtensionProviderService.pipe(
  Effect.flatMap(svcProvider => svcProvider.getServicesApi),
  Effect.flatMap(api => api.services.ChannelService),
  Effect.flatMap(svc => svc.appendToChannel('Salesforce Org Browser extension is now deactivated!')),
  Effect.provide(AllServicesLayer)
);
