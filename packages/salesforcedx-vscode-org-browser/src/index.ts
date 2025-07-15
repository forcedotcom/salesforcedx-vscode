/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Effect } from 'effect';
import * as vscode from 'vscode';
import { ExtensionProviderService, ExtensionProviderServiceLive } from './services/extensionProvider';
import { MetadataDescribeService, MetadataDescribeServiceLive } from './services/metadataDescribeService';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';
import { OrgBrowserNode } from './tree/orgBrowserNode';

export const activateEffect = Effect.gen(function* () {
  const svcProvider = yield* ExtensionProviderService;
  const api = yield* svcProvider.getServicesApi;
  const ChannelServiceLayer = api.services.ChannelServiceLayer;
  const ChannelService = api.services.ChannelService;
  yield* Effect.provide(
    Effect.gen(function* () {
      const svc = yield* ChannelService;
      yield* svc.appendToChannel('Salesforce Org Browser extension is now active!');

      // Register the tree provider
      const describeService = yield* Effect.provide(MetadataDescribeService, MetadataDescribeServiceLive);
      const treeProvider = new MetadataTypeTreeProvider(describeService);
      vscode.window.registerTreeDataProvider('sfdxOrgBrowser', treeProvider);
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
  let treeProvider: MetadataTypeTreeProvider | undefined;
  await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const svcProvider = yield* ExtensionProviderService;
        const api = yield* svcProvider.getServicesApi;
        const ChannelServiceLayer = api.services.ChannelServiceLayer;
        const ChannelService = api.services.ChannelService;
        yield* Effect.provide(
          Effect.gen(function* () {
            const svc = yield* ChannelService;
            yield* svc.appendToChannel('Salesforce Org Browser extension is now active!');

            // Register the tree provider
            const describeService = yield* Effect.provide(MetadataDescribeService, MetadataDescribeServiceLive);
            treeProvider = new MetadataTypeTreeProvider(describeService);
            vscode.window.registerTreeDataProvider('sfdxOrgBrowser', treeProvider);
            // Append completion message
            yield* svc.appendToChannel('Salesforce Org Browser activation complete.');
          }),
          ChannelServiceLayer('Salesforce Org Browser')
        );
      }),
      ExtensionProviderServiceLive
    )
  );

  // Register the refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('sfdxOrgBrowser.refresh', () => {
      treeProvider?.refresh();
    })
  );

  // Register the refreshType command for type nodes
  context.subscriptions.push(
    vscode.commands.registerCommand('sfdxOrgBrowser.refreshType', (node: OrgBrowserNode) => {
      // Defensive: only allow type nodes
      if (treeProvider && node && node.kind === 'type' && typeof node.xmlName === 'string') {
        void Effect.runPromise(treeProvider.refreshType(node.xmlName));
      }
    })
  );
};

export const deactivate = (): void => {
  void Effect.runPromise(Effect.provide(deactivateEffect, ExtensionProviderServiceLive));
};
