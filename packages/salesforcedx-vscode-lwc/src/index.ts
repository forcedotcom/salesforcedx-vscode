/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as lwcLanguageServer from 'lwc-language-server';
import * as path from 'path';
import {
  ConfigurationTarget,
  ExtensionContext,
  workspace,
  WorkspaceConfiguration
} from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';
import { ESLINT_NODEPATH_CONFIG, LWC_EXTENSION_NAME } from './constants';

export async function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('node_modules', 'lwc-language-server', 'lib', 'server.js')
  );

  if (!workspace.workspaceFolders) {
    console.log('No workspace, exiting extension');
    return;
  }

  const workspaceType = lwcLanguageServer.detectWorkspaceType(
    workspace.workspaceFolders[0].uri.path
  );

  // Check if ran from a LWC project
  if (!lwcLanguageServer.isLWC(workspaceType)) {
    console.log('Not a LWC project, exiting extension');
    return;
  }

  startLWCLanguageServer(serverModule, context);

  if (workspaceType === lwcLanguageServer.WorkspaceType.SFDX) {
    populateEslintSettingIfNecessary(context, workspace.getConfiguration());
  }
}

function startLWCLanguageServer(
  serverModule: string,
  context: ExtensionContext
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
        workspace.createFileSystemWatcher('**/*.resource'),
        workspace.createFileSystemWatcher(
          '**/labels/CustomLabels.labels-meta.xml'
        ),
        workspace.createFileSystemWatcher('**/lightningcomponents/*/*.js')
      ]
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
  context: ExtensionContext,
  config: WorkspaceConfiguration
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
      ConfigurationTarget.Workspace
    );
  }
}
