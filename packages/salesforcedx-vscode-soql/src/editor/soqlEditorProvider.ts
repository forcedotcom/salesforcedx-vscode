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
  EDITOR_VIEW_TYPE,
  HTML_FILE,
  SOQL_BUILDER_UI_PATH,
  SOQL_BUILDER_WEB_ASSETS_PATH
} from '../constants';
import { channelService, isDefaultOrgSet } from '../sfdx';
import { HtmlUtils } from './htmlUtils';
import { SOQLEditorInstance } from './soqlEditorInstance';

export class SOQLEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new SOQLEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      EDITOR_VIEW_TYPE,
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
          path.join(this.context.extensionPath, SOQL_BUILDER_WEB_ASSETS_PATH)
        )
      ]
    };

    // set the html for the webview instance
    webviewPanel.webview.html = this.getWebViewContent(webviewPanel.webview);
    const instance = new SOQLEditorInstance(document, webviewPanel, _token);
    this.instances.push(instance);
    instance.onDispose(this.disposeInstance.bind(this));
    this.context.subscriptions.push(...instance.subscriptions);

    // Check to see if a default org is set.
    if (!isDefaultOrgSet()) {
      // i18n
      const message = `No default org found. Set a default org to use SOQL Builder. Run "SFDX: Create a Default Scratch Org" or "SFDX: Authorize an Org" to set one.`;
      channelService.appendLine(message);
      vscode.window.showInformationMessage(message);
    }
  }

  private getWebViewContent(webview: vscode.Webview): string {
    const pathToLwcDist = path.join(
      this.context.extensionPath,
      SOQL_BUILDER_UI_PATH
    );
    const pathToHtml = path.join(pathToLwcDist, HTML_FILE);
    let html = fs.readFileSync(pathToHtml).toString();
    html = HtmlUtils.transformHtml(html, pathToLwcDist, webview);
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
