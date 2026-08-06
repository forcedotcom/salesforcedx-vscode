/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import { isUndefined } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  associateDefaultOrgIdentity,
  DefaultOrgIdentity,
  type DefaultOrgIdentityState
} from '../core/defaultOrgIdentity';

export type OrgTelemetryClassification = 'unknown' | 'nonGov' | 'gov';

export type OrgTelemetryPolicyState = {
  readonly orgId?: string;
  readonly classification: OrgTelemetryClassification;
};

export type OrgTelemetryPolicyService = Readonly<{
  getClassification: (orgId: string) => Effect.Effect<OrgTelemetryClassification, unknown>;
  getCurrent: () => Effect.Effect<OrgTelemetryPolicyState>;
  changes: Stream.Stream<OrgTelemetryPolicyState>;
}>;

type PolicyState = {
  readonly current: OrgTelemetryPolicyState;
  readonly classifications: Readonly<Record<string, OrgTelemetryClassification>>;
};

const unknownState: OrgTelemetryPolicyState = { classification: 'unknown' };

const classify = ({ orgId, instanceName }: DefaultOrgIdentityState): OrgTelemetryPolicyState => {
  const normalizedInstanceName = instanceName?.trim();
  return isUndefined(orgId)
    ? unknownState
    : !normalizedInstanceName
      ? { orgId, classification: 'unknown' }
      : { orgId, classification: /^usa9/i.test(normalizedInstanceName) ? 'gov' : 'nonGov' };
};

export class OrgTelemetryPolicy extends Effect.Service<OrgTelemetryPolicy>()('OrgTelemetryPolicy', {
  accessors: true,
  dependencies: [DefaultOrgIdentity.Default],
  scoped: Effect.gen(function* () {
    const identity = yield* DefaultOrgIdentity;
    const initial = classify(yield* identity.get);
    const stateRef = yield* SubscriptionRef.make<PolicyState>({
      current: initial,
      classifications: isUndefined(initial.orgId) ? {} : { [initial.orgId]: initial.classification }
    });
    const applyIdentity = (value: DefaultOrgIdentityState) =>
      SubscriptionRef.update(stateRef, state => {
        const incoming = classify(value);
        if (isUndefined(incoming.orgId)) return { ...state, current: incoming };

        const classification = state.classifications[incoming.orgId] === 'gov' ? 'gov' : incoming.classification;
        return {
          current: { orgId: incoming.orgId, classification },
          classifications: { ...state.classifications, [incoming.orgId]: classification }
        };
      });
    const refresh = identity.get.pipe(Effect.flatMap(applyIdentity));

    const observerReady = yield* Deferred.make<void>();
    yield* identity.changes.pipe(
      Stream.runForEach(value =>
        applyIdentity(value).pipe(Effect.zipRight(Deferred.succeed(observerReady, undefined)))
      ),
      Effect.forkScoped
    );
    yield* Deferred.await(observerReady);

    const getClassification = Effect.fn('OrgTelemetryPolicy.getClassification')(function* (orgId: string) {
      yield* refresh;
      const state = yield* SubscriptionRef.get(stateRef);
      return state.classifications[orgId] ?? 'unknown';
    });

    const getCurrent = Effect.fn('OrgTelemetryPolicy.getCurrent')(function* () {
      yield* refresh;
      return (yield* SubscriptionRef.get(stateRef)).current;
    });

    const changes = stateRef.changes.pipe(Stream.map(state => state.current));

    return associateDefaultOrgIdentity(
      { getClassification, getCurrent, changes } satisfies OrgTelemetryPolicyService,
      identity
    );
  })
}) {}
