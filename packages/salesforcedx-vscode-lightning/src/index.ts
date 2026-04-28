/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AURA_SERVER_READY_NOTIFICATION, isLWC } from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  ApplyWorkspaceEditRequest,
  handleApplyEditWithFs
} from '@salesforce/salesforcedx-lightning-lsp-common/applyEditHandler';
import { detectWorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common/detectWorkspaceTypeVscode';
import { registerWorkspaceReadFileHandler } from '@salesforce/salesforcedx-lightning-lsp-common/workspaceReadFileHandler';
import { TelemetryService, TimingUtils } from '@salesforce/salesforcedx-utils-vscode';
import { log } from 'node:console';
import * as path from 'node:path';
import { ExtensionContext, workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';
import AuraLspStatusBarItem from './auraLspStatusBarItem';
import { nls } from './messages';

const getActivationMode = (): string => {
  const config = workspace.getConfiguration('salesforcedx-vscode-lightning');
  return config.get('activationMode') ?? 'autodetect'; // default to autodetect
};

export const activate = async (extensionContext: ExtensionContext) => {
  const extensionStartTime = TimingUtils.getCurrentTime();

  // Run our auto detection routine before we activate
  // 1) If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    log('Aura Language Server activationMode set to off, exiting...');
    return;
  }

  // 2) if we have no workspace folders, exit
  if (!workspace.workspaceFolders) {
    log('No workspace, exiting extension');
    return;
  }

  // Pass the workspace folder URIs to the language server
  const workspaceUris: string[] = [];
  workspace.workspaceFolders.forEach(folder => {
    workspaceUris.push(folder.uri.fsPath);
  });

  // 3) If activationMode is autodetect or always, check workspaceType before startup
  const workspaceType = await detectWorkspaceType(workspaceUris);

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
    log(
      `Aura LSP - autodetect did not find a valid project structure, exiting.... WorkspaceType detected: ${workspaceType}`
    );
    return;
  }

  // Initialize telemetry service
  await TelemetryService.getInstance().initializeService(extensionContext);

  // Start the Aura Language Server
  const serverPath = extensionContext.extension.packageJSON.serverPath;
  const serverModule = extensionContext.asAbsolutePath(path.join(...serverPath));

  // The debug options for the server
  const debugOptions = {
    execArgv: ['--nolazy', '--inspect=6020']
  };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // Setup our fileSystemWatchers
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        language: 'html',
        scheme: 'file'
      },
      {
        language: 'html',
        scheme: 'untitled'
      },
      { language: 'javascript', scheme: 'file' },
      { language: 'javascript', scheme: 'untitled' },
      // Include json and xml to receive onDidOpen events for workspace configuration files
      { language: 'json', scheme: 'file' },
      { language: 'xml', scheme: 'file' }
    ],
    initializationOptions: {
      workspaceType
    },
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    synchronize: {
      fileEvents: [
        workspace.createFileSystemWatcher('**/*.resource'),
        workspace.createFileSystemWatcher('**/labels/CustomLabels.labels-meta.xml'),
        workspace.createFileSystemWatcher('**/aura/*/*.{cmp,app,intf,evt,js}'),
        workspace.createFileSystemWatcher('**/components/*/*/*.{cmp,app,intf,evt,lib,js}'),
        // need to watch for directory deletions as no events are created for contents or deleted directories
        workspace.createFileSystemWatcher('**/', true, true, false),

        // these need to be handled because we also maintain a lwc index for interop
        workspace.createFileSystemWatcher('**/staticresources/*.resource-meta.xml'),
        workspace.createFileSystemWatcher('**/contentassets/*.asset-meta.xml'),
        workspace.createFileSystemWatcher('**/lwc/*/*.js'),
        workspace.createFileSystemWatcher('**/modules/*/*/*.js')
      ]
    }
  };

  // Create the language client and start the client.
  const client = new LanguageClient('auraLanguageServer', nls.localize('client_name'), serverOptions, clientOptions);
  // Handle workspace/applyEdit by writing via workspace.fs (no IDE open); must register before start()
  client.onRequest(ApplyWorkspaceEditRequest.type, handleApplyEditWithFs);
  console.log(`Server module path: ${serverModule}`);

  // Create language status item to show indexing progress
  const statusBarItem = new AuraLspStatusBarItem();
  extensionContext.subscriptions.push(statusBarItem);

  // Listen for server ready notification to update status
  client.onNotification(AURA_SERVER_READY_NOTIFICATION, () => {
    statusBarItem.ready();
  });
  // Register workspace read file handler before start so the server can read files during initialize
  registerWorkspaceReadFileHandler(client);
  log('Workspace read file handler registered');

  // Start the language server
  try {
    await client.start();
    console.log('Aura Language Server started successfully');
  } catch (error) {
    const errorMessage = `Failed to start Aura Language Server: ${String(error)}`;
    log(errorMessage);
    throw error;
  }

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  extensionContext.subscriptions.push(client);

  // finising up with workspace awareness
  log('Finished with workspace awareness');

  // Notify telemetry that our extension is now active
  TelemetryService.getInstance().sendExtensionActivationEvent(extensionStartTime);
};

export const deactivate = () => {
  console.log('Aura Components Extension Deactivated');
  TelemetryService.getInstance().sendExtensionDeactivationEvent();
};
