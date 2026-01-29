/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { AllServicesLayer } from '../services/extensionProvider';

class ResetRemoteTrackingError extends Data.TaggedError('ResetRemoteTrackingError')<{
  readonly cause: Error;
}> {}

const resetRemoteTrackingEffect = Effect.fn('resetRemoteTracking')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [channelService, sourceTrackingService] = yield* Effect.all(
    [api.services.ChannelService, api.services.SourceTrackingService],
    { concurrency: 'unbounded' }
  );

  const tracking = yield* sourceTrackingService.getSourceTrackingOrThrow();

  yield* channelService.appendToChannel('Resetting remote tracking...');

  const resetCount = yield* Effect.tryPromise({
    try: () => tracking.resetRemoteTracking(),
    catch: error =>
      new ResetRemoteTrackingError({
        cause: error instanceof Error ? error : new Error(String(error))
      })
  }).pipe(Effect.withSpan('resetRemoteTracking'));

  yield* channelService.appendToChannel(
    `Successfully reset remote tracking. ${resetCount} file${resetCount === 1 ? '' : 's'} updated.`
  );
});

/** Reset remote tracking so remote changes go to zero and only changes after this point are tracked */
export const resetRemoteTracking = async (): Promise<void> =>
  resetRemoteTrackingEffect().pipe(
    Effect.catchTag('ResetRemoteTrackingError', (error: ResetRemoteTrackingError) =>
      Effect.promise(() => vscode.window.showErrorMessage(error.cause.message)).pipe(Effect.as(undefined))
    ),
    Effect.catchAll(error =>
      Effect.promise(() => vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error))).pipe(
        Effect.as(undefined)
      )
    ),
    Effect.provide(AllServicesLayer),
    Effect.runPromise
  );
