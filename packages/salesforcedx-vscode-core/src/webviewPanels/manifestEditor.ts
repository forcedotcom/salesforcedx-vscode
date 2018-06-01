/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../src/messages';

const PUBLIC_URL_PLACEHOLDER = '__salesforcedx-vscode-core-prefix__';

export class ManifestEditor {
  private static readonly viewTitle = nls.localize(
    'manifest_editor_title_message'
  );
  private static readonly viewType = 'manifestEditor.type';
  private static currentPanel: ManifestEditor | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionContext: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionContext: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ManifestEditor.currentPanel) {
      ManifestEditor.currentPanel.panel.reveal(column);
    } else {
      ManifestEditor.currentPanel = new ManifestEditor(
        extensionContext,
        column || vscode.ViewColumn.One
      );
    }
  }

  private constructor(
    extensionContext: vscode.ExtensionContext,
    column: vscode.ViewColumn
  ) {
    this.extensionContext = extensionContext;

    this.panel = vscode.window.createWebviewPanel(
      ManifestEditor.viewType,
      ManifestEditor.viewTitle,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(
            path.join(this.extensionContext.extensionPath, 'webviews')
          )
        ]
      }
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.onDidChangeViewState(
      event => {
        if (this.panel.visible) {
          void this.update();
        }
      },
      null,
      this.disposables
    );

    void this.show();
  }

  public dispose() {
    ManifestEditor.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private async update() {
    void this.show();
  }

  private async show() {
    this.panel.webview.html = await this.getNormalizedResourceContents(
      'webviews/ManifestEditor/index.html'
    );
  }

  private async getNormalizedResourceContents(
    resourcePath: string
  ): Promise<string> {
    const contents = await this.getResourceContents(resourcePath);
    const normalized = contents.replace(
      new RegExp(`${PUBLIC_URL_PLACEHOLDER}`, 'g'),
      vscode.Uri
        .file(this.extensionContext.asAbsolutePath('.'))
        .with({
          scheme: 'vscode-resource'
        })
        .toString()
    );
    return normalized;
  }

  private async getResourceContents(resourcePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      fs.readFile(
        this.extensionContext.asAbsolutePath(resourcePath),
        'utf8',
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });
  }
}
