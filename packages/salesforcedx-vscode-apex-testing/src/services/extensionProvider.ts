/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../messages';

const CHANNEL_NAME = nls.localize('channel_name');

export type ExtensionProviderService = {
  /** Get the SalesforceVSCodeServicesApi, activating if needed */
  readonly getServicesApi: Effect.Effect<SalesforceVSCodeServicesApi, Error, never>;
};

export const ExtensionProviderService = Context.GenericTag<ExtensionProviderService>('ExtensionProviderService');

const isSalesforceVSCodeServicesApi = (api: unknown): api is SalesforceVSCodeServicesApi =>
  api !== null && api !== undefined && typeof api === 'object' && 'services' in api;

/** Connect to the Salesforce Services extension and get all of its API services */
const getServicesApiEffect = Effect.sync(() =>
  vscode.extensions.getExtension<SalesforceVSCodeServicesApi>('salesforce.salesforcedx-vscode-services')
).pipe(
  Effect.flatMap(ext => (ext ? Effect.succeed(ext) : Effect.fail(new Error('Services extension not found')))),
  Effect.flatMap(ext => (ext.isActive ? Effect.sync(() => ext.exports) : Effect.tryPromise(() => ext.activate()))),
  Effect.flatMap(api =>
    isSalesforceVSCodeServicesApi(api) ? Effect.succeed(api) : Effect.fail(new Error('Invalid Services API'))
  )
);

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi: getServicesApiEffect
  }))
);

/** Layer that provides all services from the SalesforceVSCodeServicesApi */
export const AllServicesLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const extensionProvider = yield* ExtensionProviderService;
    const api = yield* extensionProvider.getServicesApi;
    // Merge all the service layers from the API
    return Layer.mergeAll(
      ExtensionProviderServiceLive,
      api.services.ConfigService.Default,
      api.services.ConnectionService.Default,
      api.services.FsService.Default,
      api.services.MetadataRegistryService.Default,
      api.services.MetadataRetrieveService.Default,
      api.services.ProjectService.Default,
      api.services.SettingsService.Default,
      api.services.WorkspaceService.Default,
      api.services.SdkLayer,
      api.services.ChannelServiceLayer(CHANNEL_NAME)
    );
  }).pipe(Effect.provide(ExtensionProviderServiceLive))
);
