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
import { SoqlUtils } from './soqlUtils';

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);
const sfdxCoreExports = sfdxCoreExtension
  ? sfdxCoreExtension.exports
  : undefined;
const { OrgAuthInfo, channelService } = sfdxCoreExports;

// This should be exported from soql-builder-ui
export interface SoqlEditorEvent {
  type: string;
  message?: string;
}

// This should be shared with soql-builder-ui
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

    // Make sure we get rid of the event listeners when our editor is closed.
    webviewPanel.onDidDispose(this.dispose, this, this.subscriptions);
  }

  protected updateWebview(document: vscode.TextDocument): void {
    const uiModel = SoqlUtils.convertSoqlToUiModel(document.getText());
    this.webviewPanel.webview.postMessage({
      type: MessageType.UPDATE,
      message: JSON.stringify(uiModel)
    });
  }

  protected updateSObjects(sobjectNames: string[]): void {
    this.webviewPanel.webview.postMessage({
      type: MessageType.SOBJECTS_RESPONSE,
      message: sobjectNames
    });
  }

  protected updateSObjectMetadata(sobject: SObject): void {
    this.webviewPanel.webview.postMessage({
      type: MessageType.SOBJECT_METADATA_RESPONSE,
      message: sobject
    });
  }

  protected onDocumentChangeHandler(e: vscode.TextDocumentChangeEvent): void {
    if (e.document.uri.toString() === this.document.uri.toString()) {
      this.updateWebview(this.document);
    }
  }

  protected onDidRecieveMessageHandler(e: SoqlEditorEvent): void {
    switch (e.type) {
      case MessageType.ACTIVATED: {
        this.updateWebview(this.document);
        break;
      }
      case MessageType.QUERY: {
        const soql = SoqlUtils.convertUiModelToSoql(
          JSON.parse(e.message as string)
        );
        this.updateTextDocument(this.document, soql);
        break;
      }
      case MessageType.SOBJECT_METADATA_REQUEST: {
        this.retrieveSObject(e.message as string).catch(() => {
          channelService.appendLine(
            `An error occurred while handling a request for object metadata for the ${
              e.message
            } object.`
          );
        });
        break;
      }
      case MessageType.SOBJECTS_REQUEST: {
        this.retrieveSObjects().catch(() => {
          channelService.appendLine(
            `An error occurred while handling a request for object names.`
          );
        });
        break;
      }
      default: {
        console.log('message type is not supported');
      }
    }
  }

  protected async retrieveSObjects(): Promise<void> {
    try {
      const conn = await this.getConnection();
      const sobjectService = new SObjectService(conn);
      const sobjectNames: string[] = await sobjectService.retrieveSObjectNames();
      this.updateSObjects(sobjectNames);
    } catch (e) {
      channelService.appendLine(e);
    }
  }

  protected async retrieveSObject(sobjectName: string): Promise<void> {
    try {
      const conn = await this.getConnection();
      const sobjectService = new SObjectService(conn);
      const sobject: SObject = await sobjectService.describeSObject(
        sobjectName
      );
      this.updateSObjectMetadata(sobject);
    } catch (e) {
      channelService.appendLine(e);
    }
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
    this.subscriptions.forEach(dispposable => dispposable.dispose());
    if (this.disposedCallback) {
      this.disposedCallback(this);
    }
  }

  public onDispose(callback: (instance: SOQLEditorInstance) => void): void {
    this.disposedCallback = callback;
  }

  protected async getConnection(): Promise<Connection> {
    const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(true);
    if (!usernameOrAlias) {
      // TODO: NLS
      throw new Error(
        'No default org is set. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org" to set one.'
      );
    }
    return await OrgAuthInfo.getConnection(usernameOrAlias);
  }
}
