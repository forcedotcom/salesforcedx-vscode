/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';

export type ExtensionProviderService = {
  /** Get the SalesforceVSCodeServicesApi, activating if needed */
  readonly getServicesApi: Effect.Effect<SalesforceVSCodeServicesApi, Error, never>;
};

export const ExtensionProviderService = Context.GenericTag<ExtensionProviderService>('ExtensionProviderService');

const isSalesforceVSCodeServicesApi = (api: unknown): api is SalesforceVSCodeServicesApi =>
  api !== null && api !== undefined && typeof api === 'object' && 'services' in api;

/** connect to the Salesforce Services extension and get all of its API services */
const getServicesApi = Effect.sync(() =>
  vscode.extensions.getExtension<SalesforceVSCodeServicesApi>('salesforce.salesforcedx-vscode-services')
).pipe(
  Effect.flatMap(ext => (ext ? Effect.succeed(ext) : Effect.fail(new Error('Services extension not found')))),
  Effect.flatMap(ext => (ext.isActive ? Effect.sync(() => ext.exports) : Effect.tryPromise(() => ext.activate()))),
  Effect.flatMap(api =>
    isSalesforceVSCodeServicesApi(api) ? Effect.succeed(api) : Effect.fail(new Error('Invalid Services API'))
  )
);

export const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi
  }))
);

/** Layer that provides all services from the SalesforceVSCodeServicesApi */
export const AllServicesLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const extensionProvider = yield* ExtensionProviderService;
    const api = yield* extensionProvider.getServicesApi;
    // Merge all the service layers from the API
    return Layer.mergeAll(
      api.services.ConfigService.Default,
      api.services.ConnectionService.Default,
      api.services.FsService.Default,
      api.services.MetadataRetrieveService.Default,
      api.services.MetadataRegistryService.Default,
      api.services.MetadataDescribeService.Default,
      api.services.ProjectService.Default,
      api.services.SdkLayer,
      api.services.SettingsService.Default,
      api.services.WorkspaceService.Default,
      api.services.ChannelServiceLayer('Salesforce Org Browser')
    );
  }).pipe(Effect.provide(ExtensionProviderServiceLive))
);
