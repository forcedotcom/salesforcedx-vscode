/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult, DescribeSObjectResult } from '../types';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { JsonMap } from '@salesforce/ts-types';
import * as debounce from 'debounce';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { trackErrorWithTelemetry } from '../commonUtils';
import { nls } from '../messages';
import { QueryDataViewService as QueryDataView } from '../queryDataView/queryDataViewService';
import { channelService } from '../services/channel';
import { getSoqlRuntime } from '../services/extensionProvider';
import { getConnection, isDefaultOrgSet } from '../services/org';
import { listSObjectNamesEffect } from '../services/sObjects';
import { TelemetryModelJson } from '../telemetry';
import { runQuery } from './queryRunner';

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
  | 'run_query_done';

export class SOQLEditorInstance {
  public subscriptions: vscode.Disposable[] = [];
  protected lastIncomingSoqlStatement = '';

  protected disposedCallback: ((instance: SOQLEditorInstance) => void) | undefined;

  constructor(
    protected document: vscode.TextDocument,
    protected webviewPanel: vscode.WebviewPanel,
    protected _token: vscode.CancellationToken
  ) {
    vscode.workspace.onDidChangeTextDocument(debounce(this.onDocumentChangeHandler, 1000), this, this.subscriptions);

    webviewPanel.webview.onDidReceiveMessage(this.onDidRecieveMessageHandler, this, this.subscriptions);

    const { onConnectionChanged } = this;
    const fiber = getSoqlRuntime().runFork(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const targetOrgRef = yield* api.services.TargetOrgRef();
        yield* targetOrgRef.changes.pipe(
          Stream.tap(org => Effect.sync(() => console.log(`Target org changed to ${org.orgId ?? '<NOT SET>'}`))),
          Stream.map(org => org.orgId),
          Stream.changes,
          Stream.runForEach(() => Effect.sync(() => onConnectionChanged()))
        );
      })
    );
    this.subscriptions.push({ dispose: () => Effect.runFork(Fiber.interrupt(fiber)) });

    webviewPanel.onDidDispose(this.dispose, this, this.subscriptions);
  }

  protected sendMessageToUi(type: MessageType, payload?: string | string[] | DescribeSObjectResult): void {
    this.webviewPanel.webview
      .postMessage({
        type,
        payload
      })
      .then(undefined, (err: string) => {
        const message = nls.localize('error_unknown_error', 'web_view_post_message');
        channelService.appendLine(message);
        trackErrorWithTelemetry(type, err);
      });
  }

  protected updateWebview(document: vscode.TextDocument): void {
    const newSoqlStatement = document.getText();
    if (this.lastIncomingSoqlStatement !== newSoqlStatement) {
      this.sendMessageToUi('text_soql_changed', newSoqlStatement);
    }
    this.lastIncomingSoqlStatement = '';
  }

  protected updateSObjects(sobjectNames: string[]): void {
    this.sendMessageToUi('sobjects_response', sobjectNames);
  }

  protected updateSObjectMetadata(sobject: DescribeSObjectResult): void {
    this.sendMessageToUi('sobject_metadata_response', sobject);
  }

  protected onDocumentChangeHandler(e: vscode.TextDocumentChangeEvent): void {
    if (e.document.uri.toString() === this.document.uri.toString()) {
      this.updateWebview(this.document);
    }
  }

  protected onDidRecieveMessageHandler(event: SoqlEditorEvent): void {
    switch (event.type) {
      case 'ui_activated': {
        this.updateWebview(this.document);
        break;
      }
      case 'ui_soql_changed': {
        const soql = event.payload;
        this.lastIncomingSoqlStatement = soql;
        this.updateTextDocument(this.document, soql);
        break;
      }
      case 'ui_telemetry': {
        const { unsupported } = event.payload;
        const hasUnsupported = Array.isArray(unsupported) ? unsupported.length : unsupported;
        if (hasUnsupported) {
          trackErrorWithTelemetry('syntax_unsupported', JSON.stringify(event.payload));
          const message = nls.localize('info_syntax_unsupported');
          channelService.appendLine(message);
        }
        break;
      }
      case 'sobject_metadata_request': {
        getSoqlRuntime()
          .runPromise(retrieveSObjectRawEffect(event.payload))
          .then(sobject => sobject && this.updateSObjectMetadata(sobject))
          .catch(() => {
            const message = nls.localize('error_sobject_metadata_request', event.payload);
            channelService.appendLine(message);
          });
        break;
      }
      case 'sobjects_request': {
        getSoqlRuntime()
          .runPromise(listSObjectNamesEffect)
          .then(sobjectNames => sobjectNames && this.updateSObjects(sobjectNames))
          .catch(() => {
            const message = nls.localize('error_sobjects_request');
            channelService.appendLine(message);
          });
        break;
      }
      case 'run_query': {
        vscode.window
          .withProgress(
            {
              cancellable: false,
              location: vscode.ProgressLocation.Notification,
              title: nls.localize('progress_running_query')
            },
            () => this.handleRunQuery()
          )
          .then(undefined, err => {
            const message = nls.localize('error_run_soql_query', err.message);
            channelService.appendLine(message);
            this.runQueryDone();
          });
        break;
      }
      default: {
        const message = nls.localize('error_unknown_error', event.type);
        channelService.appendLine(message);
        trackErrorWithTelemetry('message_unknown', event.type);
      }
    }
  }

  protected async handleRunQuery(): Promise<void> {
    if (!(await isDefaultOrgSet())) {
      const message = nls.localize('info_no_default_org');
      channelService.appendLine(message);
      vscode.window.showInformationMessage(message);
      this.runQueryDone();
      return;
    }

    const queryText = this.document.getText();
    const conn = await getConnection();
    const queryData = await runQuery(conn)(queryText);
    await this.openQueryDataView(queryData);
    this.runQueryDone();
  }

  protected runQueryDone(): void {
    this.webviewPanel.webview.postMessage({
      type: 'run_query_done' satisfies MessageType
    });
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
    this.subscriptions.forEach(dispposable => dispposable.dispose());
    if (this.disposedCallback) {
      this.disposedCallback(this);
    }
  }

  public onDispose(callback: (instance: SOQLEditorInstance) => void): void {
    this.disposedCallback = callback;
  }

  public onConnectionChanged = (): void => {
    this.sendMessageToUi('connection_changed');
  };
}
