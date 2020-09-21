import { JsonMap } from '@salesforce/ts-types';
import * as path from 'path';
import * as vscode from 'vscode';
import { DATA_VIEW_MEDIA_PATH } from '../constants';
import { SoqlUtils } from '../editor/soqlUtils';
import { html } from './queryDataHtml';

export class QueryDataViewService {
  public currentPanel: vscode.WebviewPanel | undefined = undefined;
  public readonly viewType = 'welcomePage';
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
      'SOQL Query Results',
      vscode.ViewColumn.Two,
      {
        localResourceRoots: [
          vscode.Uri.file(
            path.join(
              // TODO: constants
              QueryDataViewService.extensionPath,
              'src',
              'queryResultsView',
              'media'
            )
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
          'queryData.css'
        )
      )
    );
    const tabulatorStyleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_MEDIA_PATH,
          'tabulator.min.css'
        )
      )
    );
    const viewControllerUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_MEDIA_PATH,
          'queryDataViewController.js'
        )
      )
    );
    const tabulatorUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          QueryDataViewService.extensionPath,
          DATA_VIEW_MEDIA_PATH,
          'tabulator.min.js'
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
