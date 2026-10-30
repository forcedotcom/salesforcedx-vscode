/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Runtime from 'effect/Runtime';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  AccessTokenExpiredError,
  createLegacyServices,
  FailedToCreateAuthInfoError,
  FailedToCreateConfigAggregatorError,
  FailedToCreateConnectionError,
  makeV4Host,
  NoTargetOrgConfiguredError,
  NoWorkspaceOpenError,
  SettingsError,
  V4Cause,
  V4Deferred,
  V4Effect,
  type Connection
} from '../bridgeHost/host.js';

const tags = (cause: Cause.Cause<unknown>): string[] => {
  switch (cause._tag) {
    case 'Empty':
      return [];
    case 'Sequential':
    case 'Parallel':
      return [...tags(cause.left), ...tags(cause.right)];
    default:
      return [cause._tag];
  }
};

export const advancedConformance = async (connection: Connection) => {
  const owner = await makeV4Host(connection);
  const legacy = await createLegacyServices(owner.host);
  const program = legacy.services.ConnectionService.getConnection().pipe(
    Effect.provide(legacy.services.prebuiltServicesLayer)
  );
  const sdkCause = new Error('SDK cause');
  const errors = [
    new SettingsError({ cause: sdkCause, key: 'accessToken', section: 'fixture', message: 'settings' }),
    new NoWorkspaceOpenError({ message: 'workspace' }),
    new FailedToCreateConfigAggregatorError({ message: 'config', cause: sdkCause }),
    new FailedToCreateAuthInfoError({ message: 'auth', cause: sdkCause }),
    new FailedToCreateConnectionError({ message: 'connection', cause: sdkCause }),
    new NoTargetOrgConfiguredError({ message: 'target' }),
    new AccessTokenExpiredError({ message: 'expired', username: 'fixture' })
  ];
  for (const expected of errors) {
    await owner.setConnectionBehavior(() => V4Effect.fail(expected));
    const boundary = await owner.host.getConnection(undefined, new AbortController().signal);
    assert.ok(boundary._tag === 'Failure');
    for (const reason of boundary.reasons) {
      if (reason._tag === 'Fail') {
        assert.equal(V4Effect.isEffect(reason.error), false, 'failure DTO must not be a runnable V4 tagged error');
        assert.equal(Effect.isEffect(reason.error), false);
      }
    }
    const exit = await Effect.runPromiseExit(program);
    assert.ok(Exit.isFailure(exit));
    const actual = [...Cause.failures(exit.cause)][0];
    assert.equal(actual._tag, expected._tag);
    assert.equal(actual.message, expected.message);
    assert.ok(
      actual instanceof Error && Effect.isEffect(actual),
      'decoded errors must be genuine V3 yieldable tagged errors'
    );
    assert.notEqual(actual, expected, 'never expose a V4 yieldable error as a V3 Effect');
    Object.entries(expected).forEach(([key, value]) => assert.deepEqual(Reflect.get(actual, key), value));
    if ('cause' in expected) assert.ok('cause' in actual && actual.cause === expected.cause);
  }

  const defect = new Error('opaque defect');
  const mixed = V4Cause.fromReasons([
    V4Cause.makeFailReason(new NoTargetOrgConfiguredError({ message: 'mixed' })),
    V4Cause.makeDieReason(defect),
    V4Cause.makeInterruptReason(42)
  ]);
  await owner.setConnectionBehavior(() => V4Effect.failCause(mixed));
  const mixedExit = await Effect.runPromiseExit(program);
  assert.ok(Exit.isFailure(mixedExit));
  assert.deepEqual(
    tags(mixedExit.cause).filter(tag => tag !== 'Interrupt'),
    ['Fail', 'Die']
  );
  assert.ok(Cause.isInterrupted(mixedExit.cause));
  assert.ok([...Cause.defects(mixedExit.cause)].includes(defect));

  let receivedUsername: string | undefined;
  await owner.setConnectionBehavior(username =>
    V4Effect.sync(() => {
      receivedUsername = username;
      return connection;
    })
  );
  const named = legacy.services.ConnectionService.getConnection('named-alias').pipe(
    Effect.provide(legacy.services.prebuiltServicesLayer)
  );
  assert.equal(await Effect.runPromise(named), connection);
  assert.equal(receivedUsername, 'named-alias');
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  const beforeAbort = owner.stats().connectionCalls;
  const aborted = await owner.host.getConnection(undefined, alreadyAborted.signal);
  assert.ok(aborted._tag === 'Failure' && aborted.reasons.some(reason => reason._tag === 'Interrupt'));
  assert.equal(
    owner.stats().connectionCalls,
    beforeAbort,
    'V4 run options alone do not prevent already-aborted synchronous work'
  );

  const started = V4Effect.runSync(V4Deferred.make<void>());
  const finalizing = V4Effect.runSync(V4Deferred.make<void>());
  const release = V4Effect.runSync(V4Deferred.make<void>());
  const cleanupDefect = new Error('slow finalizer defect');
  await owner.setConnectionBehavior(() =>
    V4Deferred.succeed(started, undefined).pipe(
      V4Effect.andThen(V4Effect.never),
      V4Effect.ensuring(
        V4Deferred.succeed(finalizing, undefined).pipe(
          V4Effect.andThen(V4Deferred.await(release)),
          V4Effect.andThen(V4Effect.die(cleanupDefect))
        )
      )
    )
  );
  const fiber = Effect.runFork(program);
  await owner.runtime.runPromise(V4Deferred.await(started));
  let interruptionFinished = false;
  const interruption = Effect.runPromise(Fiber.interrupt(fiber)).then(exit => {
    interruptionFinished = true;
    return exit;
  });
  await owner.runtime.runPromise(V4Deferred.await(finalizing));
  assert.equal(interruptionFinished, false);
  await owner.runtime.runPromise(V4Deferred.succeed(release, undefined));
  const interrupted = await interruption;
  assert.ok(Exit.isFailure(interrupted) && Cause.isInterrupted(interrupted.cause));
  assert.ok([...Cause.defects(interrupted.cause)].includes(cleanupDefect));

  const captured: string[] = [];
  const log = console.log;
  try {
    console.log = (...values: unknown[]) => {
      captured.push(values.join(' '));
    };
    await Effect.runPromise(
      Effect.log('Bearer fixture-secret').pipe(Effect.provide(legacy.services.prebuiltServicesLayer))
    );
  } finally {
    console.log = log;
  }
  assert.ok(captured.some(value => value.includes('<REDACTED BEARER TOKEN>')));
  assert.ok(captured.every(value => !value.includes('fixture-secret')));
  await legacy.dispose();
  assert.equal(owner.subscriberCount(), 0);
  await owner.dispose();
  assert.deepEqual(owner.stats(), { graphBuilds: 1, graphDisposals: 1, connectionCalls: errors.length * 2 + 3 });

  const preAbortedOwner = await makeV4Host(connection);
  let attemptedSubscriptions = 0;
  const preAbortedSignal = new AbortController();
  preAbortedSignal.abort();
  await assert.rejects(
    createLegacyServices(
      {
        ...preAbortedOwner.host,
        subscribeOrgChanges: callback => {
          attemptedSubscriptions++;
          return preAbortedOwner.host.subscribeOrgChanges(callback);
        }
      },
      preAbortedSignal.signal
    )
  );
  assert.equal(attemptedSubscriptions, 0, 'already-cancelled creation must not begin host initialization');
  assert.equal(preAbortedOwner.subscriberCount(), 0);
  await preAbortedOwner.dispose();

  // A cancellation during initial subscription waits for stop-handle registration and rolls back.
  const startupOwner = await makeV4Host(connection);
  const initialStarted = Promise.withResolvers<void>();
  const finishInitial = Promise.withResolvers<void>();
  const startupSignal = new AbortController();
  const creating = createLegacyServices(
    {
      ...startupOwner.host,
      subscribeOrgChanges: callback =>
        startupOwner.host.subscribeOrgChanges(async snapshot => {
          initialStarted.resolve();
          await finishInitial.promise;
          await callback(snapshot);
        })
    },
    startupSignal.signal
  ).then(
    value => ({ _tag: 'Success', value }) as const,
    (error: unknown) => ({ _tag: 'Failure', error }) as const
  );
  await initialStarted.promise;
  startupSignal.abort();
  finishInitial.resolve();
  const creation = await creating;
  assert.ok(creation._tag === 'Failure' && Runtime.isFiberFailure(creation.error));
  assert.ok(Cause.isInterrupted(creation.error[Runtime.FiberFailureCauseId]));
  assert.equal(startupOwner.subscriberCount(), 0);
  await startupOwner.dispose();

  const failedStartupOwner = await makeV4Host(connection);
  const initializationDefect = new Error('initial snapshot callback');
  await assert.rejects(
    createLegacyServices({
      ...failedStartupOwner.host,
      subscribeOrgChanges: () =>
        failedStartupOwner.host.subscribeOrgChanges(async () => {
          throw initializationDefect;
        })
    }),
    (error: unknown) =>
      Runtime.isFiberFailure(error) &&
      [...Cause.defects(error[Runtime.FiberFailureCauseId])].includes(initializationDefect)
  );
  assert.equal(failedStartupOwner.subscriberCount(), 0, 'failed initial callback must roll back host registration');
  await failedStartupOwner.dispose();

  // Finalizer failure remains a failure for all concurrent and repeated disposals.
  const disposalOwner = await makeV4Host(connection);
  const disposalDefect = new Error('unsubscribe defect');
  let stops = 0;
  const failing = await createLegacyServices({
    ...disposalOwner.host,
    subscribeOrgChanges: async callback => {
      const subscribed = await disposalOwner.host.subscribeOrgChanges(callback);
      if (subscribed._tag === 'Failure') return subscribed;
      return {
        _tag: 'Success',
        value: async () => {
          stops++;
          const stopped = await subscribed.value();
          return stopped._tag === 'Failure' ? stopped : disposalOwner.run(V4Effect.die(disposalDefect));
        }
      };
    }
  });
  const disposals = await Promise.allSettled([failing.dispose(), failing.dispose(), failing.dispose()]);
  for (const result of disposals) {
    assert.ok(result.status === 'rejected' && Runtime.isFiberFailure(result.reason));
    assert.ok([...Cause.defects(result.reason[Runtime.FiberFailureCauseId])].includes(disposalDefect));
  }
  assert.equal(stops, 1);
  assert.equal(disposalOwner.subscriberCount(), 0);
  await assert.rejects(failing.dispose());
  assert.equal(stops, 1);
  await disposalOwner.dispose();

  await shutdownWithActiveCalls(connection);
  await acknowledgedCommitRace(connection, false);
  await acknowledgedCommitRace(connection, true);
  console.log(
    'PASS actual V4 host: seven V3 tagged errors, mixed Cause reasons, named org argument, pre-aborted work guard, slow failing finalizers, startup cancellation, redaction and shared disposal failure'
  );
};

