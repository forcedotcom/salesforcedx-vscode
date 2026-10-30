/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CliId, TargetOrgRef, type DefaultOrgInfoSchema } from '@salesforce/vscode-services-v2';
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
