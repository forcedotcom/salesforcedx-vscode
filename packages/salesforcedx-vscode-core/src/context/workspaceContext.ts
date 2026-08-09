/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { getRuntime } from '../services/runtime';
import { WorkspaceContextService } from './workspaceContextService';

const createWorkspaceContextAdapter = () => {
  const orgChangeEmitter = new vscode.EventEmitter<{ username?: string; alias?: string }>();
  let initializationPromise: Promise<void> | undefined;
  let service: WorkspaceContextService | undefined;

  const initialize = async () => {
    if (initializationPromise) return initializationPromise;

    const initialization = getRuntime().runPromise(
      Effect.gen(function* () {
        const workspaceContextService = yield* WorkspaceContextService;
        const extensionScope = yield* getExtensionScope();
        yield* Stream.fromPubSub(workspaceContextService.orgChanges).pipe(
          Stream.runForEach(event => Effect.sync(() => orgChangeEmitter.fire(event))),
          Effect.forkIn(extensionScope)
        );
        yield* workspaceContextService.initialized;
        service = workspaceContextService;
      })
    );
    initializationPromise = initialization;
    try {
      await initialization;
    } catch (error) {
      if (initializationPromise === initialization) initializationPromise = undefined;
      throw error;
    }
  };

  return {
    initialize,
    onOrgChange: orgChangeEmitter.event,
    getUsername: () => service?.getUsername(),
    getAlias: () => service?.getAlias(),
    getOrgId: () => service?.getOrgId(),
    dispose: () => {
      orgChangeEmitter.dispose();
      service = undefined;
    }
  };
};

/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContext {
  protected static instance?: WorkspaceContext;
  private readonly adapter = createWorkspaceContextAdapter();
  public readonly onOrgChange = this.adapter.onOrgChange;

  protected constructor() {}

  public async initialize(_extensionContext: vscode.ExtensionContext) {
    return this.adapter.initialize();
  }

  public static getInstance(): WorkspaceContext;
  /** @deprecated The forceNew parameter is ignored. Call getInstance() without an argument. */
  // eslint-disable-next-line @typescript-eslint/unified-signatures -- isolates deprecation to argument-bearing calls
  public static getInstance(forceNew: boolean): WorkspaceContext;
  public static getInstance(_forceNew = false): WorkspaceContext {
    return (this.instance ??= new WorkspaceContext());
  }

  public static disposeInstance(): void {
    this.instance?.adapter.dispose();
    this.instance = undefined;
  }

  // @deprecated. Use getConnection from the Services extension.
  // maintained for backward compatibility for 2PP using vscode-core API
  public async getConnection(): Promise<Connection> {
    return getRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        return yield* api.services.ConnectionService.getConnection();
      })
    );
  }

  public get username(): string | undefined {
    return this.adapter.getUsername();
  }

  public get alias(): string | undefined {
    return this.adapter.getAlias();
  }

  public get orgId(): string | undefined {
    return this.adapter.getOrgId();
  }
}
