/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import {
  OrgShape,
  OrgUserInfo,
  refreshAllExtensionReporters,
  shapeFrom
} from '@salesforce/salesforcedx-utils-vscode';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as MutableRef from 'effect/MutableRef';
import * as Runtime from 'effect/Runtime';
import * as Stream from 'effect/Stream';
import type { DefaultOrgInfoSchema } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { getRuntime } from '../services/runtime';

type WorkspaceOrgIdentity = Pick<
  typeof DefaultOrgInfoSchema.Type,
  'username' | 'alias' | 'orgId' | 'isScratch' | 'isSandbox' | 'devHubOrgId' | 'orgEdition'
> & { orgShape?: OrgShape };

const workspaceOrgIdentity = MutableRef.make<WorkspaceOrgIdentity>({});

const getConnection = Effect.fn('workspaceContext.getConnection')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.ConnectionService.getConnection();
});

const sameIdentity = (previous: WorkspaceOrgIdentity, current: WorkspaceOrgIdentity): boolean =>
  previous.username === current.username && previous.alias === current.alias && previous.orgId === current.orgId;

class WorkspaceContextService extends Effect.Service<WorkspaceContextService>()('WorkspaceContextService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const targetOrgRef = yield* api.services.TargetOrgRef();

    const watch = Effect.fn('WorkspaceContextService.watch')(function* (
      extensionContext: vscode.ExtensionContext,
      orgChangeEmitter: vscode.EventEmitter<OrgUserInfo>
    ) {
      const extensionScope = yield* getExtensionScope();
      const initialSnapshotReady = yield* Deferred.make<void>();
      const runtime = yield* Effect.runtime();

      const fiber = yield* targetOrgRef.changes.pipe(
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
          Effect.sync(() => MutableRef.set(workspaceOrgIdentity, identity)).pipe(
            Effect.zipRight(Deferred.succeed(initialSnapshotReady, undefined))
          )
        ),
        Stream.changesWith(sameIdentity),
        Stream.drop(1),
        Stream.runForEach(identity =>
          Effect.promise(async () => {
            orgChangeEmitter.fire({ username: identity.username, alias: identity.alias });
            if (extensionContext.extension.id === 'salesforce.salesforcedx-vscode-core') {
              await refreshAllExtensionReporters(extensionContext);
            }
          })
        ),
        Effect.onExit(exit => Deferred.done(initialSnapshotReady, Exit.asVoid(exit))),
        Effect.forkIn(extensionScope)
      );

      yield* Deferred.await(initialSnapshotReady);
      return () => fiber.pipe(Fiber.interrupt, Runtime.runFork(runtime));
    });

    return { watch };
  })
}) {}

/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContext {
  protected static instance?: WorkspaceContext;
  private initializationPromise?: Promise<void>;
  private stopWatcher?: () => void;
  private readonly orgChangeEmitter = new vscode.EventEmitter<OrgUserInfo>();

  public readonly onOrgChange = this.orgChangeEmitter.event;

  protected constructor() {}

  public async initialize(extensionContext: vscode.ExtensionContext) {
    this.initializationPromise ??= this._doInitialize(extensionContext);
    return this.initializationPromise;
  }

  private async _doInitialize(extensionContext: vscode.ExtensionContext) {
    extensionContext.subscriptions.push(this.orgChangeEmitter);
    this.stopWatcher = await getRuntime().runPromise(
      Effect.flatMap(WorkspaceContextService, service => service.watch(extensionContext, this.orgChangeEmitter)).pipe(
        Effect.provide(WorkspaceContextService.Default)
      )
    );
  }

  public static getInstance(forceNew = false): WorkspaceContext {
    if (!this.instance || forceNew) {
      this.instance?.dispose();
      this.instance = new WorkspaceContext();
    }
    return this.instance;
  }

  // @deprecated. Use getConnection from the Services extension.
  // maintained for backward compatibility for 2PP using vscode-core API
  public async getConnection(): Promise<Connection> {
    return getRuntime().runPromise(getConnection());
  }

  public dispose(): void {
    this.stopWatcher?.();
    this.orgChangeEmitter.dispose();
  }

  public get username(): string | undefined {
    return MutableRef.get(workspaceOrgIdentity).username;
  }

  public get alias(): string | undefined {
    return MutableRef.get(workspaceOrgIdentity).alias;
  }

  public get orgId(): string | undefined {
    return MutableRef.get(workspaceOrgIdentity).orgId;
  }

  public get orgShape(): OrgShape | undefined {
    return MutableRef.get(workspaceOrgIdentity).orgShape;
  }

  public set orgShape(orgShape: OrgShape | undefined) {
    MutableRef.update(workspaceOrgIdentity, identity => ({ ...identity, orgShape }));
  }

  public get devHubId(): string | undefined {
    return MutableRef.get(workspaceOrgIdentity).devHubOrgId;
  }

  public set devHubId(devHubOrgId: string | undefined) {
    MutableRef.update(workspaceOrgIdentity, identity => ({ ...identity, devHubOrgId }));
  }

  public get orgEdition(): string | undefined {
    return MutableRef.get(workspaceOrgIdentity).orgEdition;
  }

  public set orgEdition(orgEdition: string | undefined) {
    MutableRef.update(workspaceOrgIdentity, identity => ({ ...identity, orgEdition }));
  }
}
