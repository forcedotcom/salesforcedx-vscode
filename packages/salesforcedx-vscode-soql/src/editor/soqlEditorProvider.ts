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
  HTML_FILE,
  SOQL_BUILDER_UI_PATH,
  VIEW_TYPE,
  WEBVIEW_RESOURCE_ROOTS_PATH
} from '../constants';
import { EditorUtils } from './htmlUtils';
import { SOQLEditorInstance } from './soqlEditorInstance';

export class SOQLEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new SOQLEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      VIEW_TYPE,
      provider
    );
    return providerRegistration;
  }

  private instances: SOQLEditorInstance[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    // eslint-disable-next-line
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
    const instance = new SOQLEditorInstance(document, webviewPanel, _token);
    this.instances.push(instance);
    instance.onDispose(this.disposeInstance.bind(this));
    this.context.subscriptions.push(...instance.subscriptions);
  }
  private getWebViewContent(webview: vscode.Webview): string {
    const pathToLwcDist = path.join(
      this.context.extensionPath,
      SOQL_BUILDER_UI_PATH
    );
    const pathToHtml = path.join(pathToLwcDist, HTML_FILE);
    let html = fs.readFileSync(pathToHtml).toString();
    html = EditorUtils.transformHtml(html, pathToLwcDist, webview);
    return html;
  }
  private disposeInstance(instance: SOQLEditorInstance) {
    const found = this.instances.findIndex(storedInstance => {
      return storedInstance === instance;
    });
    if (found > -1) {
      this.instances.splice(found, 1);
    }
  }
}
