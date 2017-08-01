/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { APEX_LANGUAGE_SERVER_CHANNEL } from './channel';
import * as languageServer from './language-server';

let apexClient: LanguageClient | undefined;
let vscodeContext: vscode.ExtensionContext;

function rebuildApexDatabase() {
  if (vscode.workspace.rootPath) {
    if (apexClient) {
      apexClient.stop();
    }
    fs.unlink(
      path.join(vscode.workspace.rootPath, '.sfdx', 'tools', 'apex.db')
    );
    if (apexClient) {
      startApexLanguageServer();
    }
  }
}

function startApexLanguageServer() {
  apexClient = languageServer.createLanguageServer(vscodeContext);
  vscodeContext.subscriptions.push(apexClient.start());
}

export function activate(context: vscode.ExtensionContext) {
  APEX_LANGUAGE_SERVER_CHANNEL.appendLine(
    'Salesforce DX Apex Language Server Extension Activated'
  );

  vscodeContext = context;

  const rebuildCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.lsp.rebuild',
    rebuildApexDatabase
  );
  context.subscriptions.push(rebuildCmd);
  startApexLanguageServer();
}

export function deactivate() {
  APEX_LANGUAGE_SERVER_CHANNEL.appendLine(
    'Salesforce DX Apex Language Server Extension Deactivated'
  );
}
