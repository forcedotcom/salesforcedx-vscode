/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
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
      const channelLayer = api.services.ChannelServiceLayer(
        context.extension.packageJSON.displayName ?? 'SOQL'
      );
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);
      return Layer.mergeAll(
        ExtensionProviderServiceLive,
        api.services.ConnectionService.Default,
        api.services.ExtensionContextServiceLayer(context),
        api.services.ProjectService.Default,
        api.services.TransmogrifierService.Default,
        api.services.SettingsService.Default,
        api.services.WorkspaceService.Default,
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
 * code-completion calls. SObject describe/list use the services extension's
 * shared singleton via MetadataDescribeApi (pre-satisfied, R = never).
 */
const createSoqlRuntime = () => ManagedRuntime.make(AllServicesLayer);
// eslint-disable-next-line functional/no-let
let _soqlRuntime: ReturnType<typeof createSoqlRuntime> | undefined;
export const getSoqlRuntime = () => {
  if (!_soqlRuntime) _soqlRuntime = createSoqlRuntime();
  return _soqlRuntime;
};
