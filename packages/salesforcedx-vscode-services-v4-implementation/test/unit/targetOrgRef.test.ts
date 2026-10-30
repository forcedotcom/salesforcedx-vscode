/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CliId,
  InactiveOrgOperationError,
  OrgId,
  TargetOrgRef,
  type DefaultOrgInfoSchema
} from '@salesforce/vscode-services-v2';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { OrgChanges, orgLayers } from '../../src/targetOrgRef.js';

it('serializes commits through callback acknowledgment, even when the caller cancels', async () => {
  const runtime = ManagedRuntime.make(orgLayers);
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const changes = yield* OrgChanges;
        const generation = yield* changes.begin;
        const entered = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const mirror: (typeof DefaultOrgInfoSchema.Encoded)[] = [];
        const stop = yield* changes.subscribe(async org => {
          if (org.username === 'first') {
            await Effect.runPromise(Deferred.succeed(entered, undefined));
            await Effect.runPromise(Deferred.await(release));
          }
          mirror.push(org);
        });
        const first = yield* changes
          .update(generation, () => Effect.succeed({ username: 'first' }))
          .pipe(Effect.forkChild);
        yield* Deferred.await(entered);
        const cancelled = yield* Fiber.interrupt(first).pipe(Effect.forkChild);
        const second = yield* changes.clear.pipe(Effect.forkChild);
        yield* Effect.yieldNow;
        expect(mirror).toEqual([{}]);
        expect(second.pollUnsafe()).toBeUndefined();
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(cancelled);
        yield* Fiber.join(second);
        expect(mirror).toEqual([{}, { username: 'first' }, {}]);
        yield* stop.stop;
      })
    );
  } finally {
    await runtime.dispose();
  }
});

it('rejects A/B/A stale generations and clears while preserving telemetry identity', async () => {
  const runtime = ManagedRuntime.make(orgLayers);
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const changes = yield* OrgChanges;
        const first = yield* changes.begin;
        yield* changes.update(first, () => Effect.succeed({ username: 'A' }));
        const second = yield* changes.begin;
        yield* changes.update(second, () => Effect.succeed({ username: 'B' }));
        const third = yield* changes.begin;
        const cliId = Schema.decodeUnknownSync(CliId)('00000000-0000-4000-8000-000000000001');
        yield* changes.update(third, () => Effect.succeed({ username: 'A', cliId, webUserId: 'web-user' }));
        expect(yield* changes.update(first, () => Effect.succeed({ username: 'stale' }))).toBe(false);
        yield* changes.clearIfCurrent(second);
        expect((yield* changes.snapshot).org.username).toBe('A');
        yield* changes.clear;
        expect((yield* changes.snapshot).org).toEqual({ cliId, webUserId: 'web-user' });
        expect(yield* changes.update(third, () => Effect.succeed({ username: 'resurrected' }))).toBe(false);
      })
    );
  } finally {
    await runtime.dispose();
  }
});

it('acknowledges equal commits and removes a subscriber whose initial snapshot fails', async () => {
  const runtime = ManagedRuntime.make(orgLayers);
  const defect = new Error('snapshot failed');
  const failed = vi.fn(() => Promise.reject(defect));
  try {
    const changes = await runtime.runPromise(OrgChanges);
    const exit = await runtime.runPromiseExit(changes.subscribe(failed));
    expect(Exit.isFailure(exit)).toBe(true);
    const seen: (typeof DefaultOrgInfoSchema.Encoded)[] = [];
    await runtime.runPromise(
      changes.subscribe(org => {
        seen.push(org);
        return Promise.resolve();
      })
    );
    const generation = await runtime.runPromise(changes.begin);
    await runtime.runPromise(changes.update(generation, () => Effect.succeed({})));
    expect(seen).toEqual([{}, {}]);
    expect(failed).toHaveBeenCalledTimes(1);
    const ref = await runtime.runPromise(TargetOrgRef);
    expect(await runtime.runPromise(SubscriptionRef.get(ref))).toEqual({});
  } finally {
    await runtime.dispose();
  }
});

