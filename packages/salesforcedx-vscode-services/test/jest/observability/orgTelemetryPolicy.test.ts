/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { DefaultOrgIdentity } from '../../../src/core/defaultOrgIdentity';
import { clearDefaultOrgRef, getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { CliId } from '../../../src/observability/cliTelemetry';
import { OrgTelemetryPolicy } from '../../../src/observability/orgTelemetryPolicy';

const testLayer = OrgTelemetryPolicy.DefaultWithoutDependencies.pipe(Layer.provideMerge(DefaultOrgIdentity.Default));
const runPolicy = <A, E>(effect: Effect.Effect<A, E, OrgTelemetryPolicy | DefaultOrgIdentity>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

describe('OrgTelemetryPolicy', () => {
  it.each([
    ['usa9', 'gov'],
    [' usa9s ', 'gov'],
    ['UsA9Gov', 'gov'],
    ['usa8', 'nonGov'],
    ['na44', 'nonGov']
  ] as const)('classifies instanceName %p as %s', async (instanceName, expected) => {
    expect(
      await runPolicy(
        Effect.gen(function* () {
          yield* DefaultOrgIdentity.set({ orgId: '00D1', instanceName });
          return yield* OrgTelemetryPolicy.getClassification('00D1');
        })
      )
    ).toBe(expected);
  });

  it.each([
    [{}, { classification: 'unknown' }],
    [{ orgId: '00D1' }, { orgId: '00D1', classification: 'unknown' }],
    [
      { orgId: '00D1', instanceName: '   ' },
      { orgId: '00D1', classification: 'unknown' }
    ]
  ] as const)('classifies incomplete identity as unknown', async (identity, expected) => {
    expect(
      await runPolicy(DefaultOrgIdentity.set(identity).pipe(Effect.zipRight(OrgTelemetryPolicy.getCurrent())))
    ).toEqual(expected);
  });

  it('keeps Gov classification for an orgId after a conflicting non-Gov identity', async () => {
    const result = await Effect.scoped(
      Effect.gen(function* () {
        yield* DefaultOrgIdentity.set({ orgId: '00D1', instanceName: 'usa9s' });
        const policy = yield* OrgTelemetryPolicy;
        yield* DefaultOrgIdentity.set({ orgId: '00D1', instanceName: 'na44' });
        yield* Effect.yieldNow();
        return yield* policy.getClassification('00D1');
      }).pipe(Effect.provide(testLayer))
    ).pipe(Effect.runPromise);

    expect(result).toBe('gov');
  });

  it('observes an identity switch during policy startup', async () => {
    const result = await Effect.scoped(
      Effect.gen(function* () {
        yield* DefaultOrgIdentity.set({ orgId: 'before', instanceName: 'na44' });
        const policy = yield* OrgTelemetryPolicy;
        yield* DefaultOrgIdentity.set({ orgId: 'after', instanceName: 'usa9s' });
        yield* Effect.yieldNow();
        return yield* policy.getCurrent();
      }).pipe(Effect.provide(testLayer))
    ).pipe(Effect.runPromise);

    expect(result).toEqual({ orgId: 'after', classification: 'gov' });
  });

  it('keeps Gov classification for an orgId when a later identity lacks instanceName', async () => {
    const result = await Effect.scoped(
      Effect.gen(function* () {
        yield* DefaultOrgIdentity.set({ orgId: '00D1', instanceName: 'usa9s' });
        const policy = yield* OrgTelemetryPolicy;
        yield* DefaultOrgIdentity.set({ orgId: '00D1' });
        yield* Effect.yieldNow();
        return yield* policy.getCurrent();
      }).pipe(Effect.provide(testLayer))
    ).pipe(Effect.runPromise);

    expect(result).toEqual({ orgId: '00D1', classification: 'gov' });
  });

  it('clears private identity alongside TargetOrgRef without changing its public schema', async () => {
    const publicRef = await Effect.runPromise(getDefaultOrgRef());
    const cliId = Schema.decodeSync(CliId)('11111111-1111-4111-8111-111111111111');
    const privateIdentity = await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.all([
          SubscriptionRef.set(publicRef, { orgId: '00D1', cliId, webUserId: 'web' }),
          DefaultOrgIdentity.set({ orgId: '00D1', instanceName: 'usa9s', cliId, webUserId: 'web' })
        ]);
        yield* Effect.all([clearDefaultOrgRef(), DefaultOrgIdentity.clear()]);
        return yield* DefaultOrgIdentity.get;
      }).pipe(Effect.provide(DefaultOrgIdentity.Default))
    );

    expect(await Effect.runPromise(SubscriptionRef.get(publicRef))).toEqual({ cliId, webUserId: 'web' });
    expect(privateIdentity).toEqual({ cliId, webUserId: 'web' });
  });

  it('exposes no instanceName through policy operations', async () => {
    const current = await runPolicy(
      DefaultOrgIdentity.set({ orgId: '00D1', instanceName: 'usa9s' }).pipe(
        Effect.zipRight(OrgTelemetryPolicy.getCurrent())
      )
    );

    expect(current).toEqual({ orgId: '00D1', classification: 'gov' });
    expect(current).not.toHaveProperty('instanceName');
  });

  it('isolates identity state between layer builds', async () => {
    const read = (orgId: string) =>
      DefaultOrgIdentity.set({ orgId }).pipe(
        Effect.zipRight(DefaultOrgIdentity.get),
        Effect.provide(DefaultOrgIdentity.Default),
        Effect.runPromise
      );

    expect(await Promise.all([read('first'), read('second')])).toEqual([{ orgId: 'first' }, { orgId: 'second' }]);
  });
});
