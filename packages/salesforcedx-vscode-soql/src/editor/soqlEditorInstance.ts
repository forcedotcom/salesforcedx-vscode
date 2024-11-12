/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DescribeSObjectResult, QueryResult } from '@jsforce/jsforce-node';
import { Connection } from '@salesforce/core-bundle';
import { JsonMap } from '@salesforce/ts-types';
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
export type SoqlEditorEvent = {
  type: string;
  payload?: string | string[] | JsonMap;
};

// TODO: This should be shared with soql-builder-ui
export enum MessageType {
  UI_ACTIVATED = 'ui_activated',
  UI_SOQL_CHANGED = 'ui_soql_changed',
  UI_TELEMETRY = 'ui_telemetry',
  SOBJECT_METADATA_REQUEST = 'sobject_metadata_request',
  SOBJECT_METADATA_RESPONSE = 'sobject_metadata_response',
  SOBJECTS_REQUEST = 'sobjects_request',
  SOBJECTS_RESPONSE = 'sobjects_response',
  TEXT_SOQL_CHANGED = 'text_soql_changed',
  RUN_SOQL_QUERY = 'run_query',
  CONNECTION_CHANGED = 'connection_changed',
  RUN_SOQL_QUERY_DONE = 'run_query_done'
}

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

  protected sendMessageToUi(type: string, payload?: string | string[] | DescribeSObjectResult): void {
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
      this.sendMessageToUi(MessageType.TEXT_SOQL_CHANGED, newSoqlStatement);
    }
    this.lastIncomingSoqlStatement = '';
  }

  protected updateSObjects(sobjectNames: string[]): void {
    this.sendMessageToUi(MessageType.SOBJECTS_RESPONSE, sobjectNames);
  }

  protected updateSObjectMetadata(sobject: DescribeSObjectResult): void {
    this.sendMessageToUi(MessageType.SOBJECT_METADATA_RESPONSE, sobject);
  }

  protected onDocumentChangeHandler(e: vscode.TextDocumentChangeEvent): void {
    if (e.document.uri.toString() === this.document.uri.toString()) {
      this.updateWebview(this.document);
    }
  }

  protected onDidRecieveMessageHandler(event: SoqlEditorEvent): void {
    switch (event.type) {
      case MessageType.UI_ACTIVATED: {
        this.updateWebview(this.document);
        break;
      }
      case MessageType.UI_SOQL_CHANGED: {
        const soql = event.payload as string;
        this.lastIncomingSoqlStatement = soql;
        this.updateTextDocument(this.document, soql);
        break;
      }
      case MessageType.UI_TELEMETRY: {
        const { unsupported } = event.payload as TelemetryModelJson;
        const hasUnsupported = Array.isArray(unsupported) ? unsupported.length : unsupported;
        if (hasUnsupported) {
          trackErrorWithTelemetry('syntax_unsupported', JSON.stringify(event.payload)).catch(console.error);
          const message = nls.localize('info_syntax_unsupported');
          channelService.appendLine(message);
        }
        break;
      }
      case MessageType.SOBJECT_METADATA_REQUEST: {
        retrieveSObject(event.payload as string)
          .then(sobject => this.updateSObjectMetadata(sobject))
          .catch(() => {
            const message = nls.localize('error_sobject_metadata_request', event.payload);
            channelService.appendLine(message);
          });
        break;
      }
      case MessageType.SOBJECTS_REQUEST: {
        retrieveSObjects()
          .then(sobjectNames => this.updateSObjects(sobjectNames))
          .catch(() => {
            const message = nls.localize('error_sobjects_request');
            channelService.appendLine(message);
          });
        break;
      }
      case MessageType.RUN_SOQL_QUERY: {
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
    const queryData = await new QueryRunner(conn as unknown as Connection).runQuery(queryText);
    this.openQueryDataView(queryData);
    this.runQueryDone();
  }

  protected runQueryDone(): void {
    this.webviewPanel.webview.postMessage({
      type: MessageType.RUN_SOQL_QUERY_DONE
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
    this.sendMessageToUi(MessageType.CONNECTION_CHANGED);
  }
}
