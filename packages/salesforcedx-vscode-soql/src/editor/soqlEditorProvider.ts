/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFile } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { BUILDER_VIEW_TYPE, HTML_FILE, SOQL_BUILDER_UI_PATH } from '../constants';
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
    const soqlBuilderWebAssetsModule = getSoqlBuilderLocation(this.extensionContext);

    channelService.appendLine(
      `SOQLEditorProvider: resolveCustomTextEditor will try to load ${soqlBuilderWebAssetsModule}`
    );
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [URI.file(soqlBuilderWebAssetsModule)]
    };
    webviewPanel.webview.html = await this.getWebViewContent(webviewPanel.webview);
    const instance = new SOQLEditorInstance(document, webviewPanel, _token);
    this.instances.push(instance);
    instance.onDispose(this.disposeInstance.bind(this));
    this.extensionContext.subscriptions.push(...instance.subscriptions);

    if (!(await isDefaultOrgSet())) {
      const message = nls.localize('info_no_default_org');
      channelService.appendLine(message);
      vscode.window.showInformationMessage(message);
    }
  }

  private async getWebViewContent(webview: vscode.Webview): Promise<string> {
    const soqlBuilderWebAssetsModule = getSoqlBuilderLocation(this.extensionContext);

    const pathToHtml = path.join(soqlBuilderWebAssetsModule, HTML_FILE);
    channelService.appendLine(`SOQLEditorProvider: getWebViewContent will try to read ${pathToHtml}`);
    const htmlContent = await readFile(pathToHtml);
    return HtmlUtils.transformHtml(htmlContent, soqlBuilderWebAssetsModule, webview);
  }

  private disposeInstance(instance: SOQLEditorInstance) {
    const index = this.instances.indexOf(instance);
    if (index > -1) {
      this.instances.splice(index, 1);
    }
  }
}

const getSoqlBuilderLocation = (extensionContext: vscode.ExtensionContext): string =>
  path.join(extensionContext.extensionPath, SOQL_BUILDER_UI_PATH);
