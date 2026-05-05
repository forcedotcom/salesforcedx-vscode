/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';

/** Runs trace flag cleanup every 5 minutes. Forks and runs until extension scope closes. */
export const traceFlagCleanupScheduler = Effect.fn('traceFlagCleanupScheduler')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const traceFlagService = yield* api.services.TraceFlagService;
  const cleanup = traceFlagService.cleanupExpired().pipe(
    Effect.tapError(e => Effect.logWarning(String(e))),
    Effect.catchAll(() => Effect.void)
  );
  yield* Effect.fork(Stream.fromSchedule(Schedule.fixed(Duration.minutes(5))).pipe(Stream.runForEach(() => cleanup)));
  yield* Effect.sleep(Duration.infinity);
});
