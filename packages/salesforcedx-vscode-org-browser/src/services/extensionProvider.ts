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
import { FilePresenceServiceLive } from '../tree/filePresenceService';
import { OrgBrowserRetrieveServiceLive } from './orgBrowserMetadataRetrieveService';

export type ExtensionProviderService = {
  /** Get the SalesforceVSCodeServicesApi, activating if needed */
  readonly getServicesApi: Effect.Effect<SalesforceVSCodeServicesApi, Error, never>;
};

export const ExtensionProviderService = Context.GenericTag<ExtensionProviderService>('ExtensionProviderService');

const isSalesforceVSCodeServicesApi = (api: unknown): api is SalesforceVSCodeServicesApi =>
  api !== null && api !== undefined && typeof api === 'object' && 'services' in api;

/** Get the services API synchronously (extension must be active) */
const getServicesApiSync = (): SalesforceVSCodeServicesApi => {
  const ext = vscode.extensions.getExtension<SalesforceVSCodeServicesApi>(
    'salesforce.salesforcedx-vscode-services'
  );
  if (!ext) {
    throw new Error('Services extension not found');
  }
  if (!ext.isActive) {
    throw new Error('Services extension not active - ensure it is listed in extensionDependencies');
  }
  const api = ext.exports;
  if (!isSalesforceVSCodeServicesApi(api)) {
    throw new Error('Invalid Services API');
  }
  return api;
};

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

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi
  }))
);

// Import service types for the return type annotation
import type { OrgBrowserRetrieveService } from './orgBrowserMetadataRetrieveService';
import type { FilePresenceService } from '../tree/filePresenceService';

/** Create AllServicesLayer synchronously by manually constructing from individual service layers */
const createAllServicesLayer = (): Layer.Layer<
  ExtensionProviderService | OrgBrowserRetrieveService | FilePresenceService,
  never,
  never
> => {
  const api = getServicesApiSync();

  // Manually construct the layer from individual service Default layers
  const allServices = Layer.mergeAll(
    ExtensionProviderServiceLive,
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
    api.services.SourceTrackingService.Default,
    api.services.ChannelServiceLayer('Salesforce Org Browser'),
    OrgBrowserRetrieveServiceLive,
    FilePresenceServiceLive
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return allServices as any;
};

/** Layer that provides all services - created lazily on first access */
let _allServicesLayer: ReturnType<typeof createAllServicesLayer> | undefined;
export const getAllServicesLayer = (): ReturnType<typeof createAllServicesLayer> => {
  if (!_allServicesLayer) {
    _allServicesLayer = createAllServicesLayer();
  }
  return _allServicesLayer;
};

// For backward compatibility - create layer lazily
export const AllServicesLayer = Layer.unwrapEffect(
  Effect.sync(() => getAllServicesLayer())
);
