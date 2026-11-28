/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import {
  ConnectionService,
  OrgId,
  TargetOrgRef,
  type DefaultOrgInfo,
  type ConnectionError,
  type InactiveOrgOperationError
} from '@salesforce/vscode-services/v2';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { setImmediate } from 'node:timers/promises';
import { makePreventOrgChanges } from '../../../src/services/preventOrgChanges.js';

const orgA = Schema.decodeUnknownSync(OrgId)('00D000000000001');
const orgB = Schema.decodeUnknownSync(OrgId)('00D000000000002');
const connection = {
  getAuthInfoFields: () => ({ orgId: orgA }),
  getConnectionOptions: () => ({})
} as unknown as Connection;
const prevent = makePreventOrgChanges(orgId => `Changed target: ${orgId}`);
class CallerSetting extends Context.Service<CallerSetting, string>()('test/CallerSetting') {}
const fixture = async (resolveConnection: () => Promise<Connection> = () => Promise.resolve(connection)) => {
  const ref = await Effect.runPromise(SubscriptionRef.make<DefaultOrgInfo>({ orgId: orgA }));
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      Layer.succeed(TargetOrgRef, ref),
      Layer.mock(ConnectionService, { getConnection: () => Effect.promise(resolveConnection) })
    )
  );
  return {
    ref,
    runtime,
    dispose: async () => {
      await runtime.dispose();
      await Effect.runPromise(PubSub.shutdown(ref.pubsub));
    }
  };
};

it('preserves the caller value, service requirement and exact Scope', async () => {
  const { runtime, dispose } = await fixture();
  const scope = Scope.makeUnsafe();
  const command = Effect.gen(function* () {
    return { setting: yield* CallerSetting, scope: yield* Scope.Scope };
  });
  const guarded: Effect.Effect<
    Effect.Success<typeof command>,
    ConnectionError | InactiveOrgOperationError,
    CallerSetting | Scope.Scope | TargetOrgRef | ConnectionService
  > = prevent(command);
  try {
    const value = await runtime.runPromise(
      guarded.pipe(Effect.provideService(CallerSetting, 'caller'), Scope.provide(scope))
    );
    expect(value).toEqual({ setting: 'caller', scope });
  } finally {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    await dispose();
  }
});

it('subscribes before auth and retains a target switch completed before auth resolves', async () => {
  const auth = Promise.withResolvers<Connection>();
  const started = Promise.withResolvers<void>();
  const { runtime, ref, dispose } = await fixture(() => {
    started.resolve();
    return auth.promise;
  });
  const ran = vi.fn();
  const running = runtime.runPromiseExit(prevent(Effect.sync(ran).pipe(Effect.andThen(Effect.never))));
  await started.promise;
  await runtime.runPromise(SubscriptionRef.set(ref, { orgId: orgB }));
  auth.resolve(connection);
  try {
    const exit = await running;
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit))
      expect(exit.cause.reasons).toContainEqual(
        expect.objectContaining({
          _tag: 'Fail',
          error: expect.objectContaining({
            _tag: 'InactiveOrgOperationError',
            expectedOrgId: orgA,
            observedOrgId: orgB,
            message: `Changed target: ${orgA}`
          })
        })
      );
    expect(ran).not.toHaveBeenCalled();
  } finally {
    auth.resolve(connection);
    await dispose();
  }
});

it('joins slow command cleanup and retains a cleanup defect when target-org cancellation wins', async () => {
  const { runtime, ref, dispose } = await fixture();
  const started = Promise.withResolvers<void>();
  const finalizing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const defect = new Error('cleanup defect');
  const command = Effect.sync(() => started.resolve()).pipe(
    Effect.andThen(Effect.never),
    Effect.onExit(() =>
      Effect.promise(() => {
        finalizing.resolve();
        return release.promise;
      }).pipe(Effect.andThen(Effect.die(defect)))
    )
  );
  let returned = false;
  const running = runtime.runPromiseExit(prevent(command)).then(exit => {
    returned = true;
    return exit;
  });
  await started.promise;
  await runtime.runPromise(SubscriptionRef.set(ref, {}));
  try {
    await finalizing.promise;
    await setImmediate();
    expect(returned).toBe(false);
  } finally {
    release.resolve();
  }
  try {
    const exit = await running;
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.reasons).toContainEqual(
        expect.objectContaining({ _tag: 'Fail', error: expect.objectContaining({ _tag: 'InactiveOrgOperationError' }) })
      );
      expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
    }
  } finally {
    await dispose();
  }
});

it('does not cancel on alias-only updates or the initial replay', async () => {
  const { runtime, ref, dispose } = await fixture();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<string>();
  const running = runtime.runPromise(
    prevent(
      Effect.promise(() => {
        started.resolve();
        return release.promise;
      })
    )
  );
  await started.promise;
  await runtime.runPromise(SubscriptionRef.set(ref, { orgId: orgA, alias: 'new alias' }));
  release.resolve('completed');
  try {
    expect(await running).toBe('completed');
  } finally {
    await dispose();
  }
});

it('preserves the original command error instead of converting it into an org-change failure', async () => {
  const { runtime, dispose } = await fixture();
  const failure = { _tag: 'CallerFailure' as const, value: 'original' };
  try {
    const exit = await runtime.runPromiseExit(prevent(Effect.fail(failure)));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit))
      expect(exit.cause.reasons.some(reason => reason._tag === 'Fail' && reason.error === failure)).toBe(true);
  } finally {
    await dispose();
  }
});
