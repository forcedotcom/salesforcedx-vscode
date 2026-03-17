/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { SourceTracking } from '@salesforce/source-tracking';
import * as Effect from 'effect/Effect';
import { detectConflicts, handleConflictWithRetry } from '../../conflict/conflictFlow';
import { nls } from '../../messages';
import { retrieveComponentSet } from '../../shared/retrieve/retrieveComponentSet';
import { SourceTrackingFailedError } from './retrieveErrors';

const applyDeletesAndRetrieve = Effect.fn('projectRetrieve.applyDeletesAndRetrieve')(function* (
  tracking: SourceTracking
) {
  const { componentSetFromNonDeletes: componentSetToRetrieve } = yield* Effect.tryPromise({
    try: () => tracking.maybeApplyRemoteDeletesToLocal(true),
    catch: e =>
      new SourceTrackingFailedError({
        message: nls.localize('error_source_tracking_components_failed', e instanceof Error ? e.message : String(e)),
        cause: e
      })
  }).pipe(Effect.withSpan('maybeApplyRemoteDeletesToLocal'));

  yield* retrieveComponentSet({ componentSet: componentSetToRetrieve, ignoreConflicts: true });
});

const retrieveEffect = Effect.fn('retrieveEffect')(function* (ignoreConflicts: boolean) {
  yield* Effect.annotateCurrentSpan({ ignoreConflicts });

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [sourceTrackingService, channelService] = yield* Effect.all(
    [api.services.SourceTrackingService, api.services.ChannelService],
    { concurrency: 'unbounded' }
  );

  const tracking = yield* sourceTrackingService.getSourceTrackingOrThrow({ ignoreConflicts });
  yield* Effect.all(
    [Effect.promise(() => tracking.reReadLocalTrackingCache()), Effect.promise(() => tracking.reReadRemoteTracking())],
    { concurrency: 'unbounded' }
  );

  const componentSet = yield* Effect.tryPromise({
    try: () => tracking.remoteNonDeletesAsComponentSet({ applyIgnore: true }),
    catch: e =>
      new SourceTrackingFailedError({
        message: nls.localize('error_source_tracking_components_failed', e instanceof Error ? e.message : String(e)),
        cause: e
      })
  }).pipe(Effect.withSpan('remoteNonDeletesAsComponentSet'));

  yield* channelService.appendToChannel(
    `Found ${componentSet.size} remote change${componentSet.size === 1 ? '' : 's'} to retrieve`
  );

  if (componentSet.size === 0) {
    yield* channelService.appendToChannel('No remote changes to retrieve');
    return;
  }

  if (!ignoreConflicts) {
    const pairs = yield* detectConflicts(componentSet, 'retrieve');
    if (pairs.length > 0) {
      return yield* handleConflictWithRetry({
        retryOperation: Effect.gen(function* () {
          const t = yield* sourceTrackingService.getSourceTrackingOrThrow({ ignoreConflicts: true });
          yield* Effect.all(
            [
              Effect.promise(() => t.reReadLocalTrackingCache()),
              Effect.promise(() => t.reReadRemoteTracking())
            ],
            { concurrency: 'unbounded' }
          );
          yield* applyDeletesAndRetrieve(t);
        }),
        operationType: 'retrieve',
        componentSet
      });
    }
  }

  yield* applyDeletesAndRetrieve(tracking);
});

/** Retrieve remote changes from the default org */
export const projectRetrieveStartCommand = (ignoreConflicts: boolean) => retrieveEffect(ignoreConflicts);
