/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { OrgShape, OrgUserInfo, refreshAllExtensionReporters, shapeFrom } from '@salesforce/salesforcedx-utils-vscode';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as MutableRef from 'effect/MutableRef';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import type { DefaultOrgInfoSchema } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';

type WorkspaceOrgIdentity = Pick<
  typeof DefaultOrgInfoSchema.Type,
  'username' | 'alias' | 'orgId' | 'isScratch' | 'isSandbox' | 'devHubOrgId' | 'orgEdition'
> & { orgShape?: OrgShape };

const sameIdentity = (previous: WorkspaceOrgIdentity, current: WorkspaceOrgIdentity): boolean =>
  previous.username === current.username && previous.alias === current.alias && previous.orgId === current.orgId;

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
    const orgChangeEmitter = new vscode.EventEmitter<OrgUserInfo>();
    const initialSnapshotReady = yield* Deferred.make<void>();
    const refreshFiber = yield* Ref.make<Fiber.RuntimeFiber<void, never> | undefined>(undefined);

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        orgChangeEmitter.dispose();
      })
    );

    const refreshReporters = Effect.fn('WorkspaceContext.refreshReporters')(function* () {
      if (extensionContext.extension.id !== 'salesforce.salesforcedx-vscode-core') return;
      const previous = yield* Ref.get(refreshFiber);
      if (previous) yield* Fiber.interrupt(previous);
      const latest = yield* Effect.tryPromise(() => Promise.resolve(refreshAllExtensionReporters(extensionContext))).pipe(
        Effect.tapErrorCause(Effect.logError),
        Effect.ignore,
        Effect.forkScoped
      );
      yield* Ref.set(refreshFiber, latest);
    });

    const watch = Effect.fn('WorkspaceContext.watch')(function* () {
      yield* targetOrgRef.changes.pipe(
        Stream.map(({ username, alias, orgId, isScratch, isSandbox, devHubOrgId, orgEdition }) => ({
          username,
          alias,
          orgId,
          isScratch,
          isSandbox,
          devHubOrgId,
          orgEdition,
          orgShape: shapeFrom({ username, alias, isScratch, isSandbox })
        })),
        Stream.tap(identity =>
          Effect.sync(() => MutableRef.set(identityRef, identity)).pipe(
            Effect.zipRight(Deferred.succeed(initialSnapshotReady, undefined)),
            Effect.withSpan('WorkspaceContext.updateTargetOrgState', {
              attributes: transitionAttributes(identity)
            })
          )
        ),
        Stream.changesWith(sameIdentity),
        Stream.drop(1),
        Stream.runForEach(identity =>
          Effect.sync(() => {
            orgChangeEmitter.fire({ username: identity.username, alias: identity.alias });
          }).pipe(
            Effect.zipRight(refreshReporters()),
            Effect.withSpan('WorkspaceContext.onTargetOrgChange', {
              attributes: transitionAttributes(identity)
            })
          )
        )
      );
    });

    yield* watch().pipe(
      Effect.onExit(exit => Deferred.done(initialSnapshotReady, exit)),
      Effect.forkScoped
    );

    return {
      identityRef,
      onOrgChange: orgChangeEmitter.event,
      initialized: Deferred.await(initialSnapshotReady)
    };
  })
}) {}
