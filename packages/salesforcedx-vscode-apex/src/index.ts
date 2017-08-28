/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { DEBUGGER_LINE_BREAKPOINTS } from './constants';
import * as languageServer from './languageServer';

let languageClient: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  languageClient = await languageServer.createLanguageServer(context);
  const handle = languageClient.start();
  context.subscriptions.push(handle);

  const exportedApi = {
    getLineBreakpointInfo
  };
  return exportedApi;
}

async function getLineBreakpointInfo(): Promise<{}> {
  let response = {};
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_LINE_BREAKPOINTS);
  }
  return Promise.resolve(response);
}

// tslint:disable-next-line:no-empty
export function deactivate() {}
