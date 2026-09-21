/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';

/** Ensures trace flags exist for the current target org user with the ReplayDebuggerLevels debug level. */
export const ensureTraceFlagsForCurrentUser = Effect.fn('ensureTraceFlagsForCurrentUser')(
  function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const traceFlagService = yield* api.services.TraceFlagService;
    const [userId, durationMinutes] = yield* Effect.all([
      traceFlagService.getUserId(),
      api.services.SettingsService.getValueOrElse(
        'salesforcedx-vscode-apex-log',
        'traceFlagsDefaultDurationMinutes',
        30
      )
    ]);
    yield* traceFlagService.ensureTraceFlag(userId, Duration.minutes(durationMinutes));
    return true;
  },
  Effect.tapError(e => Effect.logError('ensureTraceFlagsForCurrentUser failed', e)),
  Effect.orElseSucceed(() => false)
);
