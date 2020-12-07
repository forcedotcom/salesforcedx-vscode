/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { OrgInfo } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { JsonMap } from '@salesforce/ts-types';
import { debounce } from 'debounce';
import {
  DescribeGlobalSObjectResult,
  DescribeSObjectResult,
  QueryResult
} from 'jsforce';
import * as vscode from 'vscode';
import { channelService } from '../channel';
import { showAndTrackError, trackError } from '../commonUtils';
import { QueryDataViewService as QueryDataView } from '../queryDataView/queryDataViewService';
import { TelemetryModelJson } from '../telemetry';
import { QueryRunner } from './queryRunner';

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);
const sfdxCoreExports = sfdxCoreExtension
  ? sfdxCoreExtension.exports
  : undefined;
const { workspaceContext } = sfdxCoreExports;

// TODO: This should be exported from soql-builder-ui
export interface SoqlEditorEvent {
  type: string;
  payload?: string | string[] | JsonMap;
}

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
  CONNECTION_CHANGED = 'connection_changed'
}

async function withSFConnection(f: (conn: Connection) => void): Promise<void> {
  try {
    const conn = await workspaceContext.getConnection();
    f(conn);
  } catch (e) {
    channelService.appendLine(e);
  }
}

class ConnectionChangedListener {
  protected editorInstances: SOQLEditorInstance[];
  protected static instance: ConnectionChangedListener;

  protected constructor() {
    workspaceContext.onOrgChange(async (orgInfo: OrgInfo) => {
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
    await withSFConnection(conn => {
      conn.describeGlobal$.clear();
      conn.describe$.clear();
      this.editorInstances.forEach(editor => editor.onConnectionChanged());
    });
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

  protected sendMessageToUi(
    type: string,
    payload?: string | string[] | DescribeSObjectResult
  ): void {
    this.webviewPanel.webview
      .postMessage({
        type,
        payload
      })
      .then(undefined, async (err: string) => {
        await showAndTrackError(type, err);
      });
  }

  protected updateWebview(document: vscode.TextDocument): void {
    this.sendMessageToUi(MessageType.TEXT_SOQL_CHANGED, document.getText());
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

  protected onDidRecieveMessageHandler(e: SoqlEditorEvent): void {
    switch (e.type) {
      case MessageType.UI_ACTIVATED: {
        this.updateWebview(this.document);
        break;
      }
      case MessageType.UI_SOQL_CHANGED: {
        const soql = e.payload as string;
        this.updateTextDocument(this.document, soql);
        break;
      }
      case MessageType.UI_TELEMETRY: {
        const { unsupported, errors } = e.payload as TelemetryModelJson;
        if (errors && errors.length) {
          trackError('syntax_error', JSON.stringify(e.payload)).catch(
            console.error
          );
        }
        if (unsupported && unsupported.length) {
          // no need to duplicate.  unsupported and errors often both present
          if (!errors || !errors.length) {
            trackError('syntax_unsupported', JSON.stringify(e.payload)).catch(
              console.error
            );
          }
          channelService.appendLine(
            `This syntax is not yet supported: ${unsupported.join(', ')}`
          );
        }
        break;
      }
      case MessageType.SOBJECT_METADATA_REQUEST: {
        this.retrieveSObject(e.payload as string).catch(async err => {
          await showAndTrackError(MessageType.SOBJECT_METADATA_REQUEST, err);
          channelService.appendLine(
            `An error occurred while handling a request for object metadata for the ${e.payload} object.`
          );
        });
        break;
      }
      case MessageType.SOBJECTS_REQUEST: {
        this.retrieveSObjects().catch(async err => {
          await showAndTrackError(MessageType.SOBJECTS_REQUEST, err);
          channelService.appendLine(
            `An error occurred while handling a request for object names.`
          );
        });
        break;
      }
      case MessageType.RUN_SOQL_QUERY: {
        this.handleRunQuery().catch(async err => {
          await showAndTrackError(MessageType.RUN_SOQL_QUERY, err);
          channelService.appendLine(
            `An error occurred while running the SOQL query.`
          );
        });
        break;
      }
      default: {
        const message = `message type ${e.type} is not supported`;
        channelService.appendLine(message);
        trackError('message_handler', message).catch(console.error);
      }
    }
  }

  protected handleRunQuery(): Promise<void> {
    // Check to see if a default org is set.
    if (!workspaceContext.username) {
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

  protected async retrieveSObjects(): Promise<void> {
    return withSFConnection(async conn => {
      conn.describeGlobal$((err, describeGlobalResult) => {
        if (err) {
          showAndTrackError('retrieve_sobjects', err.toString()).catch(
            console.error
          );
        }
        if (describeGlobalResult) {
          const sobjectNames: string[] = describeGlobalResult.sobjects.map(
            (sobject: DescribeGlobalSObjectResult) => sobject.name
          );
          this.updateSObjects(sobjectNames);
        }
      });
    });
  }
  protected async retrieveSObject(sobjectName: string): Promise<void> {
    return withSFConnection(async conn => {
      conn.describe$(sobjectName, (err, sobject) => {
        if (err) {
          showAndTrackError('retrieve_sobject', err.toString()).catch(
            console.error
          );
        }
        if (sobject) {
          this.updateSObjectMetadata(sobject);
        }
      });
    });
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
    this.sendMessageToUi(MessageType.CONNECTION_CHANGED);
  }
}
