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
import * as Schema from 'effect/Schema';
import type { ExtensionContext } from 'vscode';

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({ getServicesApi }))
);

export const buildAllServicesLayer = (context: ExtensionContext) =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const extensionProvider = yield* ExtensionProviderService;
      const api = yield* extensionProvider.getServicesApi;
      const emptyPjson: ExtensionPackageJson = {};
      const pjson = yield* Schema.decodeUnknown(ExtensionPackageJsonSchema)(context.extension.packageJSON).pipe(
        Effect.catchAll(() => Effect.succeed(emptyPjson))
      );
      const extensionVersion = pjson.version ?? 'unknown';
      const o11yEndpoint = process.env.O11Y_ENDPOINT ?? pjson.o11yUploadEndpoint;
      const channelLayer = api.services.ChannelServiceLayer(pjson.displayName ?? 'Apex Replay Debugger');
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);
      return Layer.mergeAll(
        ExtensionProviderServiceLive,
        api.services.ConnectionService.Default,
        api.services.ApexLogService.Default,
        api.services.ExecuteAnonymousService.Default,
        api.services.ExtensionContextServiceLayer(context),
        api.services.ProjectService.Default,
        api.services.SdkLayerFor({
          extensionName: pjson.name ?? 'salesforcedx-vscode-apex-replay-debugger',
          extensionVersion,
          o11yEndpoint
        }),
        api.services.TraceFlagService.Default,
        api.services.WorkspaceService.Default,
        channelLayer,
        errorHandlerWithChannel
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );

export { AllServicesLayer, setAllServicesLayer } from './allServicesLayerRef';
