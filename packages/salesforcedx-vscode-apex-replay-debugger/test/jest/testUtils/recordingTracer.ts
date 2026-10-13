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

const createRecordingTracerLayer = (getRecordedSpans: () => RecordedSpan[]) =>
  Layer.setTracer(
    Tracer.make({
      span: (name, parent, context, links, startTime, kind, spanOptions) => {
        const recordedSpans = getRecordedSpans();
        const attributes = new Map<string, unknown>(Object.entries(spanOptions?.attributes ?? {}));
        const recordedSpan: RecordedSpan = { name, attributes, ended: false };
        recordedSpans.push(recordedSpan);
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
            recordedSpan.ended = true;
          },
          attribute: (key: string, value: unknown) => {
            attributes.set(key, value);
          },
          event: () => {},
          addLinks: () => {}
        } as Tracer.Span;
      },
      context: <A>(f: () => A) => f()
    })
  );

export const runWithRecordingTracer = <A, E>(effect: Effect.Effect<A, E>, recordedSpans: RecordedSpan[]) =>
  Effect.runPromise(effect.pipe(Effect.provide(createRecordingTracerLayer(() => recordedSpans))));