const shutdownWithActiveCalls = async (connection: Connection) => {
  const owner = await makeV4Host(connection);
  const legacy = await createLegacyServices(owner.host);
  const firstStarted = V4Effect.runSync(V4Deferred.make<void>());
  const secondStarted = V4Effect.runSync(V4Deferred.make<void>());
  const secondFinalizing = V4Effect.runSync(V4Deferred.make<void>());
  const releaseSecond = V4Effect.runSync(V4Deferred.make<void>());
  const firstDefect = new Error('first shutdown finalizer');
  await owner.setConnectionBehavior(username =>
    username === 'first'
      ? V4Deferred.succeed(firstStarted, undefined).pipe(
          V4Effect.andThen(V4Effect.never),
          V4Effect.ensuring(V4Effect.die(firstDefect))
        )
      : V4Deferred.succeed(secondStarted, undefined).pipe(
          V4Effect.andThen(V4Effect.never),
          V4Effect.ensuring(
            V4Deferred.succeed(secondFinalizing, undefined).pipe(V4Effect.andThen(V4Deferred.await(releaseSecond)))
          )
        )
  );
  const call = (username: string) =>
    legacy.services.ConnectionService.getConnection(username).pipe(
      Effect.provide(legacy.services.prebuiltServicesLayer)
    );
  const first = Effect.runFork(call('first'));
  const second = Effect.runFork(call('second'));
  await owner.runtime.runPromise(V4Effect.all([V4Deferred.await(firstStarted), V4Deferred.await(secondStarted)]));
  let disposed = false;
  const closing = Promise.all([legacy.dispose(), legacy.dispose()]).then(() => {
    disposed = true;
  });
  await owner.runtime.runPromise(V4Deferred.await(secondFinalizing));
  assert.equal(disposed, false, 'a failed first call must not short-circuit draining the second call');
  const before = owner.stats().connectionCalls;
  const rejected = await Effect.runPromiseExit(call('after-close'));
  assert.ok(Exit.isFailure(rejected) && Cause.isInterrupted(rejected.cause));
  assert.equal(owner.stats().connectionCalls, before);
  await owner.runtime.runPromise(V4Deferred.succeed(releaseSecond, undefined));
  await closing;
  const exits = await Promise.all([Effect.runPromise(Fiber.await(first)), Effect.runPromise(Fiber.await(second))]);
  assert.ok(Exit.isFailure(exits[0]) && [...Cause.defects(exits[0].cause)].includes(firstDefect));
  assert.ok(Exit.isFailure(exits[1]) && Cause.isInterrupted(exits[1].cause));
  assert.equal(owner.subscriberCount(), 0);
  assert.equal(owner.stats().graphDisposals, 0);
  await owner.dispose();
  assert.equal(owner.stats().graphDisposals, 1);
};

