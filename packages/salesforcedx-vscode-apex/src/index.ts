/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import * as languageServer from './languageServer';

export async function activate(context: vscode.ExtensionContext) {
  const languageClient = await languageServer.createLanguageServer(context);
  const handle = languageClient.start();
  context.subscriptions.push(handle);
}

// tslint:disable-next-line:no-empty
export function deactivate() {}
