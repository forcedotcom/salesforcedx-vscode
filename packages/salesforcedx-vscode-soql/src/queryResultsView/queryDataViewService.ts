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
import { getDocumentName } from '../commonUtils';
import {
  DATA_VIEW_MEDIA_PATH,
  QUERY_DATA_VIEW_PANEL_TITLE,
  QUERY_DATA_VIEW_SCRIPT_FILENAME,
  QUERY_DATA_VIEW_STYLE_FILENAME,
  QUERY_DATA_VIEW_TYPE,
  TABULATOR_SCRIPT_FILENAME,
  TABULATOR_STYLE_FILENAME
} from '../constants';
import { HtmlUtils } from '../editor/htmlUtils';
import { html } from './queryDataHtml';

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

  private updateWebviewWith(
    webview: vscode.Webview,
    queryData: QueryResult<JsonMap>
  ) {
    webview.postMessage({
      type: 'update',
      data: queryData,
      documentName: getDocumentName(this.document)
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
            path.join(QueryDataViewService.extensionPath, DATA_VIEW_MEDIA_PATH)
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

    const webview = this.currentPanel.webview;
    webview.html = this.getWebViewContent(webview);

    this.updateWebviewWith(webview, this.queryData);
    return webview;
  }

  private getWebViewContent(webview: vscode.Webview): string {
    let _html: string;
    const baseStyleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_MEDIA_PATH,
          QUERY_DATA_VIEW_STYLE_FILENAME
        )
      )
    );
    const tabulatorStyleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_MEDIA_PATH,
          TABULATOR_STYLE_FILENAME
        )
      )
    );
    const viewControllerUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_MEDIA_PATH,
          QUERY_DATA_VIEW_SCRIPT_FILENAME
        )
      )
    );
    const tabulatorUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_MEDIA_PATH,
          TABULATOR_SCRIPT_FILENAME
        )
      )
    );

    const staticAssets = {
      baseStyleUri,
      tabulatorStyleUri,
      viewControllerUri,
      tabulatorUri
    };

    _html = html(staticAssets);
    _html = HtmlUtils.replaceCspMetaTag(_html, webview);

    return _html;
  }
}
