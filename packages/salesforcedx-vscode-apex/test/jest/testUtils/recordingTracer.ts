/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Tracer from 'effect/Tracer';

export type RecordedSpan = { name: string; attributes: Map<string, unknown>; ended: boolean };

/**
 * Shared recording-tracer mock for `jest.mock('.../services/runtime')`. Pushes every started span
 * (name + attrs + ended flag) into the array returned by `getRecordedSpans` so span emission/rotation
 * can be asserted. `getRecordedSpans` is a thunk (not the array itself) because jest hoists imports
 * above the test's `const mockRecordedSpans`, so the array must be dereferenced lazily. Pass
 * `forkSync: true` when the test asserts synchronously right after the code under test forks (fireSpan
 * via runFork) — it runs the fork on the calling stack so the span is recorded before the assertion.
 */
export const createRecordingRuntimeMock = (
  getRecordedSpans: () => RecordedSpan[],
  options?: { forkSync?: boolean }
) => {
  const recordingTracer = Tracer.make({
    span: (name, parent, context, links, startTime, kind, spanOptions) => {
      const recordedSpans = getRecordedSpans();
      const attributes = new Map<string, unknown>(Object.entries(spanOptions?.attributes ?? {}));
      const recorded: RecordedSpan = { name, attributes, ended: false };
      recordedSpans.push(recorded);
      return {
        _tag: 'Span',
        name,
        spanId: `span-${recordedSpans.length}`,
        traceId: 'trace',
        parent,
        context,
        links,
        status: { _tag: 'Started', startTime },
        attributes,
        sampled: true,
        kind,
        end: () => {
          recorded.ended = true;
        },
        attribute: (key: string, value: unknown) => {
          attributes.set(key, value);
        },
        event: () => {},
        addLinks: () => {}
      } as Tracer.Span;
    },
    context: <X>(f: () => X) => f()
  });
  const layer = Layer.setTracer(recordingTracer);
  return {
    getRuntime: () => ({
      runPromise: (eff: Effect.Effect<unknown, unknown>) => Effect.runPromise(eff.pipe(Effect.provide(layer))),
      runFork: (eff: Effect.Effect<unknown, unknown>) => {
        const provided = eff.pipe(
          Effect.provide(layer),
          Effect.catchAllCause(() => Effect.void)
        );
        if (options?.forkSync) {
          Effect.runSync(provided as Effect.Effect<void>);
        } else {
          Effect.runFork(provided);
        }
        return undefined;
      },
      runSync: (eff: Effect.Effect<unknown, unknown>) => Effect.runSync(eff.pipe(Effect.provide(layer)))
    })
  };
};
