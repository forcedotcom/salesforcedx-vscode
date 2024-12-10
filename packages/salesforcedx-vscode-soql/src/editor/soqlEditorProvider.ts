/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BUILDER_VIEW_TYPE, DIST_FOLDER, HTML_FILE } from '../constants';
import { nls } from '../messages';
import { channelService, isDefaultOrgSet } from '../sf';
import { HtmlUtils } from './htmlUtils';
import { SOQLEditorInstance } from './soqlEditorInstance';

export class SOQLEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(extensionContext: vscode.ExtensionContext): vscode.Disposable {
    const provider = new SOQLEditorProvider(extensionContext);
    const providerRegistration = vscode.window.registerCustomEditorProvider(BUILDER_VIEW_TYPE, provider);
    return providerRegistration;
  }

  private instances: SOQLEditorInstance[] = [];

  constructor(private readonly extensionContext: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,

    _token: vscode.CancellationToken
  ): Promise<void> {
    const soqlBuilderWebAssetsPathParam: string[] =
      this.extensionContext.extension.packageJSON.soqlBuilderWebAssetsPath;
    const soqlBuilderWebAssetsModule = this.extensionContext.asAbsolutePath(
      path.join(...soqlBuilderWebAssetsPathParam)
    );
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(soqlBuilderWebAssetsModule)]
    };
    webviewPanel.webview.html = this.getWebViewContent(webviewPanel.webview);
    const instance = new SOQLEditorInstance(document, webviewPanel, _token);
    this.instances.push(instance);
    instance.onDispose(this.disposeInstance.bind(this));
    this.extensionContext.subscriptions.push(...instance.subscriptions);

    if (!isDefaultOrgSet()) {
      const message = nls.localize('info_no_default_org');
      channelService.appendLine(message);
      vscode.window.showInformationMessage(message);
    }
  }

  private getWebViewContent(webview: vscode.Webview): string {
    const soqlBuilderWebAssetsPathParam: string[] =
      this.extensionContext.extension.packageJSON.soqlBuilderWebAssetsPath;
    const soqlBuilderUIModule = this.extensionContext.asAbsolutePath(
      path.join(...soqlBuilderWebAssetsPathParam, DIST_FOLDER)
    );
    const pathToHtml = path.join(soqlBuilderUIModule, HTML_FILE);
    let html = fs.readFileSync(pathToHtml).toString();
    html = HtmlUtils.transformHtml(html, soqlBuilderUIModule, webview);
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
