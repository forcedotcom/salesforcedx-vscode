/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { OrgInfo } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { JsonMap } from '@salesforce/ts-types';
import { nls } from '../messages';
import { debounce } from 'debounce';
import {
  DescribeGlobalSObjectResult,
  DescribeSObjectResult,
  QueryResult
} from 'jsforce';
import * as vscode from 'vscode';
import { channelService } from '../channel';
import { trackErrorWithTelemetry } from '../commonUtils';
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
      .then(undefined, (err: string) => {
        const message = nls.localize(
          'error_unknown_error',
          'web_view_post_message'
        );
        channelService.appendLine(message);
        trackErrorWithTelemetry(type, err);
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
        const { unsupported } = e.payload as TelemetryModelJson;
        const hasUnsupported = Array.isArray(unsupported)
          ? unsupported.length
          : unsupported;
        if (hasUnsupported) {
          trackErrorWithTelemetry(
            'syntax_unsupported',
            JSON.stringify(e.payload)
          ).catch(console.error);
          const message = nls.localize('info_syntax_unsupported');
          channelService.appendLine(message);
        }
        break;
      }
      case MessageType.SOBJECT_METADATA_REQUEST: {
        this.retrieveSObject(e.payload as string);
        break;
      }
      case MessageType.SOBJECTS_REQUEST: {
        this.retrieveSObjects();
        break;
      }
      case MessageType.RUN_SOQL_QUERY: {
        this.handleRunQuery();
        break;
      }
      default: {
        const message = nls.localize('error_unknown_error', e.type);
        channelService.appendLine(message);
        trackErrorWithTelemetry('message_unknown', e.type).catch(console.error);
      }
    }
  }

  protected handleRunQuery(): Promise<void> {
    // Check to see if a default org is set.
    if (!workspaceContext.username) {
      const message = nls.localize('info_no_default_org');
      channelService.appendLine(message);
      vscode.window.showInformationMessage(message);
      return Promise.resolve();
    }

    const queryText = this.document.getText();
    return withSFConnection(async conn => {
      try {
        const queryData = await new QueryRunner(conn).runQuery(queryText);
        this.openQueryDataView(queryData);
      } catch (err) {
        const message = nls.localize('error_run_soql_query', err.toString());
        vscode.window.showErrorMessage(message);
      }
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
          const message = nls.localize('error_sobjects_request');
          channelService.appendLine(message);
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
          const message = nls.localize(
            'error_sobject_metadata_request',
            sobjectName
          );
          channelService.appendLine(message);
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
