/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Cause from 'effect/Cause';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { createLegacyServices, makeV4Host, V3DefaultOrgInfoSchema, type Connection } from '../bridgeHost/host.js';

/** Browser-safe conformance: the optional Node-injected value is a real SDK Connection. */
export const basicConformance = async (connection?: Connection) => {
  const owner = await makeV4Host(connection);
  const legacy = await createLegacyServices(owner.host);
  const { services } = legacy;
  const context = Layer.succeedContext(services.prebuiltServicesDependencies);
  const connectionExit = await Effect.runPromiseExit(
    services.ConnectionService.getConnection().pipe(Effect.provide(context))
  );
  const prebuiltExit = await Effect.runPromiseExit(
    services.ConnectionService.getConnection().pipe(Effect.provide(services.prebuiltServicesLayer))
  );
  const ref = await Effect.runPromise(services.TargetOrgRef());
  const stableRef = ref === (await Effect.runPromise(services.TargetOrgRef()));
  const first = await Effect.runPromise(ref.changes.pipe(Stream.take(1), Stream.runCollect));
  const aliases = await Effect.runPromise(
    services.AliasService.getAliasesFromUsername('fixture').pipe(Effect.provide(context))
  );
  const configured = await Effect.runPromise(services.ConfigService.getTargetOrg().pipe(Effect.provide(context)));
  const override = await Effect.runPromise(
    services.ConfigService.getTargetOrg().pipe(
      Effect.provide(
        Layer.merge(
          context,
          Layer.succeed(services.ConfigService, { getTargetOrg: () => Effect.succeed('overridden') })
        )
      )
    )
  );
  const ownerConfigured = await owner.host.getTargetOrg(new AbortController().signal);

  const fullSnapshot = {
    aliases: ['fixture-alias'],
    orgId: '00D000000000002',
    instanceName: 'CS1',
    devHubOrgId: '00D000000000007',
    username: 'fixture',
    alias: 'fixture-alias',
    devHubUsername: 'hub',
    tracksSource: true,
    isScratch: true,
    isSandbox: false,
    userId: 'legacy-string-is-accepted',
    cliId: '123e4567-e89b-12d3-a456-426614174000',
    webUserId: 'web',
    orgEdition: 'Developer'
  };
  await owner.commitOrg(fullSnapshot);
  const fullState = await Effect.runPromise(SubscriptionRef.get(ref));
  const immediate = (await Effect.runPromise(SubscriptionRef.get(ref))).orgId;
  await Effect.runPromise(
    SubscriptionRef.set(ref, Schema.decodeUnknownSync(V3DefaultOrgInfoSchema)({ orgId: '00D000000000009' }))
  );
  const ownerAfterLocalMutation = (await owner.readOrg()).orgId;
  await owner.commitOrg({ orgId: '00D000000000002' });
  const restored = (await Effect.runPromise(SubscriptionRef.get(ref))).orgId;

  const watch = () => {
    const ready = Effect.runSync(Effect.makeLatch());
    const fiber = Effect.runFork(
      ref.changes.pipe(
        Stream.map(org => org.orgId),
        Stream.tap(() => ready.open),
        Stream.take(4),
        Stream.runCollect
      )
    );
    return { ready: Effect.runPromise(ready.await), result: Effect.runPromise(Fiber.join(fiber)) };
  };
  const readers = [watch(), watch()];
  await Promise.all(readers.map(reader => reader.ready));
  await Promise.all(['00D000000000003', '00D000000000004', '00D000000000005'].map(orgId => owner.commitOrg({ orgId })));
  const updates = await Promise.all(readers.map(async reader => Chunk.toReadonlyArray(await reader.result)));
  const directIdentity = connection ? (await owner.directConnection()) === connection : undefined;
  const beforeClose = owner.stats();
  await Promise.all([legacy.dispose(), legacy.dispose()]);
  const subscribersAfterClose = owner.subscriberCount();
  const afterClose = await Effect.runPromiseExit(services.TargetOrgRef());
  await owner.dispose();

  return {
    sameConnection: connection
      ? Exit.isSuccess(connectionExit) &&
        connectionExit.value === connection &&
        Exit.isSuccess(prebuiltExit) &&
        prebuiltExit.value === connection &&
        directIdentity
      : undefined,
    failureTag: Exit.isFailure(connectionExit) ? [...Cause.failures(connectionExit.cause)][0]?._tag : undefined,
    stableRef,
    initialSnapshots: Chunk.toReadonlyArray(first).map(org => org.orgId),
    aliases,
    configured,
    override,
    ownerConfigured,
    immediate,
    fullState,
    ownerAfterLocalMutation,
    restored,
    updates,
    graphBuilds: beforeClose.graphBuilds,
    graphDisposals: owner.stats().graphDisposals,
    subscribersAfterClose,
    interruptedAfterClose: Exit.isFailure(afterClose) && Cause.isInterrupted(afterClose.cause)
  };
};
