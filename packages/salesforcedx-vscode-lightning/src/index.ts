/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { shared as lspCommon } from 'lightning-lsp-common';
import { WorkspaceType } from 'lightning-lsp-common/lib/shared';
import * as path from 'path';
import {
  commands,
  ExtensionContext,
  extensions,
  ProgressLocation,
  Uri,
  window,
  workspace
} from 'vscode';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';
import { createQuickOpenCommand } from './commands/quickpick/quickpick';
import { nls } from './messages';
import { telemetryService } from './telemetry';
import { ComponentTreeProvider } from './views/component-tree-provider';

let client: LanguageClient;

// See https://github.com/Microsoft/vscode-languageserver-node/issues/105
export function code2ProtocolConverter(value: Uri): string {
  if (/^win32/.test(process.platform)) {
    // The *first* : is also being encoded which is not the standard for URI on Windows
    // Here we transform it back to the standard way
    return value.toString().replace('%3A', ':');
  } else {
    return value.toString();
  }
}

function protocol2CodeConverter(value: string): Uri {
  return Uri.parse(value);
}

function checkActivationMode(mode: string): boolean {
  return (
    vscode.workspace
      .getConfiguration('salesforcedx-vscode-lightning')
      .get('activationMode') === mode
  );
}

export async function activate(context: ExtensionContext) {
  const extensionHRStart = process.hrtime();
  // Run our auto detection routine before we activate
  // 1) If activationMode is off, don't startup no matter what
  if (checkActivationMode('off')) {
    console.log('Aura Language Server activationMode set to off, exiting...');
    return;
  }

  // 2) if we have no workspace folders, exit
  if (!vscode.workspace.workspaceFolders) {
    console.log('No workspace, exiting extension');
    return;
  }

  // 3) If activationMode is autodetect or always, check workspaceType before startup
  let workspaceType;
  if (checkActivationMode('autodetect') || checkActivationMode('always')) {
    workspaceType = lspCommon.detectWorkspaceType(
      vscode.workspace.workspaceFolders[0].uri.fsPath
    );
    const sfdxWorkspace = workspaceType === WorkspaceType.SFDX;

    // Check if we have a valid project structure
    if (!lspCommon.isLWC(workspaceType)) {
      // If activationMode === autodetect and we don't have a valid workspace type, exit
      if (checkActivationMode('autodetect')) {
        console.log(
          'Aura LSP - autodetect did not find a valid project structure, exiting....'
        );
        console.log('WorkspaceType detected: ' + workspaceType);
        return;
      }
      // If activationMode === always, ignore workspace type and continue activating
    }
  }
  // 4) If we get here, we either passed autodetect validation or activationMode == alwayson
  console.log('Aura Components Extension Activated');
  console.log('WorkspaceType detected: ' + workspaceType);

  // Start the Aura Language Server
  startAuraLanguageServer(context);

  // Notify telemetry that our extension is now active
  telemetryService.sendExtensionActivationEvent(extensionHRStart).catch();
}

function startAuraLanguageServer(context: vscode.ExtensionContext) {
  // Setup the language server
  const serverModule = context.asAbsolutePath(
    path.join('node_modules', 'aura-language-server', 'lib', 'server.js')
  );

  // The debug options for the server
  const debugOptions = {
    execArgv: ['--nolazy', '--inspect-brk=6020']
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
        workspace.createFileSystemWatcher(
          '**/labels/CustomLabels.labels-meta.xml'
        ),
        workspace.createFileSystemWatcher('**/aura/*/*.{cmp,app,intf,evt,js}'),
        workspace.createFileSystemWatcher(
          '**/components/*/*/*.{cmp,app,intf,evt,lib,js}'
        ),
        // need to watch for directory deletions as no events are created for contents or deleted directories
        workspace.createFileSystemWatcher('**/', true, true, false),

        // these need to be handled because we also maintain a lwc index for interop
        workspace.createFileSystemWatcher(
          '**/staticresources/*.resource-meta.xml'
        ),
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
  this.client = client = new LanguageClient(
    'auraLanguageServer',
    nls.localize('client_name'),
    serverOptions,
    clientOptions
  );

  // Add Quick Open command
  context.subscriptions.push(
    commands.registerCommand(
      'salesforce-lightning-quickopen',
      createQuickOpenCommand(client)
    )
  );

  // Add Lightning Explorer data provider
  const componentProvider = new ComponentTreeProvider(client, context);
  window.registerTreeDataProvider(
    'salesforce-lightning-components',
    componentProvider
  );

  client
    .onReady()
    .then(() => {
      this.client.onNotification('salesforce/indexingStarted', startIndexing);
      this.client.onNotification('salesforce/indexingEnded', endIndexing);
    })
    .catch();

  // Start the language server
  client.start();

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(this.client);
}

let indexingResolve: any;

function startIndexing(): void {
  const indexingPromise: Promise<void> = new Promise(resolve => {
    indexingResolve = resolve;
  });
  reportIndexing(indexingPromise);
}

function endIndexing(): void {
  indexingResolve(undefined);
}

function reportIndexing(indexingPromise: Promise<void>) {
  window.withProgress(
    {
      location: ProgressLocation.Window,
      title: nls.localize('index_components_text'),
      cancellable: true
    },
    () => {
      return indexingPromise;
    }
  );
}

export function deactivate() {
  console.log('Aura Components Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent().catch();
}
