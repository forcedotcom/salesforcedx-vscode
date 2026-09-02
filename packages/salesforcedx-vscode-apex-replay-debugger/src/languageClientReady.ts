/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';

type LanguageClientStatus = {
  readonly isReady: () => boolean;
  readonly failedToInitialize: () => boolean;
  readonly getStatusMessage: () => string;
};

export class LanguageClientInitializationError extends Schema.TaggedError<LanguageClientInitializationError>()(
  'LanguageClientInitializationError',
  { message: Schema.String }
) {}

class LanguageClientNotReadyError extends Schema.TaggedError<LanguageClientNotReadyError>()(
  'LanguageClientNotReadyError',
  {}
) {}

const LANGUAGE_CLIENT_READY_SCHEDULE = Schedule.fixed(Duration.millis(100)).pipe(
  Schedule.intersect(Schedule.recurs(30))
);

export const waitForLanguageClientReady = Effect.fn('ApexReplayDebugger.waitForLanguageClientReady')(function* (
  getStatus: () => LanguageClientStatus
) {
  const checkStatus = Effect.gen(function* () {
    const status = yield* Effect.sync(getStatus);
    if (status.failedToInitialize()) {
      return yield* new LanguageClientInitializationError({ message: status.getStatusMessage() });
    }
    if (!status.isReady()) {
      return yield* new LanguageClientNotReadyError();
    }
    return true;
  });

  return yield* checkStatus.pipe(
    Effect.retry({
      schedule: LANGUAGE_CLIENT_READY_SCHEDULE,
      while: error => error._tag === 'LanguageClientNotReadyError'
    }),
    Effect.catchTag('LanguageClientNotReadyError', () => Effect.succeed(false))
  );
});
