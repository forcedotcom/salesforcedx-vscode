import { JsonMap } from '@salesforce/ts-types';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  DATA_VIEW_MEDIA_PATH,
  QUERY_DATA_VIEW_PANEL_TITLE,
  QUERY_DATA_VIEW_SCRIPT_FILENAME,
  QUERY_DATA_VIEW_STYLE_FILENAME,
  QUERY_DATA_VIEW_TYPE,
  TABULATOR_SCRIPT_FILENAME,
  TABULATOR_STYLE_FILENAME
} from '../constants';
import { SoqlUtils } from '../editor/soqlUtils';
import { html } from './queryDataHtml';

export class QueryDataViewService {
  public currentPanel: vscode.WebviewPanel | undefined = undefined;
  public readonly viewType = QUERY_DATA_VIEW_TYPE;
  private static extensionPath: string;

  constructor(
    private subscriptions: vscode.Disposable[],
    private queryData: JsonMap[],
    private document: vscode.TextDocument
  ) {}

  public static register(context: vscode.ExtensionContext) {
    QueryDataViewService.extensionPath = context.extensionPath;
  }

  private updateWebviewWith(webview: vscode.Webview, queryData: JsonMap[]) {
    webview.postMessage({
      type: 'update',
      data: queryData,
      documentName: SoqlUtils.getDocumentName(this.document)
    });
  }

  public createOrShowWebView() {
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
  }

  private getWebViewContent(webview: vscode.Webview): string {
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

    return html(staticAssets);
  }
}
