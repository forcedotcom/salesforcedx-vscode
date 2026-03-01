/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ExtensionPackageJsonSchema,
  ExtensionProviderService,
  type ExtensionPackageJson,
  getServicesApi
} from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import type { ExtensionContext } from 'vscode';
import { EXTENSION_NAME } from '../constants';
import { nls } from '../messages';

const CHANNEL_NAME = nls.localize('channel_name');

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi
  }))
);

export const buildAllServicesLayer = (context: ExtensionContext) =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const extensionProvider = yield* ExtensionProviderService;
      const api = yield* extensionProvider.getServicesApi;
      const emptyPjson: ExtensionPackageJson = {};
      const pjson = yield* Schema.decodeUnknown(ExtensionPackageJsonSchema)(context.extension.packageJSON).pipe(
        Effect.catchAll(() => Effect.succeed(emptyPjson))
      );
      return Layer.mergeAll(
        ExtensionProviderServiceLive,
        api.services.ConnectionService.Default,
        api.services.ExtensionContextServiceLayer(context),
        api.services.FileWatcherService.Default,
        api.services.FsService.Default,
        api.services.MetadataRetrieveService.Default,
        api.services.ProjectService.Default,
        api.services.SdkLayerFor({
          extensionName: pjson.name ?? EXTENSION_NAME,
          extensionVersion: pjson.version ?? 'unknown',
          o11yEndpoint: process.env.O11Y_ENDPOINT ?? pjson.o11yUploadEndpoint,
          productFeatureId: pjson.productFeatureId
        }),
        api.services.ChannelServiceLayer(pjson.displayName ?? CHANNEL_NAME)
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );

export { AllServicesLayer, setAllServicesLayer } from './allServicesLayerRef';
