import * as path from 'path';
import * as vscode from 'vscode';
import { html } from './queryDataHtml';

export class QueryDataViewService {
  public static currentPanel: vscode.WebviewPanel | undefined = undefined;
  public static readonly viewType = 'welcomePage';
  private static extensionPath: string;

  public static register(context: vscode.ExtensionContext) {
    QueryDataViewService.extensionPath = context.extensionPath;
  }

  public static createOrShowWebView(subscriptions: vscode.Disposable[]) {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    QueryDataViewService.currentPanel = vscode.window.createWebviewPanel(
      QueryDataViewService.viewType,
      'SOQL Query Results',
      vscode.ViewColumn.Three,
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

    const webview = QueryDataViewService.currentPanel.webview;
    webview.html = QueryDataViewService.getWebViewContent(webview);

    QueryDataViewService.currentPanel.onDidDispose(
      () => {
        this.currentPanel = undefined;
      },
      null,
      subscriptions
    );
  }

  private static getWebViewContent(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          this.extensionPath,
          'src',
          'queryResultsView',
          'media',
          'queryData.css'
        )
      )
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          this.extensionPath,
          'src',
          'queryResultsView',
          'media',
          'queryDataViewController.js'
        )
      )
    );

    return html(styleUri, scriptUri);
  }
}
