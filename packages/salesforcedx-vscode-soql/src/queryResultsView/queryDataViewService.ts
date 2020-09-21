import { JsonMap } from '@salesforce/ts-types';
import * as path from 'path';
import * as vscode from 'vscode';
import { DATA_VIEW_MEDIA_PATH } from '../constants';
import { html } from './queryDataHtml';

export class QueryDataViewService {
  public static currentPanel: vscode.WebviewPanel | undefined = undefined;
  public static readonly viewType = 'welcomePage';
  private static extensionPath: string;

  public static register(context: vscode.ExtensionContext) {
    QueryDataViewService.extensionPath = context.extensionPath;
  }

  public static createOrShowWebView(
    subscriptions: vscode.Disposable[],
    queryData: JsonMap[]
  ) {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // if (QueryDataViewService.currentPanel) {
    //   QueryDataViewService.currentPanel.reveal(columnToShowIn);
    //   return;
    // } else {
    QueryDataViewService.currentPanel = vscode.window.createWebviewPanel(
      QueryDataViewService.viewType,
      'SOQL Query Results',
      columnToShowIn || vscode.ViewColumn.Two,
      {
        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [
          vscode.Uri.file(
            path.join(this.extensionPath, 'src', 'queryResultsView', 'media')
          )
        ],
        enableScripts: true
      }
    );
    // }

    const webview = QueryDataViewService.currentPanel.webview;
    webview.html = QueryDataViewService.getWebViewContent(webview);

    function updateWebview() {
      console.log('Update Webview');
      webview.postMessage({
        type: 'update',
        text: queryData
      });
    }

    QueryDataViewService.currentPanel.onDidDispose(
      () => {
        this.currentPanel = undefined;
      },
      null,
      subscriptions
    );

    updateWebview();
  }

  private static getWebViewContent(webview: vscode.Webview): string {
    const baseStyleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.extensionPath, DATA_VIEW_MEDIA_PATH, 'queryData.css')
      )
    );
    const tabulatorStyleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.extensionPath, DATA_VIEW_MEDIA_PATH, 'tabulator.min.css')
      )
    );
    const viewControllerUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          this.extensionPath,
          DATA_VIEW_MEDIA_PATH,
          'queryDataViewController.js'
        )
      )
    );
    const tabulatorUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.extensionPath, DATA_VIEW_MEDIA_PATH, 'tabulator.min.js')
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
