/*
 * Copyright (c) 2024, salesforce.com, inc.
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
import { OrgBrowserRetrieveService } from './orgBrowserMetadataRetrieveService';

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi
  }))
);

/**
 * Factory for a Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Pass the ExtensionContext to include a working ExtensionContextServiceLayer.
 * When context is not provided, ExtensionContextService.Default is used (fails if getContext is called).
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
      const displayName = pjson.displayName ?? 'Salesforce Org Browser';
      // ErrorHandlerService depends on ChannelService, provide the extension's channel
      const channelLayer = api.services.ChannelServiceLayer(displayName);
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);
      // Merge all the service layers from the API
      return Layer.mergeAll(
        Layer.succeedContext(api.services.prebuiltServicesDependencies),
        ExtensionProviderServiceLive,
        api.services.ExtensionContextServiceLayer(context),
        api.services.SdkLayerFor(context),
        channelLayer,
        errorHandlerWithChannel,
        OrgBrowserRetrieveService.Default
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );

// eslint-disable-next-line functional/no-let
export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

/**
 * Single persistent runtime for org-browser Effect executions.
 * Built once on first use to avoid rebuilding ComponentSetService and other
 * stateful services on each tree-node expansion
 */
const createOrgBrowserRuntime = () => ManagedRuntime.make(AllServicesLayer);
// eslint-disable-next-line functional/no-let
let _orgBrowserRuntime: ReturnType<typeof createOrgBrowserRuntime> | undefined;
export const getOrgBrowserRuntime = () => {
  _orgBrowserRuntime ??= createOrgBrowserRuntime();
  return _orgBrowserRuntime;
};
