/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';
import * as path from 'path';
import * as vscode from 'vscode';
import { getDocumentName, showAndTrackError, trackError } from '../commonUtils';
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
import {
  FileFormat,
  QueryDataFileService as FileService
} from './queryDataFileService';
import { getHtml } from './queryDataHtml';

export interface DataViewEvent {
  type: string;
  format?: FileFormat;
}

export class QueryDataViewService {
  public currentPanel: vscode.WebviewPanel | undefined = undefined;
  public readonly viewType = QUERY_DATA_VIEW_TYPE;
  public static extensionPath: string;

  constructor(
    private subscriptions: vscode.Disposable[],
    private queryData: QueryResult<JsonMap>,
    private document: vscode.TextDocument
  ) {}

  public static register(context: vscode.ExtensionContext): void {
    QueryDataViewService.extensionPath = context.extensionPath;
  }

  private updateWebviewWith(queryData: QueryResult<JsonMap>) {
    this.currentPanel?.webview
      .postMessage({
        type: 'update',
        data: queryData,
        documentName: getDocumentName(this.document)
      })
      .then(undefined, async (err: string) => {
        showAndTrackError('data_view_postmessage', err);
      });
  }

  public createOrShowWebView(): vscode.Webview {
    this.currentPanel = vscode.window.createWebviewPanel(
      this.viewType,
      QUERY_DATA_VIEW_PANEL_TITLE,
      vscode.ViewColumn.Two,
      {
        localResourceRoots: [
          vscode.Uri.file(
            path.join(
              QueryDataViewService.extensionPath,
              DATA_VIEW_RESOURCE_ROOTS_PATH
            )
          ),
          vscode.Uri.file(
            path.join(QueryDataViewService.extensionPath, IMAGES_DIR_NAME)
          )
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
    const imagesDirPath = path.join(
      QueryDataViewService.extensionPath,
      IMAGES_DIR_NAME
    );
    const salesforceCloudUri = vscode.Uri.file(
      path.join(imagesDirPath, 'Salesforce_Cloud.png')
    );

    this.currentPanel.iconPath = {
      light: salesforceCloudUri,
      dark: salesforceCloudUri
    };

    this.currentPanel.webview.html = this.getWebViewContent(
      this.currentPanel.webview
    );

    this.currentPanel.webview.onDidReceiveMessage(
      this.onDidRecieveMessageHandler,
      this,
      this.subscriptions
    );

    return this.currentPanel.webview;
  }

  protected onDidRecieveMessageHandler(message: DataViewEvent): void {
    const { type, format } = message;
    switch (type) {
      case 'activate':
        this.updateWebviewWith(this.queryData);
        break;
      case 'save_records':
        this.handleSaveRecords(format as FileFormat);
        break;
      default:
        showAndTrackError(
          'data_view_message_type',
          `Dataview unable to handle message type: ${type}`
        );
        break;
    }
  }

  protected handleSaveRecords(format: FileFormat): void {
    try {
      const fileService = new FileService(
        this.queryData,
        format,
        getDocumentName(this.document)
      );
      fileService.save();
    } catch (err) {
      trackError('data_view_save', err);
    }
  }

  protected getWebViewContent(webview: vscode.Webview): string {
    const baseStyleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_UI_PATH,
          QUERY_DATA_VIEW_STYLE_FILENAME
        )
      )
    );
    const tabulatorStyleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_UI_PATH,
          TABULATOR_STYLE_FILENAME
        )
      )
    );
    const viewControllerUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_UI_PATH,
          QUERY_DATA_VIEW_SCRIPT_FILENAME
        )
      )
    );
    const tabulatorUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_UI_PATH,
          TABULATOR_SCRIPT_FILENAME
        )
      )
    );
    const saveIconUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_ICONS_PATH,
          SAVE_ICON_FILENAME
        )
      )
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
