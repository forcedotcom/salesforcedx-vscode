/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import { OrgUserInfo, refreshAllExtensionReporters } from '@salesforce/salesforcedx-utils-vscode';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as MutableRef from 'effect/MutableRef';
import * as Stream from 'effect/Stream';
import type { DefaultOrgInfoSchema } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { getRuntime } from '../services/runtime';

type WorkspaceOrgIdentity = Pick<typeof DefaultOrgInfoSchema.Type, 'username' | 'alias' | 'orgId'>;

const workspaceOrgIdentity = MutableRef.make<WorkspaceOrgIdentity>({});

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
  private coreExtensionContext?: vscode.ExtensionContext;
  private initializationPromise?: Promise<void>;
  private readonly orgChangeEmitter = new vscode.EventEmitter<OrgUserInfo>();

  public readonly onOrgChange = this.orgChangeEmitter.event;

  protected constructor() {}

  public async initialize(extensionContext: vscode.ExtensionContext) {
    this.initializationPromise ??= this._doInitialize(extensionContext);
    return this.initializationPromise;
  }

  private async _doInitialize(extensionContext: vscode.ExtensionContext) {
    if (extensionContext.extension.id === 'salesforce.salesforcedx-vscode-core') {
      this.coreExtensionContext = extensionContext;
    }
    extensionContext.subscriptions.push(this.orgChangeEmitter);
    await getRuntime().runPromise(this.watchTargetOrg());
  }

  public static getInstance(forceNew = false): WorkspaceContext {
    if (!this.instance || forceNew) {
      this.instance = new WorkspaceContext();
    }
    return this.instance;
  }

  // @deprecated. Use getConnection from the Services extension.
  // maintained for backward compatibility for 2PP using vscode-core API
  public async getConnection(): Promise<Connection> {
    return getRuntime().runPromise(getConnection());
  }

  private watchTargetOrg = Effect.fn('WorkspaceContext.watchTargetOrg')(function* (this: WorkspaceContext) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const targetOrgRef = yield* api.services.TargetOrgRef();
    const extensionScope = yield* getExtensionScope();
    const initialSnapshotReady = yield* Deferred.make<void>();

    yield* targetOrgRef.changes.pipe(
      Stream.map(({ username, alias, orgId }) => ({ username, alias, orgId })),
      Stream.changesWith(sameIdentity),
      Stream.tap(identity =>
        Effect.sync(() => MutableRef.set(workspaceOrgIdentity, identity)).pipe(
          Effect.zipRight(Deferred.succeed(initialSnapshotReady, undefined))
        )
      ),
      Stream.drop(1),
      Stream.runForEach(identity =>
        Effect.promise(async () => {
          this.orgChangeEmitter.fire({ username: identity.username, alias: identity.alias });
          if (this.coreExtensionContext) {
            await refreshAllExtensionReporters(this.coreExtensionContext);
          }
        })
      ),
      Effect.onExit(exit => Deferred.done(initialSnapshotReady, Exit.asVoid(exit))),
      Effect.forkIn(extensionScope)
    );

    yield* Deferred.await(initialSnapshotReady);
  });

  public get username(): string | undefined {
    return MutableRef.get(workspaceOrgIdentity).username;
  }

  public get alias(): string | undefined {
    return MutableRef.get(workspaceOrgIdentity).alias;
  }

  public get orgId(): string | undefined {
    return MutableRef.get(workspaceOrgIdentity).orgId;
  }
}
