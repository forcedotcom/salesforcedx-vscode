/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { shared as lspCommon } from 'lightning-lsp-common';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';
import { ESLINT_NODEPATH_CONFIG, LWC_EXTENSION_NAME } from './constants';

import { WorkspaceType } from 'lightning-lsp-common/lib/shared';
import { waitForDX } from './dxsupport/waitForDX';
import { telemetryService } from './telemetry';

// See https://github.com/Microsoft/vscode-languageserver-node/issues/105
export function code2ProtocolConverter(value: vscode.Uri) {
  if (/^win32/.test(process.platform)) {
    // The *first* : is also being encoded which is not the standard for URI on Windows
    // Here we transform it back to the standard way
    return value.toString().replace('%3A', ':');
  } else {
    return value.toString();
  }
}

function protocol2CodeConverter(value: string) {
  return vscode.Uri.parse(value);
}

async function registerCommands(): Promise<vscode.Disposable | undefined> {
  try {
    await waitForDX(true);
    const {
      forceLightningLwcCreate
    } = require('./commands/forceLightningLwcCreate');

    // Customer-facing commands
    const forceLightningLwcCreateCmd = vscode.commands.registerCommand(
      'sfdx.force.lightning.lwc.create',
      forceLightningLwcCreate
    );

    return vscode.Disposable.from(forceLightningLwcCreateCmd);
  } catch (ignore) {
    // ignore
    return undefined;
  }
}

function checkActivationMode(mode: string): boolean {
  return (
    vscode.workspace
      .getConfiguration('salesforcedx-vscode-lightning')
      .get('activationMode') === mode
  );
}

export async function activate(context: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();
  // Run our auto detection routine before we activate
  // 1) If activationMode is off, don't startup no matter what
  if (checkActivationMode('off')) {
    console.log('LWC Language Server activationMode set to off, exiting...');
    return;
  }

  // 2) if we have no workspace folders, exit
  if (!vscode.workspace.workspaceFolders) {
    console.log('No workspace, exiting extension');
    return;
  }

  // 3) If activationMode is autodetect or always, check workspaceType before startup
  const workspaceType = lspCommon.detectWorkspaceType(
    vscode.workspace.workspaceFolders[0].uri.fsPath
  );

    // Check if we have a valid project structure
    if (!lspCommon.isLWC(workspaceType)) {
      // If activationMode === autodetect and we don't have a valid workspace type, exit
      if (checkActivationMode('autodetect')) {
        console.log(
          'LWC LSP - autodetect did not find a valid project structure, exiting....'
        );
        console.log('WorkspaceType detected: ' + workspaceType);
        return;
      }
      // If activationMode === always, ignore workspace type and continue activating
    }
  }
  // 4) If we get here, we either passed autodetect validation or activationMode == alwayson
  console.log('Lightning Web Components Extension Activated');
  console.log('WorkspaceType detected: ' + workspaceType);

  // Start the LWC Language Server
  startLWCLanguageServer(context);

  // Additional eslint configuration
  if (workspaceType === lspCommon.WorkspaceType.SFDX) {
    await populateEslintSettingIfNecessary(
      context,
      vscode.workspace.getConfiguration(
        '',
        vscode.workspace.workspaceFolders[0].uri
      )
    );
  }

  // Register commands async
  registerCommands()
    .then(disposable => {
      if (disposable) {
        context.subscriptions.push(disposable);
      }
    })
    .catch();

  // Notify telemetry that our extension is now active
  telemetryService.sendExtensionActivationEvent(extensionHRStart).catch();
}

function startLWCLanguageServer(context: vscode.ExtensionContext) {
  // Setup the language server
  const serverModule = context.asAbsolutePath(
    path.join('node_modules', 'lwc-language-server', 'lib', 'server.js')
  );
  const debugOptions = { execArgv: ['--nolazy', '--inspect-brk=6009'] };
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
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: 'html', scheme: 'file' },
      { language: 'javascript', scheme: 'file' }
    ],
    synchronize: {
      fileEvents: [
        vscode.workspace.createFileSystemWatcher('**/*.resource'),
        vscode.workspace.createFileSystemWatcher(
          '**/labels/CustomLabels.labels-meta.xml'
        ),
        vscode.workspace.createFileSystemWatcher(
          '**/staticresources/*.resource-meta.xml'
        ),
        vscode.workspace.createFileSystemWatcher(
          '**/contentassets/*.asset-meta.xml'
        ),
        vscode.workspace.createFileSystemWatcher('**/lwc/*/*.js'),
        vscode.workspace.createFileSystemWatcher('**/modules/*/*/*.js'),
        // need to watch for directory deletions as no events are created for contents or deleted directories
        vscode.workspace.createFileSystemWatcher('**/', false, true, false)
      ]
    },
    uriConverters: {
      code2Protocol: code2ProtocolConverter,
      protocol2Code: protocol2CodeConverter
    }
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    'lwcLanguageServer',
    'LWC Language Server',
    serverOptions,
    clientOptions
  ).start();

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(client);
}

export async function populateEslintSettingIfNecessary(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration
) {
  const nodePath = config.get<string>(ESLINT_NODEPATH_CONFIG);

  // User has not set one, use the eslint bundled with our extension
  // or if it is from salesforcedx-vscode-lwc, update since the path looks like
  // "eslint.nodePath": ".../.vscode/extensions/salesforce.salesforcedx-vscode-lwc-41.17.0/node_modules",
  // which contains the version number and needs to be updated on each extension
  if (!nodePath || nodePath.includes(LWC_EXTENSION_NAME)) {
    const eslintModule = context.asAbsolutePath(path.join('node_modules'));
    await config.update(
      ESLINT_NODEPATH_CONFIG,
      eslintModule,
      vscode.ConfigurationTarget.Workspace
    );
  }
}

export function deactivate() {
  console.log('Lightning Web Components Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent().catch();
}
