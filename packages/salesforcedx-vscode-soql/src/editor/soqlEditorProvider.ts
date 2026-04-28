/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { BUILDER_VIEW_TYPE, HTML_FILE, SOQL_BUILDER_UI_PATH } from '../constants';
import { nls } from '../messages';
import { getSoqlRuntime } from '../services/extensionProvider';
import { isDefaultOrgSet } from '../services/org';
import { transformHtml } from './htmlUtils';
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
    const soqlBuilderUri = getSoqlBuilderLocation(this.extensionContext);

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [soqlBuilderUri]
    };
    webviewPanel.webview.html = await this.getWebViewContent(webviewPanel.webview);
    const instance = new SOQLEditorInstance(document, webviewPanel, _token, this.extensionContext);
    this.instances.push(instance);
    instance.onDispose(this.disposeInstance.bind(this));
    this.extensionContext.subscriptions.push(...instance.subscriptions);

    if (!(await isDefaultOrgSet())) {
      const message = nls.localize('info_no_default_org');
      getSoqlRuntime().runFork(
        getServicesApi.pipe(
          Effect.flatMap(api => api.services.ChannelService),
          Effect.flatMap(svc => svc.appendToChannel(message))
        )
      );
      vscode.window.showInformationMessage(message);
    }
  }

  private async getWebViewContent(webview: vscode.Webview): Promise<string> {
    const soqlBuilderUri = getSoqlBuilderLocation(this.extensionContext);
    const htmlContent = await getSoqlRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* getServicesApi;
        return yield* api.services.FsService.readFile(Utils.joinPath(soqlBuilderUri, HTML_FILE));
      })
    );
    return transformHtml(htmlContent, soqlBuilderUri, webview);
  }

  private disposeInstance(instance: SOQLEditorInstance) {
    const index = this.instances.indexOf(instance);
    if (index > -1) {
      this.instances.splice(index, 1);
    }
  }
}

const getSoqlBuilderLocation = (extensionContext: vscode.ExtensionContext): URI =>
  Utils.joinPath(extensionContext.extensionUri, ...SOQL_BUILDER_UI_PATH);
