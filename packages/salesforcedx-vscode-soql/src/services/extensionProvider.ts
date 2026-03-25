/*
 * Copyright (c) 2025, salesforce.com, inc.
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
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import type { ExtensionContext } from 'vscode';

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi
  }))
);

/**
 * Factory for a Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Pass the ExtensionContext to include a working ExtensionContextServiceLayer.
 */
export const buildAllServicesLayer = (context: ExtensionContext) =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const extensionProvider = yield* ExtensionProviderService;
      const api = yield* extensionProvider.getServicesApi;
      const emptyPjson: ExtensionPackageJson = {};
      const pjson = yield* Schema.decodeUnknown(ExtensionPackageJsonSchema)(context.extension.packageJSON).pipe(
        Effect.catchAll(() => Effect.succeed(emptyPjson))
      );
      const displayName = pjson.displayName ?? 'SOQL';
      const channelLayer = api.services.ChannelServiceLayer(displayName);
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);
      return Layer.mergeAll(
        Layer.succeedContext(api.services.prebuiltServicesDependencies),
        ExtensionProviderServiceLive,
        api.services.ExtensionContextServiceLayer(context),
        api.services.SdkLayerFor(context),
        channelLayer,
        errorHandlerWithChannel
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );

export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

/**
 * Single persistent runtime for all SOQL extension Effect executions.
 * Built once on first use to avoid rebuilding TransmogrifierService and other
 * stateful services across sobject_metadata_request, sobjects_request, and
 * code-completion calls
 */
const createSoqlRuntime = () => ManagedRuntime.make(AllServicesLayer);

let _soqlRuntime: ReturnType<typeof createSoqlRuntime> | undefined;
export const getSoqlRuntime = () => {
  if (!_soqlRuntime) _soqlRuntime = createSoqlRuntime();
  return _soqlRuntime;
};
