/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult, DescribeSObjectResult } from '../types';
import { ExtensionProviderService, getServicesApi } from '@salesforce/effect-ext-utils';
import type { JsonMap } from '@salesforce/ts-types';
import * as debounce from 'debounce';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { executeQueryPlan } from '../commands/queryPlan';
import { nls } from '../messages';
import { QueryDataViewService as QueryDataView } from '../queryDataView/queryDataViewService';
import { getSoqlRuntime } from '../services/extensionProvider';
import { getConnection, isDefaultOrgSet } from '../services/org';
import { listSObjectNamesEffect } from '../services/sObjects';
import { TelemetryModelJson } from '../telemetry';
import { runQuery } from './queryRunner';

const appendToChannel = (message: string) =>
  getServicesApi.pipe(
    Effect.flatMap(api => api.services.ChannelService),
    Effect.flatMap(svc => svc.appendToChannel(message))
  );

const retrieveSObjectRawEffect = Effect.fn('retrieveSObjectRawEffect')(function* (sobjectName: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const metadataDescribeService = yield* api.services.MetadataDescribeService;
  return yield* metadataDescribeService
    .describeCustomObject(sobjectName)
    .pipe(Effect.catchAll(() => Effect.succeed<DescribeSObjectResult | undefined>(undefined)));
});

// TODO: This should be exported from soql-builder-ui
type SoqlEditorEvent =
  | {
      type: 'ui_activated';
      payload: never;
    }
  | {
      type: 'ui_soql_changed';
      payload: string;
    }
  | {
      type: 'ui_telemetry';
      payload: TelemetryModelJson;
    }
  | {
      type: 'sobject_metadata_request';
      payload: string;
    }
  | {
      type: 'sobject_metadata_response';
      payload: DescribeSObjectResult;
    }
  | {
      type: 'sobjects_request';
      payload: never;
    }
  | {
      type: 'run_query';
      payload: never;
    }
  | {
      type: 'get_query_plan';
      payload: never;
    };

// TODO: This should be shared with soql-builder-ui
type MessageType =
  | 'ui_activated'
  | 'ui_soql_changed'
  | 'ui_telemetry'
  | 'sobject_metadata_request'
  | 'sobject_metadata_response'
  | 'sobjects_request'
  | 'sobjects_response'
  | 'text_soql_changed'
  | 'run_query'
  | 'connection_changed'
  | 'run_query_done'
  | 'no_default_org'
  | 'get_query_plan'
  | 'get_query_plan_done';

export class SOQLEditorInstance {
  public subscriptions: vscode.Disposable[] = [];
  /** True for exactly one debounced cycle after the webview triggered a document edit, to avoid echoing it back. */
  protected pendingWebviewUpdate = false;

  protected disposedCallback: ((instance: SOQLEditorInstance) => void) | undefined;

