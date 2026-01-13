/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { EXTENSION_NAME } from '../constants';
import { OrgBrowserRetrieveService } from './orgBrowserMetadataRetrieveService';

export class ServicesExtensionNotFoundError extends Data.TaggedError('ServicesExtensionNotFoundError') {}
export class InvalidServicesApiError extends Data.TaggedError('InvalidServicesApiError')<{ cause?: Error }> {}

export type ExtensionProviderService = {
  /** Get the SalesforceVSCodeServicesApi, activating if needed */
  readonly getServicesApi: Effect.Effect<
    SalesforceVSCodeServicesApi,
    ServicesExtensionNotFoundError | InvalidServicesApiError,
    never
  >;
};

export const ExtensionProviderService = Context.GenericTag<ExtensionProviderService>('ExtensionProviderService');

/** connect to the Salesforce Services extension and get all of its API services */
const getServicesApi = Effect.sync(() =>
  vscode.extensions.getExtension<SalesforceVSCodeServicesApi>('salesforce.salesforcedx-vscode-services')
).pipe(
  Effect.flatMap(ext => (ext ? Effect.succeed(ext) : Effect.fail(new ServicesExtensionNotFoundError()))),
  Effect.flatMap(ext =>
    ext.isActive
      ? Effect.sync(() => ext.exports)
      : Effect.tryPromise({
          try: () => ext.activate(),
          catch: e => new InvalidServicesApiError(e instanceof Error ? { cause: e } : { cause: new Error(String(e)) })
        })
  )
);

const ExtensionProviderServiceLive = Layer.effect(
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
    const extension = vscode.extensions.getExtension(`salesforce.${EXTENSION_NAME}`);
    const extensionVersion = extension?.packageJSON?.version ?? 'unknown';
    const o11yEndpoint = process.env.O11Y_ENDPOINT ?? extension?.packageJSON?.o11yUploadEndpoint;
    // Merge all the service layers from the API
    return Layer.mergeAll(
      ExtensionProviderServiceLive,
      api.services.ConfigService.Default,
      api.services.ConnectionService.Default,
      api.services.FsService.Default,
      api.services.MetadataRetrieveService.Default,
      api.services.MetadataRegistryService.Default,
      api.services.MetadataDescribeService.Default,
      api.services.ProjectService.Default,
      api.services.SdkLayerFor({ extensionName: EXTENSION_NAME, extensionVersion, o11yEndpoint }),
      api.services.SettingsService.Default,
      api.services.WorkspaceService.Default,
      api.services.SourceTrackingService.Default,
      api.services.ChannelServiceLayer('Salesforce Org Browser'),
      OrgBrowserRetrieveService.Default
    );
  }).pipe(Effect.provide(ExtensionProviderServiceLive))
);