const acknowledgedCommitRace = async (connection: Connection, unsafeInterruptibleCommits: boolean) => {
  const owner = await makeV4Host(connection, { unsafeInterruptibleCommits });
  const callbackStarted = Promise.withResolvers<void>();
  const releaseCallback = Promise.withResolvers<void>();
  const callbackFinished = Promise.withResolvers<void>();
  const legacy = await createLegacyServices({
    ...owner.host,
    subscribeOrgChanges: callback =>
      owner.host.subscribeOrgChanges(async snapshot => {
        if (snapshot.orgId === '00D000000000002') {
          callbackStarted.resolve();
          await releaseCallback.promise;
        }
        await callback(snapshot);
        if (snapshot.orgId === '00D000000000002') callbackFinished.resolve();
      })
  });
  const ref = await Effect.runPromise(legacy.services.TargetOrgRef());
  const signal = new AbortController();
  const older = owner.commitOrg({ orgId: '00D000000000002' }, signal.signal);
  await callbackStarted.promise;
  signal.abort();
  if (unsafeInterruptibleCommits) {
    // Negative control: cancellation releases the permit while the plain callback Promise lives on.
    await older;
    await owner.commitOrg({ orgId: '00D000000000003' });
    releaseCallback.resolve();
    await callbackFinished.promise;
    assert.equal((await owner.readOrg()).orgId, '00D000000000003');
    assert.equal((await Effect.runPromise(SubscriptionRef.get(ref))).orgId, '00D000000000002');
  } else {
    const newer = owner.commitOrg({ orgId: '00D000000000003' });
    await owner.runtime.runPromise(V4Effect.yieldNow);
    assert.equal(
      (await owner.readOrg()).orgId,
      '00D000000000002',
      'the permit must remain held until V3 acknowledges the prior commit'
    );
    releaseCallback.resolve();
    await Promise.all([older, newer]);
    assert.equal((await owner.readOrg()).orgId, '00D000000000003');
    assert.equal((await Effect.runPromise(SubscriptionRef.get(ref))).orgId, '00D000000000003');
  }
  await legacy.dispose();
  await owner.dispose();
  console.log(
    unsafeInterruptibleCommits
      ? 'PASS negative control reproduces semaphore-only stale V3 overwrite'
      : 'PASS masked org commit prevents stale V3 overwrite during cancellation'
  );
};
