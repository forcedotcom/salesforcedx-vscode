/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SalesforceVSCodeServicesApiV2 } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import type { ExtensionContext } from 'vscode';
import { ExtensionPackageJsonSchema, type ExtensionPackageJson } from './extensionPackageJson';
import { ExtensionProviderService, getServicesApi } from './extensionProvider';

type Services = SalesforceVSCodeServicesApiV2['v2']['services'];
type AllServicesLayer = Layer.Layer<
  | Layer.Success<Services['prebuiltServicesLayer']>
  | Layer.Success<ReturnType<Services['ExtensionContextServiceLayer']>>
  | Layer.Success<ReturnType<Services['SdkLayerFor']>>
  | Layer.Success<ReturnType<Services['ChannelServiceLayer']>>
  | Layer.Success<Services['ErrorHandlerServiceLayer']>
  | ExtensionProviderService,
  Effect.Error<typeof getServicesApi>
>;

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({ getServicesApi }))
);

/**
 * Factory for a Layer that provides all services from the SalesforceVSCodeServicesApiV2.
 * Pass the ExtensionContext to include a working ExtensionContextServiceLayer.
 *
 * @param context the calling extension's ExtensionContext
 * @param fallbackDisplayName channel name to use if the extension's package.json has no `displayName`
 */
export const buildAllServicesLayer = (context: ExtensionContext, fallbackDisplayName: string): AllServicesLayer =>
  Layer.unwrap(
    Effect.gen(function* () {
      const extensionProvider = yield* ExtensionProviderService;
      const api = yield* extensionProvider.getServicesApi;
      const emptyPjson: ExtensionPackageJson = {};
      const pjson = yield* Schema.decodeUnknownEffect(ExtensionPackageJsonSchema)(context.extension.packageJSON).pipe(
        Effect.catch(() => Effect.succeed(emptyPjson))
      );
      const services = api.v2.services;
      const channelLayer = services.ChannelServiceLayer(pjson.displayName ?? fallbackDisplayName);
      const errorHandlerWithChannel = Layer.provide(services.ErrorHandlerServiceLayer, channelLayer);
      const sharedServicesAndSdk = services
        .SdkLayerFor(context)
        .pipe(Layer.provideMerge(services.prebuiltServicesLayer));
      return Layer.mergeAll(
        sharedServicesAndSdk,
        ExtensionProviderServiceLive,
        services.ExtensionContextServiceLayer(context),
        channelLayer,
        errorHandlerWithChannel
      );
    })
  ).pipe(Layer.provide(ExtensionProviderServiceLive));
