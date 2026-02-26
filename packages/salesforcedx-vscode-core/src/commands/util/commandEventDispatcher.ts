/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

const SERVICES_EXTENSION_ID = 'salesforce.salesforcedx-vscode-services';

type SubscribeFn = (listener: (event: unknown) => unknown) => vscode.Disposable;

const getServicesSubscribeFn = (): SubscribeFn | undefined => {
  type ServicesApi = { services: { subscribeToSObjectRefresh: SubscribeFn } };
  return vscode.extensions.getExtension<ServicesApi>(SERVICES_EXTENSION_ID)?.exports?.services
    ?.subscribeToSObjectRefresh;
};

/**
 * @deprecated SObject refresh events are now owned by SObjectRefreshEventService in salesforcedx-vscode-services.
 * This class is retained for backward compatibility with external consumers (e.g. Einstein GPT).
 */
export class CommandEventDispatcher implements vscode.Disposable {
  protected static instance: CommandEventDispatcher;

  private readonly emitter = new vscode.EventEmitter<unknown>();
  private serviceSubscription: vscode.Disposable | undefined;

  private constructor() {
    // Subscribe to SObjectRefreshEventService at construction time (during getInstance(), when
    // services is guaranteed to be active). Forward events to our local emitter so that
    // onRefreshSObjectsCommandCompletion subscribers don't need a dynamic extension lookup.
    const subscribe = getServicesSubscribeFn();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8b4e520b-414d-4d2f-a2b9-65dc4ee54e02',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fc3c04'},body:JSON.stringify({sessionId:'fc3c04',location:'commandEventDispatcher.ts:constructor',message:'constructor - subscribeToSObjectRefresh lookup',data:{found:!!subscribe},timestamp:Date.now(),hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    if (subscribe) {
      this.serviceSubscription = subscribe((event) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8b4e520b-414d-4d2f-a2b9-65dc4ee54e02',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fc3c04'},body:JSON.stringify({sessionId:'fc3c04',location:'commandEventDispatcher.ts:serviceSubscriptionCallback',message:'serviceSubscription callback fired - forwarding to local emitter',timestamp:Date.now(),hypothesisId:'B',runId:'post-fix'})}).catch(()=>{});
        // #endregion
        this.emitter.fire(event);
      });
    }
  }

  public static getInstance(): CommandEventDispatcher {
    if (!CommandEventDispatcher.instance) {
      CommandEventDispatcher.instance = new CommandEventDispatcher();
    }
    return CommandEventDispatcher.instance;
  }

  public onRefreshSObjectsCommandCompletion(listener: (event: unknown) => unknown): vscode.Disposable {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8b4e520b-414d-4d2f-a2b9-65dc4ee54e02',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fc3c04'},body:JSON.stringify({sessionId:'fc3c04',location:'commandEventDispatcher.ts:onRefreshSObjectsCommandCompletion',message:'listener registered on local emitter',timestamp:Date.now(),hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    return this.emitter.event(listener);
  }

  public dispose(): void {
    this.emitter.dispose();
    this.serviceSubscription?.dispose();
  }
}
