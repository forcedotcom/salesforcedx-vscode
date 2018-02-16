/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as lwcLanguageServer from 'lwc-language-server';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';
import { ESLINT_NODEPATH_CONFIG, LWC_EXTENSION_NAME } from './constants';
import { nls } from './messages';

function registerCommands(): vscode.Disposable {
  const {
    forceLightningLwcCreate
  } = require('./commands/forceLightningLwcCreate');

  // Customer-facing commands
  const forceLightningLwcCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.lwc.create',
    forceLightningLwcCreate
  );

  return vscode.Disposable.from(forceLightningLwcCreateCmd);
}

function isDependencyInstalled(): boolean {
  const coreDependency = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-core'
  );
  return coreDependency && coreDependency.exports;
}

export async function activate(context: vscode.ExtensionContext) {
  if (!isDependencyInstalled()) {
    vscode.window.showErrorMessage(
      nls.localize('salesforcedx_vscode_core_not_installed_text')
    );
    console.log(
      'salesforce.salesforcedx-vscode-core not installed or activated, exiting extension'
    );
    return;
  }

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

  // Check if ran from a LWC project
  if (!lwcLanguageServer.isLWC(workspaceType)) {
    console.log('Not a LWC project, exiting extension');
    return;
  }

  startLWCLanguageServer(serverModule, context);

  if (workspaceType === lwcLanguageServer.WorkspaceType.SFDX) {
    populateEslintSettingIfNecessary(
      context,
      vscode.workspace.getConfiguration()
    );
  }

  // Commands
  const commands = registerCommands();
  context.subscriptions.push(commands);
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
    documentSelector: ['html', 'javascript'],
    synchronize: {
      fileEvents: [
        vscode.workspace.createFileSystemWatcher('**/*.resource'),
        vscode.workspace.createFileSystemWatcher(
          '**/labels/CustomLabels.labels-meta.xml'
        ),
        vscode.workspace.createFileSystemWatcher(
          '**/lightningcomponents/*/*.js'
        )
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

export function populateEslintSettingIfNecessary(
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
    config.update(
      ESLINT_NODEPATH_CONFIG,
      eslintModule,
      vscode.ConfigurationTarget.Workspace
    );
  }
}
