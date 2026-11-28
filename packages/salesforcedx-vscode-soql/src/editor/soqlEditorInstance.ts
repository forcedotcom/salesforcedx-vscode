/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { JsonObject } from '../json';
import type { MessageType } from '../soql-builder-ui/modules/querybuilder/services/message/soqlEditorEvent';
import type { QueryResult } from '../types';
import { ExtensionProviderService, getServicesApi, getMessageFromError } from '@salesforce/effect-ext-utils';
import type { SObject } from '@salesforce/vscode-services/v2';
import debounce from 'debounce';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { executeQueryPlan } from '../commands/queryPlan';
import { SOQL_CONFIGURATION_NAME } from '../constants';
import { nls, noDefaultOrgMessage } from '../messages';
import { prepareQuery } from '../prepareQuery';
import { QueryDataViewService as QueryDataView } from '../queryDataView/queryDataViewService';
import { getSoqlRuntime } from '../services/extensionProvider';
import { isDefaultOrgSet } from '../services/org';
import { listSObjectNamesEffect } from '../services/sObjects';
import { type TelemetryModelJson } from '../telemetry';
import { type ProgressOnlyCommandKey } from '../utils/notificationMode';
import {
  invalidateMetadataRequests,
  MetadataRequestGenerationGateLive,
  runForCurrentMetadataGeneration
} from './metadataRequestGeneration';
import { runQuery } from './queryRunner';

const COMMAND: ProgressOnlyCommandKey = 'SOQL Builder Run Query';

const appendToChannel = (message: string) =>
  Effect.flatMap(getServicesApi, api =>
    api.v2.services.ChannelService.use(service => service.appendToChannel(message))
  );

const reportMessageError = (event: SoqlEditorEvent) =>
  appendToChannel(nls.localize('error_unknown_error', `message_${event.type}`)).pipe(
    Effect.tapCause(Effect.logError),
    Effect.ignore
  );

const retrieveSObject = Effect.fn('retrieveSObject')(function* (sobjectName: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const metadataDescribe = yield* api.v2.services.MetadataDescribeService;
  const transmogrifier = yield* api.v2.services.TransmogrifierService;
  return yield* metadataDescribe.describeCustomObject(sobjectName).pipe(
    Effect.flatMap(transmogrifier.toMinimalSObject),
    Effect.orElseSucceed(() => undefined)
  );
});

// TODO: This should be exported from soql-builder-ui
export type SoqlEditorEvent =
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
      payload: SObject;
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
    }
  | {
      type: 'set_default_org';
      payload: never;
    };

const runBuilderQueryEffect = Effect.fn('SOQLEditor.runBuilderQuery')(function* (
  document: vscode.TextDocument,
  maxRows: number | undefined,
  openQueryDataView: (data: QueryResult<JsonObject>) => Promise<void>,
  runQueryDone: () => Effect.Effect<void>
) {
  const isOrgSet = yield* Effect.promise(() => isDefaultOrgSet());
  if (!isOrgSet) {
    const message = noDefaultOrgMessage();
    yield* appendToChannel(message);
    yield* Effect.promise(() => vscode.window.showInformationMessage(message));
    yield* runQueryDone();
    return;
  }
  const queryText = document.getText();
  const api = yield* getServicesApi;
  const promptService = yield* api.v2.services.PromptService;
  const notificationMode = yield* api.v2.services.NotificationModeService;
  const progressLocation = yield* notificationMode.getProgressLocation(COMMAND);
  const queryData = yield* runQuery(queryText, { maxRows }).pipe(
    promptService.withProgress(nls.localize('progress_running_query'), progressLocation)
  );
  yield* Effect.promise(() => openQueryDataView(queryData));
  yield* runQueryDone();
});

export class SOQLEditorInstance {
  public subscriptions: vscode.Disposable[] = [];
  /** True for exactly one debounced cycle after the webview triggered a document edit, to avoid echoing it back. */
  protected pendingWebviewUpdate = false;

  protected disposedCallback: ((instance: SOQLEditorInstance) => void) | undefined;

