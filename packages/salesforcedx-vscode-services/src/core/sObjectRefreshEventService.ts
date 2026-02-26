/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';

const SF_SOBJECT_REFRESH_COMPLETE_COMMAND = 'sf.internal.sobjectrefresh.complete';

export class SObjectRefreshEventService extends Effect.Service<SObjectRefreshEventService>()(
  'SObjectRefreshEventService',
  {
    accessors: true,
    effect: Effect.sync(() => {
      const emitter = new vscode.EventEmitter<unknown>();
      const commandDisposable = vscode.commands.registerCommand(
        SF_SOBJECT_REFRESH_COMPLETE_COMMAND,
        (event: unknown) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8b4e520b-414d-4d2f-a2b9-65dc4ee54e02',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fc3c04'},body:JSON.stringify({sessionId:'fc3c04',location:'sObjectRefreshEventService.ts:commandHandler',message:'sf.internal.sobjectrefresh.complete command fired',data:{},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          emitter.fire(event);
        }
      );

      const onRefreshComplete = (listener: (event: unknown) => unknown): vscode.Disposable =>
        emitter.event(listener);

      const dispose = (): void => {
        emitter.dispose();
        commandDisposable.dispose();
      };

      return { onRefreshComplete, dispose };
    })
  }
) {}
