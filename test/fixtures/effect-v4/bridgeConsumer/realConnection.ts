/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { createCompatibleConnectionServices, makeRealConnection } from '../bridgeHost/realConnection.js';

export const realConnectionConformance = async () => {
  const fixture = await makeRealConnection();
  const api = await createCompatibleConnectionServices(() => Promise.resolve(fixture.owner));
  const legacy = api.services;
  const get = (username?: string) => Effect.runPromise(legacy.ConnectionService.getConnection(username).pipe(Effect.provide(legacy.prebuiltServicesLayer)));
  const ref = await Effect.runPromise(legacy.TargetOrgRef());
  try {
    const [v3, v4] = await Promise.all([get(), fixture.direct()]);
    const sameConnection = v3 === v4 && fixture.native(v3);
    const initial = await Effect.runPromise(SubscriptionRef.get(ref));
    const override = await get('AliasB');
    const unchangedByOverride = (await Effect.runPromise(SubscriptionRef.get(ref))).orgId === initial.orgId;
    const authoritative = await fixture.readOrg();
    await Effect.runPromise(SubscriptionRef.set(ref, { username: 'local-only' }));
    await fixture.direct();
    const localWriteRepaired = (await Effect.runPromise(SubscriptionRef.get(ref))).orgId === authoritative.orgId;
    await fixture.setTarget('AliasB');
    const switched = await fixture.direct();
    const acknowledged = await Effect.runPromise(SubscriptionRef.get(ref));
    const current = await fixture.readOrg();
    await Promise.all([api.dispose(), api.dispose()]);
    const afterShutdown = await fixture.owner.host.getConnection(undefined, new AbortController().signal);
    return { sameConnection, unchangedByOverride, localWriteRepaired, overrideNative: fixture.native(override),
      switchedNative: fixture.native(switched), mirrorsMatch: acknowledged.orgId === current.orgId,
      username: current.username, afterShutdown: afterShutdown._tag };
  } finally {
    await api.dispose();
    fixture.restoreRequest();
  }
};
