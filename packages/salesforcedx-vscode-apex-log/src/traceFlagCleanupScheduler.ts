/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';

const DEFAULT_POLL_INTERVAL_MINUTES = 5;
const MIN_POLL_INTERVAL_MINUTES = 1;
const MAX_POLL_INTERVAL_MINUTES = 60;

/** Read `salesforcedx.traceFlagPollingInterval`; `0` disables background polling, otherwise clamped to [min, max]. */
const getTraceFlagPollingIntervalMinutes = (): number => {
  const raw = vscode.workspace
    .getConfiguration('salesforcedx')
    .get<number>('traceFlagPollingInterval', DEFAULT_POLL_INTERVAL_MINUTES);
  if (raw === 0) return 0;
  return Math.max(MIN_POLL_INTERVAL_MINUTES, Math.min(MAX_POLL_INTERVAL_MINUTES, raw));
};

/**
 * Runs trace flag cleanup on each org connection AND on a user-configurable polling interval (default 5 min).
 * Forks and runs until extension scope closes. `salesforcedx.traceFlagPollingInterval=0` disables the recurring poll.
 */
export const traceFlagCleanupScheduler = Effect.fn('traceFlagCleanupScheduler')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const traceFlagService = yield* api.services.TraceFlagService;
  const targetOrgRef = yield* api.services.TargetOrgRef();
  const cleanup = traceFlagService.cleanupExpired().pipe(
    Effect.tapError(e => Effect.logWarning(String(e))),
    Effect.catchAll(() => Effect.void)
  );

  // On org switch: drop prior-org caches, then cleanup pre-provisioned expired flags. @W-22390896
  yield* Effect.fork(
    targetOrgRef.changes.pipe(
      Stream.map(orgInfo => orgInfo.orgId),
      Stream.changes,
      Stream.runForEach(() => traceFlagService.invalidateCaches.pipe(Effect.zipRight(cleanup)))
    )
  );

  const intervalMinutes = getTraceFlagPollingIntervalMinutes();
  yield* intervalMinutes > 0
    ? Effect.fork(
        Stream.fromSchedule(Schedule.fixed(Duration.minutes(intervalMinutes))).pipe(Stream.runForEach(() => cleanup))
      )
    : Effect.logInfo(
        'salesforcedx.traceFlagPollingInterval=0 — background trace flag polling disabled (per-org-connect cleanup still runs)'
      );

  yield* Effect.sleep(Duration.infinity);
});