it('separates auth attempts from committed org generations, including canonical username casing and clear', async () => {
  const runtime = ManagedRuntime.make(orgLayers);
  const a = Schema.decodeUnknownSync(OrgId)('00D000000000001');
  const b = Schema.decodeUnknownSync(OrgId)('00D000000000002');
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const changes = yield* OrgChanges;
        const first = yield* changes.begin;
        yield* changes.update(first, () => Effect.succeed({ orgId: a, username: 'User@example.com' }));
        const selected = yield* changes.snapshot;
        const second = yield* changes.begin;
        expect((yield* changes.snapshot).orgGeneration).toBe(selected.orgGeneration);
        yield* changes.update(second, current =>
          Effect.succeed({ ...current.org, username: 'user@EXAMPLE.com', aliases: ['A'], tracksSource: true })
        );
        yield* changes.clearIfCurrent(first);
        const unchanged = yield* changes.snapshot;
        expect(unchanged.orgGeneration).toBe(selected.orgGeneration);
        expect(unchanged.generation).toBe(second);
        yield* changes.clearIfCurrent(second);
        expect((yield* changes.snapshot).orgGeneration).toBe(selected.orgGeneration + 1);
        yield* changes.clear;
        expect((yield* changes.snapshot).orgGeneration).toBe(selected.orgGeneration + 2);
        const startA = yield* changes.begin;
        yield* changes.update(startA, () => Effect.succeed({ orgId: a, username: 'user@example.com' }));
        const beforeSwitch = yield* changes.snapshot;
        const selectB = yield* changes.begin;
        yield* changes.update(selectB, () => Effect.succeed({ orgId: b, username: 'other@example.com' }));
        const selectA = yield* changes.begin;
        yield* changes.update(selectA, () => Effect.succeed({ orgId: a, username: 'user@example.com' }));
        expect((yield* changes.snapshot).orgGeneration).toBe(beforeSwitch.orgGeneration + 2);
      })
    );
  } finally {
    await runtime.dispose();
  }
});

it('rejects a stale org-generation commit before running any filesystem/publication work', async () => {
  const runtime = ManagedRuntime.make(orgLayers);
  const a = Schema.decodeUnknownSync(OrgId)('00D000000000001');
  const b = Schema.decodeUnknownSync(OrgId)('00D000000000002');
  const write = vi.fn<() => void>();
  try {
    const changes = await runtime.runPromise(OrgChanges);
    const first = await runtime.runPromise(changes.begin);
    await runtime.runPromise(changes.update(first, () => Effect.succeed({ orgId: a, username: 'A' })));
    const expected = await runtime.runPromise(changes.snapshot);
    const second = await runtime.runPromise(changes.begin);
    await runtime.runPromise(changes.update(second, () => Effect.succeed({ orgId: b, username: 'B' })));
    const failure = await runtime.runPromise(
      changes
        .commitIfCurrent(
          expected.orgGeneration,
          new InactiveOrgOperationError({ expectedOrgId: a, message: 'Org changed' }),
          Effect.sync(write)
        )
        .pipe(Effect.flip)
    );
    expect(failure).toMatchObject({ _tag: 'InactiveOrgOperationError', expectedOrgId: a, observedOrgId: b });
    expect(write).not.toHaveBeenCalled();
  } finally {
    await runtime.dispose();
  }
});

it('finishes a bounded domain commit before acknowledging a later org switch despite caller cancellation', async () => {
  const runtime = ManagedRuntime.make(orgLayers);
  const a = Schema.decodeUnknownSync(OrgId)('00D000000000001');
  const b = Schema.decodeUnknownSync(OrgId)('00D000000000002');
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const changes = yield* OrgChanges;
        const first = yield* changes.begin;
        yield* changes.update(first, () => Effect.succeed({ orgId: a, username: 'A' }));
        const expected = yield* changes.snapshot;
        const entered = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const written = vi.fn<() => void>();
        const commit = yield* changes
          .commitIfCurrent(
            expected.orgGeneration,
            new InactiveOrgOperationError({ expectedOrgId: a, message: 'Org changed' }),
            Deferred.succeed(entered, undefined).pipe(
              Effect.andThen(Deferred.await(release)),
              Effect.andThen(Effect.sync(written))
            )
          )
          .pipe(Effect.forkChild);
        yield* Deferred.await(entered);
        const switching = yield* changes.begin.pipe(
          Effect.flatMap(generation => changes.update(generation, () => Effect.succeed({ orgId: b, username: 'B' }))),
          Effect.forkChild
        );
        const cancel = yield* Fiber.interrupt(commit).pipe(Effect.forkChild);
        yield* Effect.yieldNow;
        expect(switching.pollUnsafe()).toBeUndefined();
        expect(written).not.toHaveBeenCalled();
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(cancel);
        yield* Fiber.join(switching);
        expect(written).toHaveBeenCalledTimes(1);
        expect((yield* changes.snapshot).org.orgId).toBe(b);
      })
    );
  } finally {
    await runtime.dispose();
  }
});
