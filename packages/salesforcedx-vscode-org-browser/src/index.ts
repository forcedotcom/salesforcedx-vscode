/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Effect } from 'effect';
import * as vscode from 'vscode';
import { ExtensionProviderService, ExtensionProviderServiceLive } from './services/extensionProvider';

export const activateEffect = Effect.gen(function* () {
  const svcProvider = yield* ExtensionProviderService;
  const api = yield* svcProvider.getServicesApi;
  const ChannelServiceLayer = api.services.ChannelServiceLayer;
  const ChannelService = api.services.ChannelService;
  yield* Effect.provide(
    Effect.gen(function* () {
      const svc = yield* ChannelService;
      yield* svc.appendToChannel('Salesforce Org Browser extension is now active!');
    }),
    ChannelServiceLayer('Salesforce Org Browser')
  );
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

export const activate = async (_context: vscode.ExtensionContext): Promise<void> => {
  await Effect.runPromise(Effect.provide(activateEffect, ExtensionProviderServiceLive));
};

export const deactivate = (): void => {
  void Effect.runPromise(Effect.provide(deactivateEffect, ExtensionProviderServiceLive));
};
