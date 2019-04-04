/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { shared } from 'lightning-lsp-common';
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

import {
  detectWorkspaceType,
  WorkspaceType
} from 'lightning-lsp-common/lib/shared';

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

export async function activate(context: ExtensionContext) {
  console.log('Aura Components Extension Activated');
  const extensionHRStart = process.hrtime();

  const serverModule = context.asAbsolutePath(
    path.join('node_modules', 'aura-language-server', 'lib', 'server.js')
  );

  // The debug options for the server
  const debugOptions = {
    execArgv: ['--nolazy', '--inspect=6020']
  };
  // let debugOptions = { };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
      runtime: '/Users/midzelis/.nvm/versions/node/v10.15.3/bin/node'
    }
  };

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
  // UI customizations
  context.subscriptions.push(
    commands.registerCommand(
      'salesforce-lightning-quickopen',
      createQuickOpenCommand(client)
    )
  );
  const workspaceType: WorkspaceType = detectWorkspaceType(
    workspace.workspaceFolders[0].uri.fsPath
  );

  const componentProvider = new ComponentTreeProvider(
    client,
    context,
    workspaceType
  );
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

  // do this last
  client.start();
  context.subscriptions.push(this.client);

  telemetryService.sendExtensionActivationEvent(extensionHRStart).catch();
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
  telemetryService.sendExtensionDeactivationEvent();
}
