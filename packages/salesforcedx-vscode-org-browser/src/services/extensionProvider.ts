/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type { ExtensionContext } from 'vscode';
import * as vscode from 'vscode';
import { EXTENSION_NAME } from '../constants';
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
      const extension = vscode.extensions.getExtension(`salesforce.${EXTENSION_NAME}`);
      const extensionVersion = extension?.packageJSON?.version ?? 'unknown';
      const o11yEndpoint = process.env.O11Y_ENDPOINT ?? extension?.packageJSON?.o11yUploadEndpoint;
      // ErrorHandlerService depends on ChannelService, provide the extension's channel
      const channelLayer = api.services.ChannelServiceLayer('Salesforce Org Browser');
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);
      // Merge all the service layers from the API
      return Layer.mergeAll(
        ExtensionProviderServiceLive,
        api.services.ConfigService.Default,
        api.services.ConnectionService.Default,
        api.services.ExtensionContextServiceLayer(context),
        api.services.FsService.Default,
        api.services.MetadataRetrieveService.Default,
        api.services.MetadataRegistryService.Default,
        api.services.MetadataDescribeService.Default,
        api.services.ProjectService.Default,
        api.services.SdkLayerFor({ extensionName: EXTENSION_NAME, extensionVersion, o11yEndpoint }),
        api.services.SettingsService.Default,
        api.services.WorkspaceService.Default,
        api.services.SourceTrackingService.Default,
        channelLayer,
        errorHandlerWithChannel,
        OrgBrowserRetrieveService.Default
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );

/**
 * Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Uses ExtensionContextService.Default (fails if getContext is called).
 * Use buildAllServicesLayer(context) to provide a working ExtensionContextService.
 */
// eslint-disable-next-line functional/no-let
export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};
