/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Effect } from 'effect';
import * as vscode from 'vscode';
import { registerRetrieveMetadataCommand } from './commands/retrieveMetadata';
import { ExtensionProviderService, ExtensionProviderServiceLive } from './services/extensionProvider';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';
import { OrgBrowserNode } from './tree/orgBrowserNode';

export const activateEffect = (
  context: vscode.ExtensionContext
): Effect.Effect<void, Error, ExtensionProviderService> =>
  Effect.gen(function* () {
    const svcProvider = yield* ExtensionProviderService;
    const api = yield* svcProvider.getServicesApi;
    const ChannelServiceLayer = api.services.ChannelServiceLayer;
    const ChannelService = api.services.ChannelService;
    yield* Effect.provide(
      Effect.gen(function* () {
        const svc = yield* ChannelService;
        yield* svc.appendToChannel('Salesforce Org Browser extension is now active! 4:12');

        // Register the tree provider
        const treeProvider = new MetadataTypeTreeProvider();
        vscode.window.registerTreeDataProvider('sfdxOrgBrowser', treeProvider);

        // Register commands
        context.subscriptions.push(
          vscode.commands.registerCommand('sfdxOrgBrowser.refresh', () => {
            treeProvider.refresh();
          }),
          vscode.commands.registerCommand('sfdxOrgBrowser.refreshType', (node: OrgBrowserNode) => {
            if (node?.xmlName) {
              treeProvider.refreshType(node.xmlName);
            } else {
              treeProvider.refresh();
            }
          })
        );
        registerRetrieveMetadataCommand(context);

        // Append completion message
        yield* svc.appendToChannel('Salesforce Org Browser activation complete.');
      }),
      ChannelServiceLayer('Salesforce Org Browser')
    );

    // do various activation things here
  });

export const deactivateEffect = Effect.gen(function* () {
  const svcProvider = yield* ExtensionProviderService;
  const api = yield* svcProvider.getServicesApi;
  const ChannelServiceLayer = api.services.ChannelServiceLayer;
  const ChannelService = api.services.ChannelService;
  yield* Effect.provide(
    Effect.gen(function* () {
      const svc = yield* ChannelService;
      yield* svc.appendToChannel('Salesforce Org Browser extension is now deactivated!');
    }),
    ChannelServiceLayer('Salesforce Org Browser')
  );
});

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  await Effect.runPromise(Effect.provide(activateEffect(context), ExtensionProviderServiceLive));
};

export const deactivate = (): void => {
  void Effect.runPromise(Effect.provide(deactivateEffect, ExtensionProviderServiceLive));
};
