import * as vscode from 'vscode';
import { APEX_LANGUAGE_SERVER_CHANNEL } from './channel';
import * as languageServer from './language-server';

export function activate(context: vscode.ExtensionContext) {
  APEX_LANGUAGE_SERVER_CHANNEL.appendLine(
    'Salesforce DX Apex Language Server Extension Activated'
  );
  const apexServer = languageServer.createLanguageServer(context).start();
  context.subscriptions.push(apexServer);
}

export function deactivate() {
  APEX_LANGUAGE_SERVER_CHANNEL.appendLine(
    'Salesforce DX Apex Language Server Extension Deactivated'
  );
}