  constructor(
    protected document: vscode.TextDocument,
    protected webviewPanel: vscode.WebviewPanel,
    protected _token: vscode.CancellationToken,
    incomingMessages: Queue.Queue<SoqlEditorEvent> = Effect.runSync(Queue.unbounded<SoqlEditorEvent>())
  ) {
    vscode.workspace.onDidChangeTextDocument(
      debounce((event: vscode.TextDocumentChangeEvent) => {
        this.onDocumentChangeHandler(event);
      }, 1000),
      this,
      this.subscriptions
    );

    const editorInstance = this;
    const instanceFiber = getSoqlRuntime().runFork(
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() => Queue.shutdown(incomingMessages));
        const messages = Stream.fromQueue(incomingMessages).pipe(
          Stream.mapEffect(
            event => editorInstance.handleMessageEffect(event).pipe(Effect.catchCause(() => reportMessageError(event))),
            { concurrency: 'unbounded' }
          ),
          Stream.runDrain
        );

        const connectionChanges = Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          const targetOrgRef = yield* api.v2.services.TargetOrgRef;
          yield* SubscriptionRef.changes(targetOrgRef).pipe(
            Stream.map(org => org.orgId),
            Stream.changes,
            Stream.runForEach(orgId =>
              invalidateMetadataRequests(
                editorInstance.sendMessageToUi(orgId ? 'connection_changed' : 'no_default_org')
              )
            )
          );
        });

        const metadataRequestContext = yield* Layer.build(MetadataRequestGenerationGateLive);
        yield* Effect.all([messages, connectionChanges], { concurrency: 'unbounded', discard: true }).pipe(
          Effect.provide(metadataRequestContext)
        );
      }).pipe(Effect.scoped)
    );
    this.subscriptions.push({ dispose: () => Fiber.interrupt(instanceFiber).pipe(Effect.runFork) });

    webviewPanel.onDidDispose(
      () => {
        this.dispose();
      },
      this,
      this.subscriptions
    );
  }

  protected sendMessageToUi(type: MessageType, payload?: string | string[] | SObject) {
    return Effect.promise<boolean>(() => this.webviewPanel.webview.postMessage({ type, payload })).pipe(
      Effect.asVoid,
      Effect.catchCause(cause =>
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

  protected updateSObjectMetadata(sobject: SObject) {
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
          Effect.flatMap(isOrgSet => (isOrgSet ? Effect.void : this.sendMessageToUi('no_default_org'))),
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
        return (hasUnsupported ? appendToChannel(nls.localize('info_syntax_unsupported')) : Effect.void).pipe(
          Effect.withSpan('SOQLEditor.ui_telemetry')
        );
      }

      case 'sobject_metadata_request': {
        return runForCurrentMetadataGeneration(retrieveSObject(event.payload), sobject =>
          sobject ? this.updateSObjectMetadata(sobject) : Effect.void
        ).pipe(
          Effect.catch(() => appendToChannel(nls.localize('error_sobject_metadata_request', event.payload))),
          Effect.withSpan('SOQLEditor.sobject_metadata_request', { attributes: { sobjectName: event.payload } })
        );
      }

      case 'sobjects_request': {
        return runForCurrentMetadataGeneration(listSObjectNamesEffect, names => this.updateSObjects(names)).pipe(
          Effect.catch(() => appendToChannel(nls.localize('error_sobjects_request'))),
          Effect.withSpan('SOQLEditor.sobjects_request')
        );
      }

      case 'run_query': {
        const openQueryDataView = (data: QueryResult<JsonObject>) => this.openQueryDataView(data);
        const runQueryDone = () => this.runQueryDone();
        const { document } = this;
        return Effect.promise(() =>
          getSoqlRuntime().runPromise(
            Effect.gen(function* () {
              const api = yield* (yield* ExtensionProviderService).getServicesApi;
              const maxRows = yield* (yield* api.v2.services.SettingsService).getValue<number>(
                SOQL_CONFIGURATION_NAME,
                'maxQueryLimit'
              );
              yield* runBuilderQueryEffect(document, maxRows, openQueryDataView, runQueryDone).pipe(
                Effect.catchCause(cause => {
                  const err = Cause.squash(cause);
                  const message = nls.localize('error_run_soql_query', getMessageFromError(err));
                  return appendToChannel(message).pipe(
                    Effect.tap(() =>
                      Effect.sync(() => {
                        void vscode.window.showErrorMessage(message);
                      })
                    ),
                    Effect.andThen(runQueryDone())
                  );
                })
              );
            })
          )
        ).pipe(Effect.withSpan('SOQLEditor.run_query'));
      }

      case 'get_query_plan': {
        const getQueryPlanDone = () => this.getQueryPlanDone();
        const { document } = this;
        return Effect.gen(function* () {
          const isOrgSet = yield* Effect.promise(() => isDefaultOrgSet());
          if (!isOrgSet) {
            const message = noDefaultOrgMessage();
            yield* appendToChannel(message);
            yield* Effect.promise(() => vscode.window.showInformationMessage(message));
            yield* getQueryPlanDone();
            return;
          }
          yield* Effect.promise(() =>
            getSoqlRuntime().runPromise(executeQueryPlan(prepareQuery(document.getText()).soql))
          );
          yield* getQueryPlanDone();
        }).pipe(
          Effect.catchCause(cause => {
            const err = Cause.squash(cause);
            return appendToChannel(nls.localize('error_run_soql_query', getMessageFromError(err))).pipe(
              Effect.andThen(this.getQueryPlanDone())
            );
          }),
          Effect.withSpan('SOQLEditor.get_query_plan')
        );
      }

      case 'set_default_org':
        return Effect.promise(() => vscode.commands.executeCommand('sf.set.default.org')).pipe(
          Effect.asVoid,
          Effect.withSpan('SOQLEditor.set_default_org')
        );

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

  protected async openQueryDataView(queryData: QueryResult<JsonObject>): Promise<void> {
    const webview = new QueryDataView(this.subscriptions, queryData, this.document);
    await webview.createOrShowWebView();
  }

  // eslint-disable-next-line class-methods-use-this
  protected updateTextDocument(document: vscode.TextDocument, soqlQuery: string): Thenable<boolean> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), soqlQuery);
    return vscode.workspace.applyEdit(edit);
  }

  protected dispose(): void {
    this.subscriptions.forEach(disposable => {
      disposable.dispose();
    });
    if (this.disposedCallback) {
      this.disposedCallback(this);
    }
  }

  public onDispose(callback: (instance: SOQLEditorInstance) => void): void {
    this.disposedCallback = callback;
  }
}
