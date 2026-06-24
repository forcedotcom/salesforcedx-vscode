/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Clock from 'effect/Clock';
import * as Effect from 'effect/Effect';

/**
 * Pipeable operator that brackets an effect with the channel completion sentinel:
 * appends `Starting {executionName} at {t}` before running and `Ended {executionName} at {t}`
 * on both success and failure (via {@link Effect.ensuring}). Preserves the channel contract
 * that the deleted LibraryCommandletExecutor emitted; e2e specs gate completion on `Ended SFDX: …`.
 */
export const withExecutionLog =
  (executionName: string) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const channelService = yield* api.services.ChannelService;
      const startMs = yield* Clock.currentTimeMillis;
      yield* channelService.appendToChannel(`Starting ${executionName} at ${new Date(startMs).toLocaleTimeString()}`);
      return yield* self.pipe(
        Effect.ensuring(
          Clock.currentTimeMillis.pipe(
            Effect.flatMap(endMs =>
              channelService.appendToChannel(`Ended ${executionName} at ${new Date(endMs).toLocaleTimeString()}`)
            )
          )
        )
      );
    });
