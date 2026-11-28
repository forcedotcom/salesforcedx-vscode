/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import type { DefaultOrgInfoSchema } from '@salesforce/vscode-services/v2';
import * as Context from 'effect/Context';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as MutableRef from 'effect/MutableRef';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as Struct from 'effect/Struct';
import * as SubscriptionRef from 'effect/SubscriptionRef';

type OrgUserInfo = Pick<typeof DefaultOrgInfoSchema.Type, 'username' | 'alias'>;
type WorkspaceOrgIdentity = Pick<
  typeof DefaultOrgInfoSchema.Type,
  'username' | 'alias' | 'orgId' | 'isScratch' | 'isSandbox'
>;

const sameIdentity = (previous: WorkspaceOrgIdentity, current: WorkspaceOrgIdentity): boolean =>
  previous.username === current.username && previous.alias === current.alias && previous.orgId === current.orgId;

const transitionAttributes = (identity: WorkspaceOrgIdentity) => ({
  hasTargetOrg: Boolean(identity.orgId),
  isScratch: identity.isScratch ?? false,
  isSandbox: identity.isSandbox ?? false
});

const makeWorkspaceContextService = Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const targetOrgRef = yield* api.v2.services.TargetOrgRef;
  const identityRef = MutableRef.make<WorkspaceOrgIdentity>({});
  const orgChanges = yield* PubSub.sliding<OrgUserInfo>(1);
  const latch = yield* Deferred.make<void>();
  const extensionScope = yield* getExtensionScope();

  const watch = Effect.fnUntraced(function* () {
    yield* SubscriptionRef.changes(targetOrgRef).pipe(
      Stream.map(Struct.pick(['username', 'alias', 'orgId', 'isScratch', 'isSandbox'])),
      Stream.changesWith(sameIdentity),
      Stream.tap(identity => Effect.sync(() => MutableRef.set(identityRef, identity))),
      Stream.tap(() => Deferred.succeed(latch, undefined)),
      Stream.drop(1),
      Stream.runForEach(identity =>
        PubSub.publish(orgChanges, { username: identity.username, alias: identity.alias }).pipe(
          Effect.withSpan('WorkspaceContext.updateTargetOrgState', {
            attributes: transitionAttributes(identity)
          })
        )
      )
    );
  });

  yield* watch().pipe(Effect.forkIn(extensionScope, { startImmediately: true }));

  const getIdentityValue = <K extends keyof WorkspaceOrgIdentity>(key: K): WorkspaceOrgIdentity[K] =>
    MutableRef.get(identityRef)[key];

  return {
    getUsername: () => getIdentityValue('username'),
    getAlias: () => getIdentityValue('alias'),
    getOrgId: () => getIdentityValue('orgId'),
    orgChanges,
    initialized: Deferred.await(latch)
  };
});

export class WorkspaceContextService extends Context.Service<
  WorkspaceContextService,
  Effect.Success<typeof makeWorkspaceContextService>
>()('WorkspaceContextService') {
  public static readonly layer = Layer.effect(WorkspaceContextService, makeWorkspaceContextService);
}
