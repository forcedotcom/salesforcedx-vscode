/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import {
  DEBUGGER_EXCEPTION_BREAKPOINTS,
  DEBUGGER_LINE_BREAKPOINTS
} from './constants';
import * as languageServer from './languageServer';
import { telemetryService } from './telemetry';

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);

let languageClient: LanguageClient | undefined;
let languageClientReady = false;

export async function activate(context: vscode.ExtensionContext) {
  // Telemetry
  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    sfdxCoreExtension.exports.telemetryService.showTelemetryMessage();

    telemetryService.initializeService(
      sfdxCoreExtension.exports.telemetryService.getReporter(),
      sfdxCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  telemetryService.sendExtensionActivationEvent();

  languageClient = await languageServer.createLanguageServer(context);
  const handle = languageClient.start();
  context.subscriptions.push(handle);

  languageClient.onReady().then(() => {
    languageClientReady = true;
  });

  const exportedApi = {
    getLineBreakpointInfo,
    getExceptionBreakpointInfo,
    isLanguageClientReady
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

async function getExceptionBreakpointInfo(): Promise<{}> {
  let response = {};
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_EXCEPTION_BREAKPOINTS);
  }
  return Promise.resolve(response);
}

function isLanguageClientReady(): boolean {
  return languageClientReady;
}

// tslint:disable-next-line:no-empty
export function deactivate() {
  telemetryService.sendExtensionDeactivationEvent();
}
