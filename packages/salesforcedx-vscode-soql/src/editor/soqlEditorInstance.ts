/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult, DescribeSObjectResult } from '../types';
import { Connection } from '@salesforce/core-bundle';
import type { JsonMap } from '@salesforce/ts-types';
import { debounce } from 'debounce';
import * as vscode from 'vscode';
import { trackErrorWithTelemetry } from '../commonUtils';
import { nls } from '../messages';
import { QueryDataViewService as QueryDataView } from '../queryDataView/queryDataViewService';
import {
  channelService,
  isDefaultOrgSet,
  onOrgChange,
  retrieveSObject,
  retrieveSObjects,
  workspaceContext
} from '../sf';
import { TelemetryModelJson } from '../telemetry';
import { QueryRunner } from './queryRunner';

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
export type MessageType =
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

class ConnectionChangedListener {
  protected editorInstances: SOQLEditorInstance[];
  protected static instance: ConnectionChangedListener;

  protected constructor() {
    onOrgChange(async (orgInfo: any) => {
      await this.connectionChanged();
    });

    this.editorInstances = [];
  }

  public static getInstance(): ConnectionChangedListener {
    if (!ConnectionChangedListener.instance) {
      ConnectionChangedListener.instance = new ConnectionChangedListener();
    }
    return ConnectionChangedListener.instance;
  }

  public addSoqlEditor(editor: SOQLEditorInstance): void {
    this.editorInstances.push(editor);
  }

  public removeSoqlEditor(editor: SOQLEditorInstance): void {
    this.editorInstances = this.editorInstances.filter(instance => instance !== editor);
  }

  public async connectionChanged(): Promise<void> {
    this.editorInstances.forEach(editor => editor.onConnectionChanged());
  }
}

export class SOQLEditorInstance {
  // when destroyed, dispose of all event listeners.
  public subscriptions: vscode.Disposable[] = [];
  protected lastIncomingSoqlStatement = '';

  // Notify soqlEditorProvider when destroyed
  protected disposedCallback: ((instance: SOQLEditorInstance) => void) | undefined;

  constructor(
    protected document: vscode.TextDocument,
    protected webviewPanel: vscode.WebviewPanel,
    protected _token: vscode.CancellationToken
  ) {
    // Update the UI when the Text Document is changed, if its the same document.
    vscode.workspace.onDidChangeTextDocument(debounce(this.onDocumentChangeHandler, 1000), this, this.subscriptions);

    // Update the text document when message recieved
    webviewPanel.webview.onDidReceiveMessage(this.onDidRecieveMessageHandler, this, this.subscriptions);

    // register editor with connection changed listener
    ConnectionChangedListener.getInstance().addSoqlEditor(this);

    // Make sure we get rid of the event listeners when our editor is closed.
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
    // The automated onDocumentChangeHandler fires unnecessarily
    // when we manually update the soql statement in the document
    // this introduced a 'cache once' and muffles the unnecessary postMessage
    // For more info, see section "From TextDocument to webviews"
    // url: https://code.visualstudio.com/api/extension-guides/custom-editors#synchronizing-changes-with-the-textdocument
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
          trackErrorWithTelemetry('syntax_unsupported', JSON.stringify(event.payload)).catch(console.error);
          const message = nls.localize('info_syntax_unsupported');
          channelService.appendLine(message);
        }
        break;
      }
      case 'sobject_metadata_request': {
        retrieveSObject(event.payload)
          .then(sobject => this.updateSObjectMetadata(sobject))
          .catch(() => {
            const message = nls.localize('error_sobject_metadata_request', event.payload);
            channelService.appendLine(message);
          });
        break;
      }
      case 'sobjects_request': {
        retrieveSObjects()
          .then(sobjectNames => this.updateSObjects(sobjectNames))
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
        trackErrorWithTelemetry('message_unknown', event.type).catch(console.error);
      }
    }
  }

  protected async handleRunQuery(): Promise<void> {
    // Check to see if a default org is set.
    if (!isDefaultOrgSet()) {
      const message = nls.localize('info_no_default_org');
      channelService.appendLine(message);
      vscode.window.showInformationMessage(message);
      this.runQueryDone();
      return Promise.resolve();
    }

    const queryText = this.document.getText();
    const conn = await workspaceContext.getConnection();
    const queryData = await new QueryRunner(conn).runQuery(queryText);
    this.openQueryDataView(queryData);
    this.runQueryDone();
  }

  protected runQueryDone(): void {
    this.webviewPanel.webview.postMessage({
      type: 'run_query_done' satisfies MessageType
    });
  }

  protected openQueryDataView(queryData: QueryResult<JsonMap>): void {
    const webview = new QueryDataView(this.subscriptions, queryData, this.document);
    webview.createOrShowWebView();
  }

  // Write out the json to a given document. //
  protected updateTextDocument(document: vscode.TextDocument, soqlQuery: string): Thenable<boolean> {
    const edit = new vscode.WorkspaceEdit();

    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), soqlQuery);

    return vscode.workspace.applyEdit(edit);
  }

  protected dispose(): void {
    ConnectionChangedListener.getInstance().removeSoqlEditor(this);
    this.subscriptions.forEach(dispposable => dispposable.dispose());
    if (this.disposedCallback) {
      this.disposedCallback(this);
    }
  }

  public onDispose(callback: (instance: SOQLEditorInstance) => void): void {
    this.disposedCallback = callback;
  }

  public onConnectionChanged(): void {
    this.sendMessageToUi('connection_changed');
  }
}
