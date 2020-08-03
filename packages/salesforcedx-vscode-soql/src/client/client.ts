/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';

let client: LanguageClient;

export function startLanguageClient(context: ExtensionContext) {
  // path to language server module
  const serverModule = context.asAbsolutePath(
    path.join(
      'node_modules',
      '@salesforce',
      'soql-language-server',
      'lib',
      'server.js'
    )
  );
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // provide for different run/debug modes
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'soql' }],
    synchronize: {
      configurationSection: 'soql',
      fileEvents: workspace.createFileSystemWatcher('**/.soql')
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'soql-language-server',
    'SOQL Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();
}

export function stopLanguageClient(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
