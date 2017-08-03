/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { APEX_LANGUAGE_SERVER_CHANNEL } from './channel';
import * as languageServer from './languageServer';

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
