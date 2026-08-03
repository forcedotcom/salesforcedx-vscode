/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { getRuntime } from '../services/runtime';
import { WorkspaceContextService } from './workspaceContextService';

/**
 * Manages the context of a workspace during a session with an open SFDX Project.
 */
export class WorkspaceContext {
  protected static instance?: WorkspaceContext;
  private initializationPromise?: Promise<void>;
  private registered = false;
  private disposed = false;
  private service?: WorkspaceContextService;
  private serviceSubscription?: vscode.Disposable;
  private readonly orgChangeEmitter = new vscode.EventEmitter<{ username?: string }>();

  public readonly onOrgChange = this.orgChangeEmitter.event;

  protected constructor() {}

  public async initialize(extensionContext: vscode.ExtensionContext) {
    if (!this.registered) {
      extensionContext.subscriptions.push(this);
      this.registered = true;
    }
    if (this.initializationPromise) return this.initializationPromise;

    const initialization = this._doInitialize(extensionContext);
    this.initializationPromise = initialization;
    try {
      await initialization;
    } catch (error) {
      if (this.initializationPromise === initialization) {
        this.serviceSubscription?.dispose();
        this.serviceSubscription = undefined;
        this.initializationPromise = undefined;
      }
      throw error;
    }
  }

  private async _doInitialize(_extensionContext: vscode.ExtensionContext) {
    const runtime = getRuntime();
    const service = await runtime.runPromise(WorkspaceContextService);
    if (this.disposed) throw new Error('WorkspaceContext was disposed during initialization');
    this.service = service;
    const subscriptionFiber = runtime.runFork(
      Stream.fromPubSub(service.orgChanges).pipe(
        Stream.runForEach(event => Effect.sync(() => this.orgChangeEmitter.fire(event)))
      )
    );
    this.serviceSubscription = { dispose: () => runtime.runFork(Fiber.interrupt(subscriptionFiber)) };
    await runtime.runPromise(service.initialized);
  }

  public static getInstance(forceNew = false): WorkspaceContext {
    if (!this.instance || forceNew) {
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
    if (!this.username) throw new Error(nls.localize('error_no_target_org'));
    return getRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        return yield* api.services.ConnectionService.getConnection();
      })
    );
  }

  public dispose(): void {
    this.disposed = true;
    this.serviceSubscription?.dispose();
    this.serviceSubscription = undefined;
    this.orgChangeEmitter.dispose();
    this.service = undefined;
  }

  public get username(): string | undefined {
    return this.service?.getUsername();
  }

  public get orgId(): string | undefined {
    return this.service?.getOrgId();
  }
}
