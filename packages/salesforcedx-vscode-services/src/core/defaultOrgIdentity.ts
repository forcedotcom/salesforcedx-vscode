/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';

export type DefaultOrgIdentityState = {
  readonly orgId?: string;
  readonly instanceName?: string;
  readonly devHubOrgId?: string;
  readonly userId?: string;
  readonly cliId?: string;
  readonly webUserId?: string;
  readonly isScratch?: boolean;
  readonly isSandbox?: boolean;
  readonly alias?: string;
  readonly username?: string;
  readonly orgEdition?: string;
};

export type TelemetryIdentitySnapshot = Readonly<Omit<DefaultOrgIdentityState, 'instanceName'>>;

const associatedIdentities = new WeakMap<object, DefaultOrgIdentity>();

export const associateDefaultOrgIdentity = <Service extends object>(
  service: Service,
  identity: DefaultOrgIdentity
): Service => {
  associatedIdentities.set(service, identity);
  return service;
};

export const getAssociatedDefaultOrgIdentity = (service: object): DefaultOrgIdentity | undefined =>
  associatedIdentities.get(service);

export class DefaultOrgIdentity extends Effect.Service<DefaultOrgIdentity>()('DefaultOrgIdentity', {
  accessors: true,
  effect: Effect.gen(function* () {
    const ref = yield* SubscriptionRef.make<DefaultOrgIdentityState>({});
    // Synchronous capture is required by OpenTelemetry's onStart boundary.
    // eslint-disable-next-line functional/no-let
    let snapshot: Readonly<DefaultOrgIdentityState> = Object.freeze({});

    const publish = (identity: DefaultOrgIdentityState) => {
      snapshot = Object.freeze(identity);
      return SubscriptionRef.set(ref, snapshot);
    };
    const getTelemetryIdentitySnapshot = (): TelemetryIdentitySnapshot => {
      const { instanceName: _instanceName, ...identity } = snapshot;
      return Object.freeze(identity);
    };
    const set = (identity: DefaultOrgIdentityState) =>
      publish({
        ...(snapshot.cliId ? { cliId: snapshot.cliId } : {}),
        ...(snapshot.webUserId ? { webUserId: snapshot.webUserId } : {}),
        ...identity
      });
    const enrich = (orgId: string | undefined, identity: DefaultOrgIdentityState) =>
      snapshot.orgId === orgId ? publish({ ...snapshot, ...identity }) : Effect.void;
    const seed = (identity: Pick<DefaultOrgIdentityState, 'cliId' | 'webUserId'>) =>
      publish({ ...snapshot, ...identity });
    const clear = () =>
      publish({
        ...(snapshot.cliId ? { cliId: snapshot.cliId } : {}),
        ...(snapshot.webUserId ? { webUserId: snapshot.webUserId } : {})
      });

    return {
      get: SubscriptionRef.get(ref),
      changes: ref.changes,
      getTelemetryIdentitySnapshot,
      set,
      enrich,
      seed,
      clear
    };
  })
}) {}
