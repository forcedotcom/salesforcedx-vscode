/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as TestClock from 'effect/testing/TestClock';
import { LanguageClientInitializationError, waitForLanguageClientReady } from '../../src/languageClientReady';

const status = (ready: boolean, failed: boolean, message = '') => ({
  isReady: () => ready,
  failedToInitialize: () => failed,
  getStatusMessage: () => message
});

describe('waitForLanguageClientReady', () => {
  it('fails with the language-client initialization status message', async () => {
    const exit = await Effect.runPromiseExit(waitForLanguageClientReady(() => status(false, true, 'Java is invalid')));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain(
        new LanguageClientInitializationError({ message: 'Java is invalid' })._tag
      );
      expect(JSON.stringify(exit.cause)).toContain('Java is invalid');
    }
  });

  it('returns false after language-client readiness polling expires', async () => {
    const getStatus = vi.fn(() => status(false, false));
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(waitForLanguageClientReady(getStatus));
          yield* TestClock.adjust('4 seconds');
          return yield* Fiber.join(fiber);
        })
      ).pipe(Effect.provide(TestClock.layer()))
    );

    expect(result).toBe(false);
    expect(getStatus).toHaveBeenCalledTimes(31);
  });
});
