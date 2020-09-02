/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { SObject, SObjectService } from '@salesforce/sobject-metadata';
import { debounce } from 'debounce';
import * as vscode from 'vscode';

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);
const sfdxCoreExports = sfdxCoreExtension
  ? sfdxCoreExtension.exports
  : undefined;
const { OrgAuthInfo } = sfdxCoreExports;

interface SoqlEditorEvent {
  type: string;
  message: string;
}

export enum MessageType {
  ACTIVATED = 'activated',
  QUERY = 'query',
  SOBJECT_METADATA_REQUEST = 'sobject_metadata_request',
  SOBJECT_METADATA_RESPONSE = 'sobject_metadata_response',
  SOBJECTS_REQUEST = 'sobjects_request',
  SOBJECTS_RESPONSE = 'sobjects_response',
  UPDATE = 'update'
}

export class SOQLEditorInstance {
  // handlers assigned in constructor
  private updateWebview: () => void;
  private onDidRecieveMessageHandler: (e: SoqlEditorEvent) => void;
  private onTextDocumentChangeHandler: (
    e: vscode.TextDocumentChangeEvent
  ) => void;
  private updateSObjects: (sobjectNames: string[]) => void;
  private updateSObjectMetadata: (sobject: SObject) => void;

  // when destroyed, dispose of all event listeners.
  public subscriptions: vscode.Disposable[] = [];

  // Notify soqlEditorProvider when destroyed
  private disposedCallback:
    | ((instance: SOQLEditorInstance) => void)
    | undefined;

  constructor(
    private document: vscode.TextDocument,
    private webviewPanel: vscode.WebviewPanel,
    private _token: vscode.CancellationToken
  ) {
    this.updateWebview = this.createWebviewUpdater(
      webviewPanel.webview,
      document
    );
    this.onDidRecieveMessageHandler = this.createOnDidRecieveMessageHandler(
      document
    );
    this.onTextDocumentChangeHandler = debounce(
      this.createDocumentChangeHandler(document),
      1000
    );
    this.updateSObjects = this.createSObjectsUpdater(webviewPanel.webview);
    this.updateSObjectMetadata = this.createSObjectMetadataUpdater(
      webviewPanel.webview
    );

    // Update the UI when the Text Document is changed, if its the same document.
    vscode.workspace.onDidChangeTextDocument(
      this.onTextDocumentChangeHandler,
      this,
      this.subscriptions
    );

    // Update the text document when message recieved
    webviewPanel.webview.onDidReceiveMessage(
      this.onDidRecieveMessageHandler,
      this,
      this.subscriptions
    );

    // Make sure we get rid of the event listeners when our editor is closed.
    webviewPanel.onDidDispose(this.dispose, this, this.subscriptions);
  }

  private createWebviewUpdater(
    webview: vscode.Webview,
    document: vscode.TextDocument
  ) {
    return function updateWebview() {
      webview.postMessage({
        type: MessageType.UPDATE,
        message: document.getText()
      });
    };
  }

  private createSObjectsUpdater(
    webview: vscode.Webview
  ): (sobjectNames: string[]) => void {
    return (sobjectNames: string[]) => {
      webview.postMessage({
        type: MessageType.SOBJECTS_RESPONSE,
        message: sobjectNames
      });
    };
  }

  private createSObjectMetadataUpdater(
    webview: vscode.Webview
  ): (sobject: SObject) => void {
    return (sobject: SObject) => {
      webview.postMessage({
        type: MessageType.SOBJECT_METADATA_RESPONSE,
        message: sobject
      });
    };
  }

  private createDocumentChangeHandler(document: vscode.TextDocument) {
    return (e: vscode.TextDocumentChangeEvent) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.updateWebview();
      }
    };
  }

  private createOnDidRecieveMessageHandler(document: vscode.TextDocument) {
    return (e: SoqlEditorEvent) => {
      switch (e.type) {
        case MessageType.ACTIVATED: {
          this.updateWebview();
          break;
        }
        case MessageType.QUERY: {
          this.updateTextDocument(document, e.message);
          break;
        }
        case MessageType.SOBJECT_METADATA_REQUEST: {
          this.retrieveSObject(e.message).catch(() => {
            // TODO: telemetry
          });
          break;
        }
        case MessageType.SOBJECTS_REQUEST: {
          this.retrieveSObjects().catch(() => {
            // TODO: telemetry
          });
          break;
        }
        default: {
          console.log('message type is not supported');
        }
      }
    };
  }

  private async retrieveSObjects(): Promise<void> {
    const conn = await this.getConnection();
    if (!conn) {
      // TODO: NLS
      throw Error('!!! error no connection !!!');
    }
    const sobjectService = new SObjectService(conn);
    const sobjectNames: string[] = await sobjectService.retrieveSObjectNames();
    this.updateSObjects(sobjectNames);
  }

  private async retrieveSObject(sobjectName: string): Promise<void> {
    const conn = await this.getConnection();
    if (!conn) {
      // TODO: NLS
      throw Error('!!! error no connection !!!');
    }
    const sobjectService = new SObjectService(conn);
    const sobject: SObject = await sobjectService.describeSObject(sobjectName);
    this.updateSObjectMetadata(sobject);
  }

  // Write out the json to a given document. //
  private updateTextDocument(document: vscode.TextDocument, message: string) {
    const edit = new vscode.WorkspaceEdit();

    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      // NOTE: Instead we would convert the UImodel JSON into a Query String before applyEdit
      message
    );

    return vscode.workspace.applyEdit(edit);
  }

  private dispose() {
    this.subscriptions.forEach(dispposable => dispposable.dispose());
    if (this.disposedCallback) {
      this.disposedCallback(this);
    }
  }

  public onDispose(callback: (instance: SOQLEditorInstance) => void): void {
    this.disposedCallback = callback;
  }

  private async getConnection(): Promise<Connection> {
    const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(true);
    if (!usernameOrAlias) {
      // TODO: NLS
      throw new Error('!!! error_no_default_username !!!');
    }
    return await OrgAuthInfo.getConnection(usernameOrAlias);
  }
}
