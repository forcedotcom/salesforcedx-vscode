/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  SOQL_BUILDER_UI_PATH,
  WEBVIEW_RESOURCE_ROOTS_PATH
} from '../constants';

export class SOQLEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext) {
    const provider = new SOQLEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      SOQLEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  private static readonly viewType = 'soqlCustom.soql';
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(
          path.join(this.context.extensionPath, WEBVIEW_RESOURCE_ROOTS_PATH)
        )
      ]
    };

    webviewPanel.webview.html = this.getWebViewContent(webviewPanel.webview);
  }

  private getWebViewContent(webview: vscode.Webview): string {
    const pathToLwcDist = path.join(
      this.context.extensionPath,
      SOQL_BUILDER_UI_PATH
    );
    const pathToHtml = path.join(pathToLwcDist, 'index.html');
    let html = fs.readFileSync(pathToHtml).toString();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(pathToLwcDist, 'app.js'))
    );
    const zeroDotScriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(pathToLwcDist, '0.app.js'))
    );
    const cspMetaTag = `<meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none';
      img-src ${webview.cspSource} https:;
      script-src ${webview.cspSource};
      style-src 'unsafe-inline' ${webview.cspSource};"
    />`;

    html = html.replace('<!-- CSP TAG -->', cspMetaTag);
    html = html.replace('./0.app.js', `${zeroDotScriptUri}`);
    html = html.replace('./app.js', `${scriptUri}`);

    return html;
  }
}
