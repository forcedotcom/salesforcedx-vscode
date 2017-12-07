/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';

const LWC_ENGINE_PKG = 'lwc-engine';

export async function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('node_modules', 'lwc-language-server', 'lib', 'server.js')
  );

  // Check if ran from a LSC project
  if (!await isLWCProject() && !isSfdxProject() && !isCore()) {
    console.log('not a LWC project, exiting extension');
    return;
  }

  // The debug options for the server
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
      // Notify the server about file changes to '.clientrc files contain in the workspace
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

async function isLWCProject(): Promise<boolean> {
  const files = await workspace.findFiles('package.json', 'node_modules', 1);

  if (files.length < 1) {
    return false;
  }

  // Check if package.json contains lwc-engine
  const packageInfo = require(files[0].fsPath);
  const hasLWCDependency = Object.keys(packageInfo.dependencies || {}).includes(
    LWC_ENGINE_PKG
  );
  const hasLWCDevDependency = Object.keys(
    packageInfo.devDependencies || {}
  ).includes(LWC_ENGINE_PKG);

  return hasLWCDependency || hasLWCDevDependency;
}

export function isSfdxProject() {
  if (!workspace.workspaceFolders) {
    return false;
  }

  const workspaceRoot = workspace.workspaceFolders[0].uri.path;
  return fs.existsSync(path.join(workspaceRoot, 'sfdx-project.json'));
}

function isCore() {
  if (!workspace.workspaceFolders) {
    return false;
  }

  const workspaceRoot = workspace.workspaceFolders[0].uri.path;
  if (fs.existsSync(path.join(workspaceRoot, 'workspace-user.xml'))) {
    return true; // opened in core/
  }
  if (fs.existsSync(path.join(workspaceRoot, 'modules'))) {
    return true; // opened in core project with modules/ folder
  }

  return false;
}
