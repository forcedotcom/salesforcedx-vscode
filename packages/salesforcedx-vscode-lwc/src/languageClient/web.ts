/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common';
import { code2ProtocolConverter } from '@salesforce/salesforcedx-utils-vscode';
import { Uri, workspace, window } from 'vscode';
import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn } from 'vscode-languageclient/browser';
import { channelService } from '../channel';

const protocol2CodeConverter = (value: string) => Uri.parse(value);

export const createLanguageClient = (
  serverPath: string,
  initializationOptions: { workspaceType: WorkspaceType }
): LanguageClient => {
  // Browser mode: use web worker
  // Create a web worker for the language server
  // Add error handling for worker creation
  let worker: Worker;
  try {
    console.log('[LWC] Creating web worker from:', serverPath);
    worker = new Worker(serverPath);

    // Add error handlers to detect worker loading issues
    worker.onerror = error => {
      const errorMsg = `[LWC] Web Worker error: ${error.message || String(error)}`;
      console.error(errorMsg);
      channelService.appendLine(errorMsg);
      channelService.appendLine(`Failed to load language server from: ${serverPath}`);
    };

    worker.onmessageerror = event => {
      const errorMsg = `[LWC] Web Worker message error: ${String(event)}`;
      console.error(errorMsg);
      channelService.appendLine(errorMsg);
    };

    // Listen for messages from the worker to verify it's running
    worker.onmessage = event => {
      console.log('[LWC] Web Worker message received:', event.data);
      // Log first message to confirm server is alive
      if (event.data && typeof event.data === 'object') {
        channelService.appendLine(`[LWC] Server message: ${JSON.stringify(event.data).substring(0, 200)}`);
      }
    };

    console.log('[LWC] Web worker created successfully');
  } catch (error) {
    const errorMsg = `[LWC] Failed to create web worker: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    channelService.appendLine(errorMsg);
    channelService.appendLine(`Server path: ${serverPath}`);
    throw new Error(errorMsg);
  }

  // Create output channel for language server logs
  const outputChannel = window.createOutputChannel('LWC Language Server');

  // Build document selector that includes both 'file' scheme and workspace folder schemes
  // In web mode, files may use schemes like 'memfs' instead of 'file'
  const schemes = new Set<string>(['file']);
  if (workspace.workspaceFolders) {
    for (const folder of workspace.workspaceFolders) {
      schemes.add(folder.uri.scheme);
    }
  }

  const documentSelector = Array.from(schemes).flatMap(scheme => [
    { language: 'html', scheme },
    { language: 'javascript', scheme },
    { language: 'typescript', scheme },
    { language: 'json', scheme },
    { language: 'xml', scheme }
  ]);

  console.log(`[LWC] Document selector schemes: ${Array.from(schemes).join(', ')}`);

  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      fileEvents: [
        workspace.createFileSystemWatcher('**/*.resource'),
        workspace.createFileSystemWatcher('**/labels/CustomLabels.labels-meta.xml'),
        workspace.createFileSystemWatcher('**/staticresources/*.resource-meta.xml'),
        workspace.createFileSystemWatcher('**/contentassets/*.asset-meta.xml'),
        workspace.createFileSystemWatcher('**/lwc/*/*.js'),
        workspace.createFileSystemWatcher('**/modules/*/*/*.js'),
        workspace.createFileSystemWatcher('**/modules/*/*/*.ts'),
        // need to watch for directory deletions as no events are created for contents or deleted directories
        workspace.createFileSystemWatcher('**/', false, true, false)
      ]
    },
    initializationOptions,
    uriConverters: {
      code2Protocol: code2ProtocolConverter,
      protocol2Code: protocol2CodeConverter
    },
    // Add output channel for server logs
    outputChannel,
    // Show output channel on errors
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    // Enable tracing for debugging
    traceOutputChannel: outputChannel
  };

  // Browser LanguageClient constructor: (id, name, clientOptions, worker)
  const client = new LanguageClient('lwcLanguageServer', 'LWC Language Server', clientOptions, worker);

  // Add event listeners to track client lifecycle
  client.onDidChangeState(event => {
    const state = event.newState;
    // State enum values: State.Initial = 0, State.Starting = 1, State.Running = 2, State.Stopping = 3
    const stateValue = typeof state === 'number' ? state : String(state);
    const stateStr = String(state);
    console.log(`[LWC] Language client state changed: ${stateStr} (value: ${stateValue})`);
    channelService.appendLine(`[LWC] Language client state: ${stateStr}`);
    outputChannel.appendLine(`[LWC] Language client state: ${stateStr}`);
  });

  client.onNotification('$/logTrace', (params: unknown) => {
    console.log('[LWC] Server trace:', params);
    outputChannel.appendLine(`[Server Trace] ${JSON.stringify(params)}`);
  });

  console.log('[LWC] Language client created, will log to output channel');
  channelService.appendLine('[LWC] Language client created');

  return client;
};
