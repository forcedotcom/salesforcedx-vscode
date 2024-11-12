/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'path';
import { ExtensionContext, ProgressLocation, Uri, window, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import { nls } from './messages';

// See https://github.com/Microsoft/vscode-languageserver-node/issues/105
export const code2ProtocolConverter = (value: Uri): string => {
  if (/^win32/.test(process.platform)) {
    // The *first* : is also being encoded which is not the standard for URI on Windows
    // Here we transform it back to the standard way
    return value.toString().replace('%3A', ':');
  } else {
    return value.toString();
  }
};

const protocol2CodeConverter = (value: string): Uri => {
  return Uri.parse(value);
};

const getActivationMode = (): string => {
  const config = workspace.getConfiguration('salesforcedx-vscode-lightning');
  return config.get('activationMode') || 'autodetect'; // default to autodetect
};

export const activate = async (extensionContext: ExtensionContext) => {
  const extensionHRStart = process.hrtime();
  console.log('Activation Mode: ' + getActivationMode());
  // Run our auto detection routine before we activate
  // 1) If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    console.log('Aura Language Server activationMode set to off, exiting...');
    return;
  }

  // 2) if we have no workspace folders, exit
  if (!workspace.workspaceFolders) {
    console.log('No workspace, exiting extension');
    return;
  }

  // Pass the workspace folder URIs to the language server
  const workspaceUris: string[] = [];
  workspace.workspaceFolders.forEach(folder => {
    workspaceUris.push(folder.uri.fsPath);
  });

  // 3) If activationMode is autodetect or always, check workspaceType before startup
  const workspaceType = lspCommon.detectWorkspaceType(workspaceUris);

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !lspCommon.isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
    console.log('Aura LSP - autodetect did not find a valid project structure, exiting....');
    console.log('WorkspaceType detected: ' + workspaceType);
    return;
  }
  // If activationMode === always, ignore workspace type and continue activating

  // 4) If we get here, we either passed autodetect validation or activationMode == always
  console.log('Aura Components Extension Activated');
  console.log('WorkspaceType detected: ' + workspaceType);

  // Initialize telemetry service
  await TelemetryService.getInstance().initializeService(extensionContext);

  // Start the Aura Language Server

  // Setup the language server
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
    outputChannelName: nls.localize('channel_name'),
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
      { language: 'javascript', scheme: 'untitled' }
    ],
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
    },
    uriConverters: {
      code2Protocol: code2ProtocolConverter,
      protocol2Code: protocol2CodeConverter
    }
  };

  // Create the language client and start the client.
  const client = new LanguageClient('auraLanguageServer', nls.localize('client_name'), serverOptions, clientOptions);

  client
    .onReady()
    .then(() => {
      client.onNotification('salesforce/indexingStarted', startIndexing);
      client.onNotification('salesforce/indexingEnded', endIndexing);
    })
    .catch();

  // Start the language server
  const disp = client.start();

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  extensionContext.subscriptions.push(disp);

  // Notify telemetry that our extension is now active
  TelemetryService.getInstance().sendExtensionActivationEvent(extensionHRStart);
};

let indexingResolve: any;

const startIndexing = (): void => {
  const indexingPromise: Promise<void> = new Promise(resolve => {
    indexingResolve = resolve;
  });
  void reportIndexing(indexingPromise);
};

const endIndexing = (): void => {
  indexingResolve(undefined);
};
const reportIndexing = async (indexingPromise: Promise<void>) => {
  void window.withProgress(
    {
      location: ProgressLocation.Window,
      title: nls.localize('index_components_text'),
      cancellable: true
    },
    () => {
      return indexingPromise;
    }
  );
};

export const deactivate = () => {
  console.log('Aura Components Extension Deactivated');
  TelemetryService.getInstance().sendExtensionDeactivationEvent();
};
