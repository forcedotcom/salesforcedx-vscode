/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import type { AnySpan, Span } from 'effect/Tracer';

const isEffectSpan = (s: AnySpan): s is Span => s._tag === 'Span';

const findRoot = (current: Span): Option.Option<Span> => {
  const parent = current.parent;
  if (Option.isNone(parent)) return Option.some(current);
  const p = parent.value;
  return isEffectSpan(p) ? findRoot(p) : Option.none();
};

/**
 * Annotate the trace's root span (walks `Span.parent` until it hits the top).
 *
 * Why this exists: our telemetry pipeline only ships top-level spans (and command spans) to
 * App Insights and O11y. `Effect.annotateCurrentSpan` writes to the current fiber's span,
 * which often isn't exported. Use this when the attribute should reach production telemetry
 * regardless of where in the call tree the annotation happens.
 *
 * No-ops with a debug log when there is no current span or the chain dead-ends at a
 * non-Effect (External) span.
 */
export const annotateRootSpan: {
  (key: string, value: unknown): Effect.Effect<void>;
  (values: Record<string, unknown>): Effect.Effect<void>;
} = (...args: [string, unknown] | [Record<string, unknown>]) =>
  Effect.currentSpan.pipe(
    Effect.flatMap(current =>
      Option.match(findRoot(current), {
        onNone: () =>
          Effect.logDebug('annotateRootSpan: no Effect-owned root span found', {
            traceId: current.traceId
          }),
        onSome: root =>
          Effect.sync(() => {
            const entries = args.length === 2 ? ([[args[0], args[1]]] as const) : Object.entries(args[0]);
            entries.forEach(([k, v]) => root.attribute(k, v));
          })
      })
    ),
    Effect.catchTag('NoSuchElementException', () => Effect.logDebug('annotateRootSpan: no current span'))
  );
