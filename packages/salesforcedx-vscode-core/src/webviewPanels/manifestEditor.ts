/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../src/messages';

class ManifestEditor {
  private static readonly viewTitle = nls.localize(
    'manifest_editor_title_message'
  );
  private static readonly viewType = 'manifestEditor.type';
  private static currentPanel: ManifestEditor | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionPath: string;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionPath: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ManifestEditor.currentPanel) {
      ManifestEditor.currentPanel.panel.reveal(column);
    } else {
      ManifestEditor.currentPanel = new ManifestEditor(
        extensionPath,
        column || vscode.ViewColumn.One
      );
    }
  }

  private constructor(extensionPath: string, column: vscode.ViewColumn) {
    this.extensionPath = extensionPath;

    this.panel = vscode.window.createWebviewPanel(
      ManifestEditor.viewType,
      ManifestEditor.viewTitle,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.extensionPath, 'webviews'))
        ]
      }
    );
  }

  public dispose() {
    ManifestEditor.currentPanel = undefined;

    // Clean up our resources
    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private show(): any {
    throw new Error('Method not implemented.');
  }
}
