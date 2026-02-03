/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { EXTENSION_NAME, OUTPUT_CHANNEL_NAME } from '../constants';

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
      api.services.ComponentSetService.Default,
      api.services.ConfigService.Default,
      api.services.ConnectionService.Default,
      api.services.FsService.Default,
      api.services.EditorService.Default,
      api.services.MetadataDeployService.Default,
      api.services.MetadataDeleteService.Default,
      api.services.MetadataRetrieveService.Default,
      api.services.MetadataRegistryService.Default,
      api.services.MetadataDescribeService.Default,
      api.services.ProjectService.Default,
      api.services.SdkLayerFor({ extensionName: EXTENSION_NAME, extensionVersion, o11yEndpoint }),
      api.services.SettingsService.Default,
      api.services.WorkspaceService.Default,
      api.services.SourceTrackingService.Default,
      api.services.ChannelServiceLayer(OUTPUT_CHANNEL_NAME),
      api.services.FileWatcherService.Default
    );
  }).pipe(Effect.provide(ExtensionProviderServiceLive))
);
