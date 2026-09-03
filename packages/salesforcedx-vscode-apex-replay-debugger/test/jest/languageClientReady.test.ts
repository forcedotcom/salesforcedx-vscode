/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import { LanguageClientInitializationError, waitForLanguageClientReady } from '../../src/languageClientReady';

const status = (ready: boolean, failed: boolean, message = '') => ({
  isReady: () => ready,
  failedToInitialize: () => failed,
  getStatusMessage: () => message
});

describe('waitForLanguageClientReady', () => {
  it('fails with the language-client initialization status message', async () => {
    const exit = await Effect.runPromiseExit(waitForLanguageClientReady(() => status(false, true, 'Java is invalid')));

    expect(exit).toEqual(Exit.fail(new LanguageClientInitializationError({ message: 'Java is invalid' })));
  });

  it('returns false after language-client readiness polling expires', async () => {
    const getStatus = jest.fn(() => status(false, false));
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(waitForLanguageClientReady(getStatus));
        yield* TestClock.adjust(Duration.seconds(4));
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestContext.TestContext))
    );

    expect(result).toBe(false);
    expect(getStatus).toHaveBeenCalledTimes(31);
  });
});
