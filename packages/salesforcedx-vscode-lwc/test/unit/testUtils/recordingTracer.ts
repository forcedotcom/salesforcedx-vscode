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

export const createRecordingTracerLayer = (getRecordedSpans: () => RecordedSpan[]) =>
  Layer.succeed(
    Tracer.Tracer,
    Tracer.make({
      span: options => {
        const recordedSpans = getRecordedSpans();
        const span = new Tracer.NativeSpan(options);
        const recordedSpan: RecordedSpan = { name: span.name, attributes: span.attributes, ended: false };
        recordedSpans.push(recordedSpan);
        const end = span.end.bind(span);
        span.end = (endTime, exit) => {
          recordedSpan.ended = true;
          end(endTime, exit);
        };
        return span;
      }
    })
  );

export const createRecordingRuntimeMock = (getRecordedSpans: () => RecordedSpan[]) => {
  const layer = createRecordingTracerLayer(getRecordedSpans);
  return {
    getRuntime: () => ({
      runPromise: (effect: Effect.Effect<unknown, unknown>) => Effect.runPromise(effect.pipe(Effect.provide(layer))),
      runFork: (effect: Effect.Effect<unknown, unknown>) => {
        Effect.runSync(
          effect.pipe(
            Effect.provide(layer),
            Effect.catchCause(() => Effect.void)
          ) as Effect.Effect<void>
        );
        return undefined;
      },
      runSync: (effect: Effect.Effect<unknown, unknown>) => Effect.runSync(effect.pipe(Effect.provide(layer))),
      dispose: async () => undefined
    })
  };
};
