/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { QueryResult } from '@jsforce/jsforce-node';
import { JsonMap } from '@salesforce/ts-types';
import * as path from 'path';
import * as vscode from 'vscode';
import { getDocumentName, trackErrorWithTelemetry } from '../commonUtils';
import {
  DATA_VIEW_ICONS_PATH,
  DATA_VIEW_RESOURCE_ROOTS_PATH,
  DATA_VIEW_UI_PATH,
  IMAGES_DIR_NAME,
  QUERY_DATA_VIEW_PANEL_TITLE,
  QUERY_DATA_VIEW_SCRIPT_FILENAME,
  QUERY_DATA_VIEW_STYLE_FILENAME,
  QUERY_DATA_VIEW_TYPE,
  SAVE_ICON_FILENAME,
  TABULATOR_SCRIPT_FILENAME,
  TABULATOR_STYLE_FILENAME
} from '../constants';
import { nls } from '../messages';
import { channelService } from '../sf';
import { FileFormat, QueryDataFileService as FileService } from './queryDataFileService';
import { extendQueryData } from './queryDataHelper';
import { getHtml } from './queryDataHtml';

export type DataViewEvent = {
  type: string;
  format?: FileFormat;
};

export class QueryDataViewService {
  public currentPanel: vscode.WebviewPanel | undefined = undefined;
  public readonly viewType = QUERY_DATA_VIEW_TYPE;
  public static extensionPath: string;
  private queryText: string;

  constructor(
    private subscriptions: vscode.Disposable[],
    private queryData: QueryResult<JsonMap>,
    private document: vscode.TextDocument
  ) {
    this.queryText = document.getText();
  }

  public static register(extensionContext: vscode.ExtensionContext): void {
    QueryDataViewService.extensionPath = extensionContext.extensionPath;
  }

  private updateWebviewWith(queryData: QueryResult<JsonMap>) {
    this.currentPanel?.webview
      .postMessage({
        type: 'update',
        data: extendQueryData(this.queryText, queryData),
        documentName: getDocumentName(this.document)
      })
      .then(undefined, async (err: string) => {
        const errorType = 'data_view_post_message';
        const message = nls.localize('error_unknown_error', errorType);
        channelService.appendLine(message);
        trackErrorWithTelemetry(errorType, err);
      });
  }

  public createOrShowWebView(): vscode.Webview {
    this.currentPanel = vscode.window.createWebviewPanel(
      this.viewType,
      QUERY_DATA_VIEW_PANEL_TITLE,
      vscode.ViewColumn.Two,
      {
        localResourceRoots: [
          vscode.Uri.file(path.join(QueryDataViewService.extensionPath, DATA_VIEW_RESOURCE_ROOTS_PATH)),
          vscode.Uri.file(path.join(QueryDataViewService.extensionPath, IMAGES_DIR_NAME))
        ],
        enableScripts: true
      }
    );

    this.currentPanel.onDidDispose(
      () => {
        this.currentPanel = undefined;
      },
      null,
      this.subscriptions
    );

    // set the tab icon for the webview
    const imagesDirPath = path.join(QueryDataViewService.extensionPath, IMAGES_DIR_NAME);
    const salesforceCloudUri = vscode.Uri.file(path.join(imagesDirPath, 'Salesforce_Cloud.png'));

    this.currentPanel.iconPath = {
      light: salesforceCloudUri,
      dark: salesforceCloudUri
    };

    this.currentPanel.webview.html = this.getWebViewContent(this.currentPanel.webview);

    this.currentPanel.webview.onDidReceiveMessage(this.onDidRecieveMessageHandler, this, this.subscriptions);

    return this.currentPanel.webview;
  }

  protected onDidRecieveMessageHandler(message: DataViewEvent): void {
    const { type, format } = message;
    switch (type) {
      case 'activate':
        this.updateWebviewWith(this.queryData);
        break;
      case 'save_records':
        this.handleSaveRecords(format);
        break;
      default:
        channelService.appendLine(nls.localize('error_unknown_error', type));
        trackErrorWithTelemetry('data_view_message_type', type).catch(console.error);
        break;
    }
  }

  protected handleSaveRecords(format: FileFormat): void {
    try {
      const fileService = new FileService(this.queryText, this.queryData, format, this.document);
      fileService.save();
    } catch (err) {
      const message = nls.localize('error_data_view_save');
      vscode.window.showErrorMessage(message);
      trackErrorWithTelemetry('data_view_save', message);
    }
  }

  protected getWebViewContent(webview: vscode.Webview): string {
    const baseStyleUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(QueryDataViewService.extensionPath, DATA_VIEW_UI_PATH, QUERY_DATA_VIEW_STYLE_FILENAME))
    );
    const tabulatorStyleUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(QueryDataViewService.extensionPath, DATA_VIEW_UI_PATH, TABULATOR_STYLE_FILENAME))
    );
    const viewControllerUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(QueryDataViewService.extensionPath, DATA_VIEW_UI_PATH, QUERY_DATA_VIEW_SCRIPT_FILENAME))
    );
    const tabulatorUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(QueryDataViewService.extensionPath, DATA_VIEW_UI_PATH, TABULATOR_SCRIPT_FILENAME))
    );
    const saveIconUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(QueryDataViewService.extensionPath, DATA_VIEW_ICONS_PATH, SAVE_ICON_FILENAME))
    );

    const staticAssets = {
      baseStyleUri,
      tabulatorStyleUri,
      viewControllerUri,
      tabulatorUri,
      saveIconUri
    };

    return getHtml(staticAssets, QueryDataViewService.extensionPath, webview);
  }
}
