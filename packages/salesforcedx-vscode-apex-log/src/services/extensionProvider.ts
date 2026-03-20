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
import { TraceFlagsContentProviderService } from '../traceFlags/traceFlagsContentProvider';
import {
  getOrCreateLogCollectorStateRef,
  getOrCreateTraceFlagRefreshSubscriptionRef,
  LogCollectorStateRef,
  CurrentTraceFlags
} from './apexLogState';

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({ getServicesApi }))
);

export const buildAllServicesLayer = (context: ExtensionContext) =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const traceFlagRefreshSubscriptionRef = yield* Effect.sync(getOrCreateTraceFlagRefreshSubscriptionRef);
      const logCollectorStateRef = yield* Effect.sync(getOrCreateLogCollectorStateRef);
      const extensionProvider = yield* ExtensionProviderService;
      const api = yield* extensionProvider.getServicesApi;
      const emptyPjson: ExtensionPackageJson = {};
      const pjson = yield* Schema.decodeUnknown(ExtensionPackageJsonSchema)(context.extension.packageJSON).pipe(
        Effect.catchAll(() => Effect.succeed(emptyPjson))
      );
      const extensionVersion = pjson.version ?? 'unknown';
      const o11yEndpoint = process.env.O11Y_ENDPOINT ?? pjson.o11yUploadEndpoint;
      const channelLayer = api.services.ChannelServiceLayer(pjson.displayName ?? 'Salesforce Apex Log');
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);
      return Layer.mergeAll(
        Layer.succeedContext(api.services.prebuiltServicesDependencies),
        ExtensionProviderServiceLive,
        TraceFlagsContentProviderService.Default,
        Layer.succeed(CurrentTraceFlags, traceFlagRefreshSubscriptionRef),
        Layer.succeed(LogCollectorStateRef, logCollectorStateRef),
        api.services.ExtensionContextServiceLayer(context),
        api.services.SdkLayerFor({
          extensionName: pjson.name ?? 'salesforcedx-vscode-apex-log',
          extensionVersion,
          o11yEndpoint
        }),
        channelLayer,
        errorHandlerWithChannel
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );

export { AllServicesLayer, setAllServicesLayer } from './allServicesLayerRef';
export { getRuntime } from './runtime';
