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

export const waitForLanguageClientReady = Effect.fn('ApexReplayDebugger.waitForLanguageClientReady')(function* (
  getStatus: () => LanguageClientStatus
) {
  return yield* Effect.sync(getStatus).pipe(
    Effect.filterOrFail(
      status => !status.failedToInitialize(),
      status => new LanguageClientInitializationError({ message: status.getStatusMessage() })
    ),
    Effect.filterOrFail(
      status => status.isReady(),
      () => new LanguageClientNotReadyError()
    ),
    Effect.as(true),
    Effect.retry({
      schedule: Schedule.fixed(Duration.millis(100)),
      times: 30,
      while: error => error._tag === 'LanguageClientNotReadyError'
    }),
    Effect.catchTag('LanguageClientNotReadyError', () => Effect.succeed(false))
  );
});