  constructor(
    protected document: vscode.TextDocument,
    protected webviewPanel: vscode.WebviewPanel,
    protected _token: vscode.CancellationToken
  ) {
    vscode.workspace.onDidChangeTextDocument(debounce(this.onDocumentChangeHandler, 1000), this, this.subscriptions);

    // Stream-based message handling: each message is dispatched concurrently as a named OTel span
    const messageFiber = getSoqlRuntime().runFork(
      Stream.async<SoqlEditorEvent>(emit => {
        const disposable = webviewPanel.webview.onDidReceiveMessage((event: SoqlEditorEvent) => {
          void emit.single(event);
        });
        return Effect.sync(() => disposable.dispose());
      }).pipe(
        Stream.mapEffect(
          event =>
            this.handleMessageEffect(event).pipe(
              Effect.catchAllCause(_cause =>
                appendToChannel(nls.localize('error_unknown_error', `message_${event.type}`))
              )
            ),
          { concurrency: 'unbounded' }
        ),
        Stream.runDrain
      )
    );
    this.subscriptions.push({ dispose: () => Effect.runFork(Fiber.interrupt(messageFiber)) });

    const { onConnectionChanged, onNoDefaultOrg } = this;
    const connectionFiber = getSoqlRuntime().runFork(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const targetOrgRef = yield* api.services.TargetOrgRef();
        yield* Stream.concat(
          Stream.make(undefined),
          targetOrgRef.changes.pipe(Stream.as(undefined))
        ).pipe(
          Stream.mapEffect(() => Effect.promise(() => isDefaultOrgSet())),
          Stream.changes,
          Stream.runForEach(isOrgSet =>
            isOrgSet ? onConnectionChanged() : onNoDefaultOrg()
          )
        );
      })
    );
    this.subscriptions.push({ dispose: () => Effect.runFork(Fiber.interrupt(connectionFiber)) });

    webviewPanel.onDidDispose(this.dispose, this, this.subscriptions);
  }

  protected sendMessageToUi(
    type: MessageType,
    payload?: string | string[] | DescribeSObjectResult
  ) {
    return Effect.promise<boolean>(
      () => this.webviewPanel.webview.postMessage({ type, payload })
    ).pipe(
      Effect.asVoid,
      Effect.catchAllCause(cause =>
        appendToChannel(nls.localize('error_unknown_error', 'web_view_post_message')).pipe(
          Effect.andThen(appendToChannel(`soql_error_${type}: ${String(Cause.squash(cause))}`))
        )
      )
    );
  }

  protected updateWebview(document: vscode.TextDocument) {
    return Effect.suspend(() => {
      if (this.pendingWebviewUpdate) {
        this.pendingWebviewUpdate = false;
        return Effect.void;
      }
      return this.sendMessageToUi('text_soql_changed', document.getText());
    });
  }

  protected updateSObjects(sobjectNames: string[]) {
    return this.sendMessageToUi('sobjects_response', sobjectNames);
  }

  protected updateSObjectMetadata(sobject: DescribeSObjectResult) {
    return this.sendMessageToUi('sobject_metadata_response', sobject);
  }

  protected onDocumentChangeHandler(e: vscode.TextDocumentChangeEvent): void {
    if (e.document.uri.toString() === this.document.uri.toString()) {
      getSoqlRuntime().runFork(this.updateWebview(this.document));
    }
  }

  private handleMessageEffect = (event: SoqlEditorEvent) => {
    switch (event.type) {
      case 'ui_activated': {
        return Effect.promise(() => isDefaultOrgSet()).pipe(
          Effect.flatMap(isOrgSet =>
            isOrgSet ? Effect.void : this.sendMessageToUi('no_default_org')
          ),
          Effect.andThen(this.updateWebview(this.document)),
          Effect.withSpan('SOQLEditor.ui_activated')
        );
      }

      case 'ui_soql_changed': {
        const soql = event.payload;
        return Effect.sync(() => {
          this.pendingWebviewUpdate = true;
        }).pipe(
          Effect.andThen(Effect.promise<boolean>(() => this.updateTextDocument(this.document, soql))),
          Effect.asVoid,
          Effect.withSpan('SOQLEditor.ui_soql_changed')
        );
      }

      case 'ui_telemetry': {
        const { unsupported } = event.payload;
        const hasUnsupported = Array.isArray(unsupported) ? unsupported.length : unsupported;
        return (
          hasUnsupported
            ? appendToChannel(nls.localize('info_syntax_unsupported'))
            : Effect.void
        ).pipe(Effect.withSpan('SOQLEditor.ui_telemetry'));
      }

      case 'sobject_metadata_request':
        return retrieveSObjectRawEffect(event.payload).pipe(
          Effect.flatMap(sobject => (sobject ? this.updateSObjectMetadata(sobject) : Effect.void)),
          Effect.catchAll(() =>
            appendToChannel(nls.localize('error_sobject_metadata_request', event.payload))
          ),
          Effect.withSpan('SOQLEditor.sobject_metadata_request', { attributes: { sobjectName: event.payload } })
        );

      case 'sobjects_request':
        return listSObjectNamesEffect.pipe(
          Effect.flatMap(names => (names ? this.updateSObjects(names) : Effect.void)),
          Effect.catchAll(() =>
            appendToChannel(nls.localize('error_sobjects_request'))
          ),
          Effect.withSpan('SOQLEditor.sobjects_request')
        );

      case 'run_query': {
        const runQueryDone = () => this.runQueryDone();
        const { document } = this;
        const openQueryDataView = (data: QueryResult<JsonMap>) => this.openQueryDataView(data);
        return Effect.gen(function* () {
          const isOrgSet = yield* Effect.promise(() => isDefaultOrgSet());
          if (!isOrgSet) {
            const message = nls.localize('info_no_default_org');
            yield* appendToChannel(message);
            yield* Effect.promise(() => vscode.window.showInformationMessage(message));
            yield* runQueryDone();
            return;
          }
          const queryText = document.getText();
          const conn = yield* Effect.promise(() => getConnection());
          const queryData = yield* Effect.promise(() =>
            vscode.window.withProgress(
              {
                cancellable: false,
                location: vscode.ProgressLocation.Notification,
                title: nls.localize('progress_running_query')
              },
              () => runQuery(conn)(queryText)
            )
          );
          yield* Effect.promise(() => openQueryDataView(queryData));
          yield* runQueryDone();
        }).pipe(
          Effect.catchAllCause(cause => {
            const err = Cause.squash(cause);
            return appendToChannel(
              nls.localize('error_run_soql_query', err instanceof Error ? err.message : String(err))
            ).pipe(Effect.andThen(this.runQueryDone()));
          }),
          Effect.withSpan('SOQLEditor.run_query')
        );
      }

      case 'get_query_plan': {
        const getQueryPlanDone = () => this.getQueryPlanDone();
        const { document } = this;
        return Effect.gen(function* () {
          const isOrgSet = yield* Effect.promise(() => isDefaultOrgSet());
          if (!isOrgSet) {
            const message = nls.localize('info_no_default_org');
            yield* appendToChannel(message);
            yield* Effect.promise(() => vscode.window.showInformationMessage(message));
            yield* getQueryPlanDone();
            return;
          }
          yield* Effect.promise(() => getSoqlRuntime().runPromise(executeQueryPlan(document.getText())));
          yield* getQueryPlanDone();
        }).pipe(
          Effect.catchAllCause(cause => {
            const err = Cause.squash(cause);
            return appendToChannel(
              nls.localize('error_run_soql_query', err instanceof Error ? err.message : String(err))
            ).pipe(Effect.andThen(this.getQueryPlanDone()));
          }),
          Effect.withSpan('SOQLEditor.get_query_plan')
        );
      }

      default:
        return appendToChannel(nls.localize('error_unknown_error', event.type)).pipe(
          Effect.withSpan('SOQLEditor.unknown_message', { attributes: { messageType: event.type } })
        );
    }
  };

  protected runQueryDone() {
    return Effect.promise<boolean>(() =>
      this.webviewPanel.webview.postMessage({ type: 'run_query_done' satisfies MessageType })
    ).pipe(Effect.asVoid);
  }

  protected getQueryPlanDone() {
    return Effect.promise<boolean>(() =>
      this.webviewPanel.webview.postMessage({ type: 'get_query_plan_done' satisfies MessageType })
    ).pipe(Effect.asVoid);
  }

  protected async openQueryDataView(queryData: QueryResult<JsonMap>): Promise<void> {
    const webview = new QueryDataView(this.subscriptions, queryData, this.document);
    await webview.createOrShowWebView();
  }

  protected updateTextDocument(document: vscode.TextDocument, soqlQuery: string): Thenable<boolean> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), soqlQuery);
    return vscode.workspace.applyEdit(edit);
  }

  protected dispose(): void {
    this.subscriptions.forEach(disposable => disposable.dispose());
    if (this.disposedCallback) {
      this.disposedCallback(this);
    }
  }

  public onDispose(callback: (instance: SOQLEditorInstance) => void): void {
    this.disposedCallback = callback;
  }

  public onConnectionChanged = () => this.sendMessageToUi('connection_changed');
  private readonly onNoDefaultOrg = () => this.sendMessageToUi('no_default_org');
}
