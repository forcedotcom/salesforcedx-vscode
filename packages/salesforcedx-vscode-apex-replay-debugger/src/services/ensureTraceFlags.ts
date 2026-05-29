/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { AllServicesLayer } from './extensionProvider';

/** Promise bridge for imperative code. Ensures trace flags exist for the current target org user with the ReplayDebuggerLevels debug level. */
export const ensureTraceFlagsForCurrentUser = (): Promise<boolean> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const traceFlagService = yield* api.services.TraceFlagService;
      const userId = yield* traceFlagService.getUserId();
      const config = vscode.workspace.getConfiguration('salesforcedx-vscode-apex-log');
      const durationMinutes = config.get<number>('traceFlagsDefaultDurationMinutes', 30);
      yield* traceFlagService.ensureTraceFlag(userId, Duration.minutes(durationMinutes));
      return true;
    }).pipe(
      Effect.tapError(e => Effect.logError('ensureTraceFlagsForCurrentUser failed', e)),
      Effect.catchAll(() => Effect.succeed(false)),
      Effect.provide(AllServicesLayer)
    )
  );
