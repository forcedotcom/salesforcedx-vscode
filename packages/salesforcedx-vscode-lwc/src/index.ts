/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { shared as lwcLanguageServer } from 'lightning-lsp-common';
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

async function registerCommands(
  activateDX: boolean
): Promise<vscode.Disposable | undefined> {
  try {
    await waitForDX(activateDX);
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

export async function activate(context: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();
  const serverModule = context.asAbsolutePath(
    path.join('node_modules', 'lwc-language-server', 'lib', 'server.js')
  );

  if (!vscode.workspace.workspaceFolders) {
    console.log('No workspace, exiting extension');
    return;
  }

  const workspaceType = lwcLanguageServer.detectWorkspaceType(
    vscode.workspace.workspaceFolders[0].uri.fsPath
  );
  const sfdxWorkspace = workspaceType === WorkspaceType.SFDX;

  // Check if ran from a LWC project
  if (!lwcLanguageServer.isLWC(workspaceType)) {
    console.log('Not a LWC project, exiting extension');
    return;
  }

  startLWCLanguageServer(serverModule, context);

  if (workspaceType === lwcLanguageServer.WorkspaceType.SFDX) {
    await populateEslintSettingIfNecessary(
      context,
      vscode.workspace.getConfiguration(
        '',
        vscode.workspace.workspaceFolders[0].uri
      )
    );
  }

  // Commands
  registerCommands(sfdxWorkspace)
    .then(disposable => {
      if (disposable) {
        context.subscriptions.push(disposable);
      }
    })
    .catch();
  telemetryService.sendExtensionActivationEvent(extensionHRStart).catch();
}

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

function startLWCLanguageServer(
  serverModule: string,
  context: vscode.ExtensionContext
) {
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
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
  const disposable = new LanguageClient(
    'lwcLanguageServer',
    'LWC Language Server',
    serverOptions,
    clientOptions
  ).start();
  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(disposable);
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
  console.log('SFDX LWC Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent().catch();
}
