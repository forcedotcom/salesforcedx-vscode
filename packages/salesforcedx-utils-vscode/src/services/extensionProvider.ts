/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

const CHANNEL_NAME = 'Salesforce Extensions';

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi
  }))
);

/**
 * Effect that resolves a file path to a URI using FsService from the extension API.
 * Gets the API, provides FsService (and its ChannelService dependency), then calls fsService.toUri.
 */
export const toUriEffect = (filePath: string) =>
  Effect.gen(function* () {
    const extensionProvider = yield* ExtensionProviderService;
    const api = yield* extensionProvider.getServicesApi;
    const fsService = yield* api.services.FsService;
    return yield* fsService.toUri(filePath);
  }).pipe(
    Effect.provide(ExtensionProviderServiceLive),
    Effect.provide(
      Layer.unwrapEffect(
        Effect.gen(function* () {
          const extensionProvider = yield* ExtensionProviderService;
          const api = yield* extensionProvider.getServicesApi;
          return Layer.mergeAll(api.services.ChannelServiceLayer(CHANNEL_NAME), api.services.FsService.Default);
        }).pipe(Effect.provide(ExtensionProviderServiceLive))
      )
    )
  );
