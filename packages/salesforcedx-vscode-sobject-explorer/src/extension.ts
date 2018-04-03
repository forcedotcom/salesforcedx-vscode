'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { SObjectDataProvider, SObjectNode } from './sObjectExplorer';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const sObjectExplorer = new SObjectDataProvider(context);

  vscode.commands.registerCommand('sObjectExplorer.refresh', () =>
    sObjectExplorer.refresh()
  );
  vscode.window.registerTreeDataProvider('sObjectExplorer', sObjectExplorer);

  vscode.workspace.registerTextDocumentContentProvider(
    'sobject',
    sObjectExplorer
  );

  //   vscode.workspace.onDidChangeTextDocument(
  //     (e: vscode.TextDocumentChangeEvent) => {
  //       if (e.document === vscode.window.activeTextEditor.document) {
  //         provider.update(previewUri);
  //       }
  //     }
  //   );

  vscode.commands.registerCommand('openSObjectNode', (node: SObjectNode) => {
    vscode.workspace.openTextDocument(node.resource).then(document => {
      vscode.window.showTextDocument(document);
    });
  });

  console.log('sObject Explorer Extension Activated');
}
