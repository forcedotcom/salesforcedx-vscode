/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  OrgShape,
  OrgUserInfo,
  refreshAllExtensionReporters,
  shapeFrom
} from '@salesforce/salesforcedx-utils-vscode';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as MutableRef from 'effect/MutableRef';
import type * as Runtime from 'effect/Runtime';
import * as Stream from 'effect/Stream';
import type { DefaultOrgInfoSchema } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { getRuntime } from '../services/runtime';

type WorkspaceOrgIdentity = Pick<
  typeof DefaultOrgInfoSchema.Type,
  'username' | 'alias' | 'orgId' | 'isScratch' | 'isSandbox' | 'devHubOrgId' | 'orgEdition'
> & { orgShape?: OrgShape };

const getConnection = Effect.fn('workspaceContext.getConnection')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.ConnectionService.getConnection();
});

const sameIdentity = (previous: WorkspaceOrgIdentity, current: WorkspaceOrgIdentity): boolean =>
  previous.username === current.username && previous.alias === current.alias && previous.orgId === current.orgId;

/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContext {
  protected static instance?: WorkspaceContext;
  private initializationPromise?: Promise<void>;
  private stopWatcher?: Runtime.Cancel<unknown, unknown>;
  private readonly orgChangeEmitter = new vscode.EventEmitter<OrgUserInfo>();
  private readonly workspaceOrgIdentity = MutableRef.make<WorkspaceOrgIdentity>({});

  public readonly onOrgChange = this.orgChangeEmitter.event;

  protected constructor() {}

  public async initialize(extensionContext: vscode.ExtensionContext) {
    if (this.initializationPromise) return this.initializationPromise;

    const initialization = this._doInitialize(extensionContext);
    this.initializationPromise = initialization;
    try {
      await initialization;
    } catch (error) {
      if (this.initializationPromise === initialization) this.initializationPromise = undefined;
      throw error;
    }
  }

  private async _doInitialize(extensionContext: vscode.ExtensionContext) {
    extensionContext.subscriptions.push(this);
    const runtime = getRuntime();
    const initialSnapshotReady = Effect.runSync(Deferred.make<void, unknown>());
    const watcherExit = new Promise<void>((resolve, reject) => {
      this.stopWatcher = runtime.runCallback(this.watch(extensionContext, initialSnapshotReady), {
        onExit: Exit.match({
          onFailure: cause => reject(Cause.squash(cause)),
          onSuccess: resolve
        })
      });
    });
    await Promise.race([runtime.runPromise(Deferred.await(initialSnapshotReady)), watcherExit]);
  }

  private watch(extensionContext: vscode.ExtensionContext, initialSnapshotReady: Deferred.Deferred<void, unknown>) {
    const orgChangeEmitter = this.orgChangeEmitter;
    const workspaceOrgIdentity = this.workspaceOrgIdentity;
    return Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const targetOrgRef = yield* api.services.TargetOrgRef();
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
          }).pipe(
            Effect.withSpan('WorkspaceContext.onTargetOrgChange', {
              attributes: {
                hasTargetOrg: Boolean(identity.username ?? identity.orgId),
                isScratch: identity.isScratch ?? false,
                isSandbox: identity.isSandbox ?? false
              }
            })
          )
        )
      );
    }).pipe(Effect.onExit(exit => Deferred.done(initialSnapshotReady, Exit.asVoid(exit))));
  }

  public static getInstance(forceNew = false): WorkspaceContext {
    if (!this.instance || forceNew) {
      this.instance?.dispose();
      this.instance = new WorkspaceContext();
    }
    return this.instance;
  }

  public static disposeInstance(): void {
    this.instance?.dispose();
    this.instance = undefined;
  }

  // @deprecated. Use getConnection from the Services extension.
  // maintained for backward compatibility for 2PP using vscode-core API
  public async getConnection(): Promise<Connection> {
    return getRuntime().runPromise(getConnection());
  }

  public dispose(): void {
    this.stopWatcher?.(undefined, {
      onExit: () => undefined
    });
    this.stopWatcher = undefined;
    this.orgChangeEmitter.dispose();
  }

  public get username(): string | undefined {
    return MutableRef.get(this.workspaceOrgIdentity).username;
  }

  public get alias(): string | undefined {
    return MutableRef.get(this.workspaceOrgIdentity).alias;
  }

  public get orgId(): string | undefined {
    return MutableRef.get(this.workspaceOrgIdentity).orgId;
  }

  public get orgShape(): OrgShape | undefined {
    return MutableRef.get(this.workspaceOrgIdentity).orgShape;
  }

  public set orgShape(orgShape: OrgShape | undefined) {
    MutableRef.update(this.workspaceOrgIdentity, identity => ({ ...identity, orgShape }));
  }

  public get devHubId(): string | undefined {
    return MutableRef.get(this.workspaceOrgIdentity).devHubOrgId;
  }

  public set devHubId(devHubOrgId: string | undefined) {
    MutableRef.update(this.workspaceOrgIdentity, identity => ({ ...identity, devHubOrgId }));
  }

  public get orgEdition(): string | undefined {
    return MutableRef.get(this.workspaceOrgIdentity).orgEdition;
  }

  public set orgEdition(orgEdition: string | undefined) {
    MutableRef.update(this.workspaceOrgIdentity, identity => ({ ...identity, orgEdition }));
  }
}
