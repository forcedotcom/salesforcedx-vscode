/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';
import { debounce } from 'debounce';
import { DescribeSObjectResult, QueryResult } from 'jsforce';
import * as vscode from 'vscode';
import { QueryDataViewService as QueryDataView } from '../queryDataView/queryDataViewService';
import {
  channelService,
  isDefaultOrgSet,
  onOrgChange,
  retrieveSObject,
  retrieveSObjects,
  withSFConnection
} from '../sfdx';
import { QueryRunner } from './queryRunner';

// TODO: This should be exported from soql-builder-ui
export interface SoqlEditorEvent {
  type: string;
  payload?: string | string[];
}

// TODO: This should be shared with soql-builder-ui
export enum MessageType {
  UI_ACTIVATED = 'ui_activated',
  UI_SOQL_CHANGED = 'ui_soql_changed',
  SOBJECT_METADATA_REQUEST = 'sobject_metadata_request',
  SOBJECT_METADATA_RESPONSE = 'sobject_metadata_response',
  SOBJECTS_REQUEST = 'sobjects_request',
  SOBJECTS_RESPONSE = 'sobjects_response',
  TEXT_SOQL_CHANGED = 'text_soql_changed',
  RUN_SOQL_QUERY = 'run_query',
  CONNECTION_CHANGED = 'connection_changed'
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
    this.editorInstances = this.editorInstances.filter(
      instance => instance !== editor
    );
  }

  public async connectionChanged(): Promise<void> {
    this.editorInstances.forEach(editor => editor.onConnectionChanged());
  }
}

export class SOQLEditorInstance {
  // when destroyed, dispose of all event listeners.
  public subscriptions: vscode.Disposable[] = [];

  // Notify soqlEditorProvider when destroyed
  protected disposedCallback:
    | ((instance: SOQLEditorInstance) => void)
    | undefined;

  constructor(
    protected document: vscode.TextDocument,
    protected webviewPanel: vscode.WebviewPanel,
    protected _token: vscode.CancellationToken
  ) {
    // Update the UI when the Text Document is changed, if its the same document.
    vscode.workspace.onDidChangeTextDocument(
      debounce(this.onDocumentChangeHandler, 1000),
      this,
      this.subscriptions
    );

    // Update the text document when message recieved
    webviewPanel.webview.onDidReceiveMessage(
      this.onDidRecieveMessageHandler,
      this,
      this.subscriptions
    );

    // register editor with connection changed listener
    ConnectionChangedListener.getInstance().addSoqlEditor(this);

    // Make sure we get rid of the event listeners when our editor is closed.
    webviewPanel.onDidDispose(this.dispose, this, this.subscriptions);
  }

  protected updateWebview(document: vscode.TextDocument): void {
    this.webviewPanel.webview.postMessage({
      type: MessageType.TEXT_SOQL_CHANGED,
      payload: document.getText()
    });
  }

  protected updateSObjects(sobjectNames: string[]): void {
    this.webviewPanel.webview.postMessage({
      type: MessageType.SOBJECTS_RESPONSE,
      payload: sobjectNames
    });
  }

  protected updateSObjectMetadata(
    sobject: DescribeSObjectResult | undefined
  ): void {
    this.webviewPanel.webview.postMessage({
      type: MessageType.SOBJECT_METADATA_RESPONSE,
      payload: sobject
    });
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
        this.updateTextDocument(this.document, soql);
        break;
      }
      case MessageType.SOBJECT_METADATA_REQUEST: {
        retrieveSObject(event.payload as string)
          .then(sobject => this.updateSObjectMetadata(sobject))
          .catch(e => {
            if (e.errorCode !== 'NOT_FOUND') {
              const errorMessage =
                `An error occurred while handling a request for object metadata for the ${event.payload} object.\n` +
                e.message;

              vscode.window.showInformationMessage(errorMessage);
              channelService.appendLine(errorMessage);
            }

            this.updateSObjectMetadata(undefined);
          });
        break;
      }
      case MessageType.SOBJECTS_REQUEST: {
        retrieveSObjects()
          .then(sobjectNames => this.updateSObjects(sobjectNames))
          .catch(e => {
            const errorMessage =
              `An error occurred while handling a request for object names.\n` +
              e.message;
            vscode.window.showInformationMessage(errorMessage);
            channelService.appendLine(errorMessage);

            this.updateSObjects([]);
          });
        break;
      }
      case MessageType.RUN_SOQL_QUERY: {
        this.handleRunQuery().catch(() => {
          channelService.appendLine(
            `An error occurred while running the SOQL query.`
          );
        });
        break;
      }
      default: {
        console.log('message type is not supported');
      }
    }
  }

  protected handleRunQuery(): Promise<void> {
    if (!isDefaultOrgSet()) {
      // i18n
      const message = `No default org found. Set a default org to use SOQL Builder. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org" to set one.`;
      channelService.appendLine(message);
      vscode.window.showInformationMessage(message);
      return Promise.resolve();
    }

    const queryText = this.document.getText();
    return withSFConnection(async conn => {
      const queryData = await new QueryRunner(conn).runQuery(queryText);
      this.openQueryDataView(queryData);
    });
  }

  protected openQueryDataView(queryData: QueryResult<JsonMap>): void {
    const webview = new QueryDataView(
      this.subscriptions,
      queryData,
      this.document
    );
    webview.createOrShowWebView();
  }

  // Write out the json to a given document. //
  protected updateTextDocument(
    document: vscode.TextDocument,
    soqlQuery: string
  ): Thenable<boolean> {
    const edit = new vscode.WorkspaceEdit();

    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      soqlQuery
    );

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
    this.webviewPanel.webview.postMessage({
      type: MessageType.CONNECTION_CHANGED
    });
  }
}
