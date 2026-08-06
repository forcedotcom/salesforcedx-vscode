/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getServicesApi } from '@salesforce/effect-ext-utils/out/src/extensionProvider';
import type {
  GovernedEgressDispatcher as CanonicalGovernedEgressDispatcher,
  GovernedEgressSink
} from '@salesforce/vscode-services';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Stream from 'effect/Stream';

type OrgTelemetryClassification = 'gov' | 'nonGov' | 'unknown';
type OrgTelemetryPolicyState = Readonly<{
  orgId: string | undefined;
  classification: OrgTelemetryClassification;
}>;

export type { GovernedEgressSink } from '@salesforce/vscode-services';
export type GovernedEgressDispatcher<Payload> = CanonicalGovernedEgressDispatcher<Payload> &
  Readonly<{ getCurrentOrgId: Effect.Effect<string | undefined> }>;

type PolicyService = Readonly<{
  getClassification: (orgId: string) => Effect.Effect<OrgTelemetryClassification, unknown>;
  getCurrent: () => Effect.Effect<OrgTelemetryPolicyState, unknown>;
  changes: Stream.Stream<OrgTelemetryPolicyState, unknown>;
}>;

const isPolicyService = (value: unknown): value is PolicyService =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'getClassification') === 'function' &&
  typeof Reflect.get(value, 'getCurrent') === 'function' &&
  typeof Reflect.get(value, 'changes') === 'object';

export const makeTelemetryDispatcher = <Payload>(
  makeSink: Effect.Effect<GovernedEgressSink<Payload>, unknown>
): Promise<GovernedEgressDispatcher<Payload> | undefined> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* getServicesApi;
      const policyTag = api.services.OrgTelemetryPolicy;
      const makeDispatcher = api.services.makeGovernedEgressDispatcher;
      if (!policyTag || !makeDispatcher) return undefined;

      const policy = yield* policyTag.pipe(Effect.provide(api.services.prebuiltServicesDependencies));
      if (!isPolicyService(policy)) return undefined;

      const cachedSinkExit = yield* makeSink.pipe(Effect.exit, Effect.cached);
      const cachedSink = cachedSinkExit.pipe(
        Effect.flatMap(Exit.matchEffect({ onFailure: Effect.failCause, onSuccess: Effect.succeed }))
      );
      const dispatcher = yield* makeDispatcher(
        {
          getClassification: policy.getClassification,
          changes: policy.changes.pipe(Stream.catchAll(() => Stream.empty))
        },
        cachedSink
      );
      return {
        ...dispatcher,
        getCurrentOrgId: policy.getCurrent().pipe(Effect.map(current => current.orgId))
      };
    }).pipe(Effect.catchAll(() => Effect.as(Effect.void, undefined)))
  );
