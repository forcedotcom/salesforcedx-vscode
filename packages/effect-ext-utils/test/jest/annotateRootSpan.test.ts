/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Tracer from 'effect/Tracer';
import { annotateRootSpan } from '../../src/annotateRootSpan';

type CapturedSpans = {
  root?: Tracer.Span;
  mid?: Tracer.Span;
  leaf?: Tracer.Span;
};

const captureSpan = (key: keyof CapturedSpans, holder: CapturedSpans) =>
  Effect.flatMap(Effect.currentSpan, span =>
    Effect.sync(() => {
      holder[key] = span;
    })
  );

describe('annotateRootSpan', () => {
  it('annotates the current span when current is the root', async () => {
    const holder: CapturedSpans = {};
    const program = Effect.gen(function* () {
      yield* captureSpan('root', holder);
      yield* annotateRootSpan('marker', 'value-a');
    }).pipe(Effect.withSpan('root'));

    await Effect.runPromise(program);

    expect(holder.root?.attributes.get('marker')).toBe('value-a');
  });

  it('walks up to the root through nested spans', async () => {
    const holder: CapturedSpans = {};
    const leaf = Effect.gen(function* () {
      yield* captureSpan('leaf', holder);
      yield* annotateRootSpan('marker', 'value-b');
    }).pipe(Effect.withSpan('leaf'));

    const mid = Effect.gen(function* () {
      yield* captureSpan('mid', holder);
      yield* leaf;
    }).pipe(Effect.withSpan('mid'));

    const root = Effect.gen(function* () {
      yield* captureSpan('root', holder);
      yield* mid;
    }).pipe(Effect.withSpan('root'));

    await Effect.runPromise(root);

    expect(holder.root?.attributes.get('marker')).toBe('value-b');
    expect(holder.mid?.attributes.get('marker')).toBeUndefined();
    expect(holder.leaf?.attributes.get('marker')).toBeUndefined();
  });

  it('writes all keys from a record overload to the root', async () => {
    const holder: CapturedSpans = {};
    const leaf = Effect.gen(function* () {
      yield* annotateRootSpan({ a: 1, b: 'two', c: true });
    }).pipe(Effect.withSpan('leaf'));

    const root = Effect.gen(function* () {
      yield* captureSpan('root', holder);
      yield* leaf;
    }).pipe(Effect.withSpan('root'));

    await Effect.runPromise(root);

    expect(holder.root?.attributes.get('a')).toBe(1);
    expect(holder.root?.attributes.get('b')).toBe('two');
    expect(holder.root?.attributes.get('c')).toBe(true);
  });

  it('no-ops without throwing when there is no current span', async () => {
    await expect(Effect.runPromise(annotateRootSpan('marker', 'value-c'))).resolves.toBeUndefined();
  });

  it('no-ops when the chain dead-ends at an ExternalSpan', async () => {
    const externalParent = Tracer.externalSpan({
      spanId: 'ext-span-id',
      traceId: 'ext-trace-id',
      sampled: true
    });

    const holder: CapturedSpans = {};
    const program = Effect.gen(function* () {
      yield* captureSpan('root', holder);
      yield* annotateRootSpan('marker', 'value-d');
    }).pipe(Effect.withSpan('rooted-under-external', { parent: externalParent }));

    await Effect.runPromise(program);

    expect(holder.root?.attributes.get('marker')).toBeUndefined();
    expect(Option.isSome(holder.root!.parent)).toBe(true);
    expect(holder.root!.parent.pipe(Option.getOrThrow)._tag).toBe('ExternalSpan');
  });
});
