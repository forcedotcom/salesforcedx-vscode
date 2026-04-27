/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApplyWorkspaceEditRequest,
  handleApplyEditWithFs
} from '@salesforce/salesforcedx-lightning-lsp-common/applyEditHandler';
import { window, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn } from 'vscode-languageclient/browser';
import { appendToChannel } from '../channel';
import { buildDocumentSelector, getBaseClientOptions, type LwcInitializationOptions } from './clientOptions';

export const createLanguageClient = (
  serverPath: string,
  initializationOptions: LwcInitializationOptions
): LanguageClient => {
  // Browser mode: use web worker
  // Create a web worker for the language server
  // Add error handling for worker creation
  let worker: Worker;
  try {
    worker = new Worker(serverPath);

    // Add error handlers to detect worker loading issues
    worker.onerror = error => {
      const errorMsg = `[LWC] Web Worker error: ${error.message || String(error)}`;
      appendToChannel(errorMsg);
      appendToChannel(`Failed to load language server from: ${serverPath}`);
    };

    worker.onmessageerror = event => {
      const errorMsg = `[LWC] Web Worker message error: ${String(event)}`;
      appendToChannel(errorMsg);
    };

    // Listen for messages from the worker to verify it's running
    worker.onmessage = event => {
      // Log first message to confirm server is alive
      if (event.data && typeof event.data === 'object') {
        appendToChannel(`[LWC] Server message: ${JSON.stringify(event.data).substring(0, 200)}`);
      }
    };
  } catch (error) {
    const errorMsg = `[LWC] Failed to create web worker: ${error instanceof Error ? error.message : String(error)}`;
    appendToChannel(errorMsg);
    appendToChannel(`Server path: ${serverPath}`);
    throw new Error(errorMsg);
  }

  // Create output channel for language server logs
  const outputChannel = window.createOutputChannel('LWC Language Server');

  // In web mode, files may use schemes like 'memfs' instead of 'file'
  const schemes = new Set<string>(['file']);
  if (workspace.workspaceFolders) {
    for (const folder of workspace.workspaceFolders) {
      schemes.add(folder.uri.scheme);
    }
  }

  const clientOptions: LanguageClientOptions = {
    ...getBaseClientOptions(initializationOptions),
    documentSelector: buildDocumentSelector(Array.from(schemes)),
    outputChannel,
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    traceOutputChannel: outputChannel
  };

  // Browser LanguageClient constructor: (id, name, clientOptions, worker)
  const client = new LanguageClient('lwcLanguageServer', 'LWC Language Server', clientOptions, worker);

  // Handle workspace/applyEdit by writing via workspace.fs (no IDE open);
  client.onRequest(ApplyWorkspaceEditRequest.type, handleApplyEditWithFs);

  // Add event listeners to track client lifecycle
  client.onDidChangeState(event => {
    const state = event.newState;
    // State enum values: State.Initial = 0, State.Starting = 1, State.Running = 2, State.Stopping = 3
    const stateStr = String(state);
    appendToChannel(`[LWC] Language client state: ${stateStr}`);
    outputChannel.appendLine(`[LWC] Language client state: ${stateStr}`);
  });

  client.onNotification('$/logTrace', (params: unknown) => {
    outputChannel.appendLine(`[Server Trace] ${JSON.stringify(params)}`);
  });

  return client;
};
