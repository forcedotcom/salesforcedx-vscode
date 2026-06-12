/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import { callLLMWithRetry } from '../../../../src/oas/generationStrategy/json/apexRest';
import { LLMService } from '../../../../src/services/llmService';

// Beyond the 5-retry exponential schedule's worst case (1+2+4+8+16+32 = 63s, capped at 30s each).
const PAST_ALL_RETRIES = '200 seconds';

/** Mock LLMService whose callLLM returns queued responses in order; throws if it runs dry. */
const mockLLMLayer = (responses: string[]) => {
  const queue = [...responses];
  const callLLM = jest.fn(() =>
    Effect.suspend(() => {
      if (queue.length === 0) throw new Error('callLLM invoked more times than queued responses');
      return Effect.succeed(queue.shift()!);
    })
  );
  return { layer: Layer.succeed(LLMService, { callLLM } as unknown as InstanceType<typeof LLMService>), callLLM };
};

const run = <A, E>(effect: Effect.Effect<A, E, LLMService>, llmLayer: Layer.Layer<LLMService>) =>
  Effect.runPromiseExit(effect.pipe(Effect.provide(llmLayer), Effect.provide(TestContext.TestContext)));

describe('callLLMWithRetry', () => {
  it('returns the response when the first call is non-empty', async () => {
    const { layer, callLLM } = mockLLMLayer(['{"openapi":"3.0.0"}']);
    const exit = await run(callLLMWithRetry('prompt', 750, jest.fn()), layer);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value).toBe('{"openapi":"3.0.0"}');
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('retries on an empty response and returns the first non-empty result', async () => {
    const { layer, callLLM } = mockLLMLayer(['', '', '{"openapi":"3.0.0"}']);

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(callLLMWithRetry('prompt', 750, jest.fn()));
        // Advance past the backoff windows so the scheduled retries fire.
        yield* TestClock.adjust(PAST_ALL_RETRIES);
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(layer), Effect.provide(TestContext.TestContext))
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value).toBe('{"openapi":"3.0.0"}');
    expect(callLLM).toHaveBeenCalledTimes(3);
  });

  it('fails with LLMRetriesExhausted when every attempt is empty', async () => {
    // 1 initial + 5 retries = 6 attempts, all empty.
    const { layer, callLLM } = mockLLMLayer(Array(6).fill(''));

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(callLLMWithRetry('prompt', 750, jest.fn()));
        yield* TestClock.adjust(PAST_ALL_RETRIES);
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(layer), Effect.provide(TestContext.TestContext))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = Exit.causeOption(exit).pipe(opt => (opt._tag === 'Some' ? opt.value : undefined));
      expect(String(error)).toContain('LLMRetriesExhausted');
    }
    expect(callLLM).toHaveBeenCalledTimes(6);
  });

  it('invokes the onAttempt callback once per attempt', async () => {
    const onAttempt = jest.fn();
    const { layer } = mockLLMLayer(['', '{"openapi":"3.0.0"}']);

    await Effect.runPromiseExit(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(callLLMWithRetry('prompt', 750, onAttempt));
        yield* TestClock.adjust(PAST_ALL_RETRIES);
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(layer), Effect.provide(TestContext.TestContext))
    );

    expect(onAttempt).toHaveBeenCalledTimes(2);
  });
});
