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
      const displayName = pjson.displayName ?? 'Salesforce Org Management';
      // ErrorHandlerService depends on ChannelService, provide the extension's channel
      const channelLayer = api.services.ChannelServiceLayer(displayName);
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);
      // Merge all the service layers from the API
      return Layer.mergeAll(
        ExtensionProviderServiceLive,
        api.services.ExtensionContextServiceLayer(context),
        api.services.ChannelServiceLayer(displayName),
        api.services.AliasService.Default,
        api.services.ConfigService.Default,
        api.services.ConnectionService.Default,
        api.services.ProjectService.Default,
        api.services.WorkspaceService.Default,
        api.services.SdkLayerFor(context),
        channelLayer,
        errorHandlerWithChannel
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );

/**
 * Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Uses ExtensionContextService.Default (fails if getContext is called).
 * Use buildAllServicesLayer(context) to provide a working ExtensionContextService.
 */

export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

/**
 * Single persistent runtime for org extension Effect executions.
 * Built once on first use to avoid rebuilding services across commands.
 */
const createOrgRuntime = () => ManagedRuntime.make(AllServicesLayer);

let _orgRuntime: ReturnType<typeof createOrgRuntime> | undefined;
export const getOrgRuntime = () => {
  _orgRuntime ??= createOrgRuntime();
  return _orgRuntime;
};

/** Reset cached runtime. Used by tests when AllServicesLayer changes between tests. */
export const resetOrgRuntimeForTesting = (): void => {
  _orgRuntime = undefined;
};
