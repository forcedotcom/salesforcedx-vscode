import * as vscode from 'vscode';
import * as languageServer from './language-server';

export function activate(context: vscode.ExtensionContext) {
  console.log('SalesforceDX Apex Language Server Extension Activated');
  const apexServer = languageServer.createLanguageServer(context).start();
  context.subscriptions.push(apexServer);
}

export function deactivate() {
  console.log('SalesforceDX Apex Language Server Extension Deactivated');
}
