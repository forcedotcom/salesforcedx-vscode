/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import type { ExtensionContext } from 'vscode';
import { ExtensionPackageJsonSchema, type ExtensionPackageJson } from './extensionPackageJson';
import { ExtensionProviderService, getServicesApi } from './extensionProvider';

type Services = SalesforceVSCodeServicesApi['services'];
type AllServicesLayer = Layer.Layer<
  | Layer.Layer.Success<Services['prebuiltServicesLayer']>
  | Layer.Layer.Success<ReturnType<Services['ExtensionContextServiceLayer']>>
  | Layer.Layer.Success<ReturnType<Services['SdkLayerFor']>>
  | Layer.Layer.Success<ReturnType<Services['ChannelServiceLayer']>>
  | Layer.Layer.Success<Services['ErrorHandlerService']['Default']>
  | ExtensionProviderService,
  Effect.Effect.Error<typeof getServicesApi>
>;

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({ getServicesApi }))
);

/**
 * Factory for a Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Pass the ExtensionContext to include a working ExtensionContextServiceLayer.
 *
 * @param context the calling extension's ExtensionContext
 * @param fallbackDisplayName channel name to use if the extension's package.json has no `displayName`
 */
export const buildAllServicesLayer = (context: ExtensionContext, fallbackDisplayName: string): AllServicesLayer =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const extensionProvider = yield* ExtensionProviderService;
      const api = yield* extensionProvider.getServicesApi;
      const emptyPjson: ExtensionPackageJson = {};
      const pjson = yield* Schema.decodeUnknown(ExtensionPackageJsonSchema)(context.extension.packageJSON).pipe(
        Effect.catchAll(() => Effect.succeed(emptyPjson))
      );
      const channelLayer = api.services.ChannelServiceLayer(pjson.displayName ?? fallbackDisplayName);
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);
      return Layer.mergeAll(
        api.services.prebuiltServicesLayer,
        ExtensionProviderServiceLive,
        api.services.ExtensionContextServiceLayer(context),
        api.services.SdkLayerFor(context),
        channelLayer,
        errorHandlerWithChannel
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );
