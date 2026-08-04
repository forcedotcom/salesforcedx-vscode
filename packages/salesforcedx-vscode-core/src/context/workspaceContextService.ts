/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import { type OrgUserInfo, refreshAllExtensionReporters } from '@salesforce/salesforcedx-utils-vscode';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as MutableRef from 'effect/MutableRef';
import { isNotUndefined, isUndefined } from 'effect/Predicate';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import type { DefaultOrgInfoSchema } from 'salesforcedx-vscode-services';

type WorkspaceOrgIdentity = Pick<
  typeof DefaultOrgInfoSchema.Type,
  'username' | 'alias' | 'orgId' | 'isScratch' | 'isSandbox'
>;

const sameIdentity = (previous: WorkspaceOrgIdentity, current: WorkspaceOrgIdentity): boolean =>
  previous.username === current.username && previous.alias === current.alias && previous.orgId === current.orgId;

const isInitialIdentityComplete = (identity: WorkspaceOrgIdentity): boolean =>
  (isUndefined(identity.username) && isUndefined(identity.alias) && isUndefined(identity.orgId)) ||
  (isNotUndefined(identity.username) && isNotUndefined(identity.orgId));

const transitionAttributes = (identity: WorkspaceOrgIdentity) => ({
  hasTargetOrg: Boolean(identity.username ?? identity.orgId),
  isScratch: identity.isScratch ?? false,
  isSandbox: identity.isSandbox ?? false
});

export class WorkspaceContextService extends Effect.Service<WorkspaceContextService>()('WorkspaceContextService', {
  accessors: true,
  scoped: Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const extensionContext = yield* (yield* api.services.ExtensionContextService).getContext;
    const targetOrgRef = yield* api.services.TargetOrgRef();
    const identityRef = MutableRef.make<WorkspaceOrgIdentity>({});
    const orgChanges = yield* PubSub.sliding<OrgUserInfo>(1);
    const initialIdentityReady = yield* Deferred.make<void>();
    const initializedRef = MutableRef.make(false);
    const extensionScope = yield* getExtensionScope();

    const refreshReporters = Effect.fn('WorkspaceContext.refreshReporters')(function* () {
      yield* Effect.tryPromise(() => Promise.resolve(refreshAllExtensionReporters(extensionContext))).pipe(
        Effect.tapErrorCause(Effect.logError),
        Effect.ignore
      );
    });

    const watch = Effect.fnUntraced(function* () {
      yield* targetOrgRef.changes.pipe(
        Stream.map(({ username, alias, orgId, isScratch, isSandbox }) => ({
          username,
          alias,
          orgId,
          isScratch,
          isSandbox
        })),
        Stream.changesWith(sameIdentity),
        Stream.runForEach(identity =>
          Effect.gen(function* () {
            MutableRef.set(identityRef, identity);
            if (!MutableRef.get(initializedRef)) {
              if (isInitialIdentityComplete(identity)) {
                MutableRef.set(initializedRef, true);
                yield* Deferred.succeed(initialIdentityReady, undefined);
              }
              return;
            }
            yield* PubSub.publish(orgChanges, { username: identity.username, alias: identity.alias });
            yield* refreshReporters();
          }).pipe(
            Effect.withSpan('WorkspaceContext.updateTargetOrgState', {
              attributes: transitionAttributes(identity)
            })
          )
        )
      );
    });

    yield* watch().pipe(
      Effect.onExit(exit => Deferred.done(initialIdentityReady, exit)),
      Effect.forkIn(extensionScope)
    );

    const getIdentityValue = <K extends keyof WorkspaceOrgIdentity>(key: K): WorkspaceOrgIdentity[K] =>
      MutableRef.get(identityRef)[key];

    return {
      getUsername: () => getIdentityValue('username'),
      getAlias: () => getIdentityValue('alias'),
      getOrgId: () => getIdentityValue('orgId'),
      orgChanges,
      initialized: Deferred.await(initialIdentityReady)
    };
  })
}) {}
