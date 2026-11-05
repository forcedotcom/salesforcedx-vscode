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
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';

/** Runs trace flag cleanup every 5 minutes (only when VS Code window is active) and immediately on each org connection. Forks and runs until extension scope closes. */
export const traceFlagCleanupScheduler = Effect.fn('traceFlagCleanupScheduler')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const traceFlagService = yield* api.v2.services.TraceFlagService;
  const targetOrgRef = yield* api.v2.services.TargetOrgRef;
  const cleanup = traceFlagService.cleanupExpired().pipe(
    Effect.tapError(e => Effect.logWarning(String(e))),
    Effect.catch(() => Effect.void)
  );

  // Run once each time a new org is connected (catches pre-provisioned expired flags like SFDC_DevConsole).
  yield* Effect.forkChild(
    targetOrgRef.pipe(
      SubscriptionRef.changes,
      Stream.map(orgInfo => orgInfo.orgId),
      Stream.changes,
      Stream.runForEach(() => cleanup)
    )
  );

  yield* Schedule.fixed(Duration.minutes(5)).pipe(
    Stream.fromSchedule,
    Stream.filter(() => vscode.window.state.active),
    Stream.runForEach(() => cleanup),
    Effect.forkChild
  );
  yield* Effect.sleep(Duration.infinity);
});
