/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import { ExtensionContext, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import * as codeCompletion from './codeCompletion';
import * as queryValidation from './queryValidation';

let client: LanguageClient;

export const startLanguageClient = async (extensionContext: ExtensionContext): Promise<void> => {
  // path to language server module

  const module = extensionContext.asAbsolutePath(
    path.join('dist', 'server.js') // or wherever your bundled server is
  );

  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // provide for different run/debug modes
  const serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'soql' }],
    synchronize: {
      configurationSection: 'soql',
      fileEvents: workspace.createFileSystemWatcher('**/*.soql')
    },
    middleware: codeCompletion.middleware
  };

  // Create the language client and start the client.
  client = new LanguageClient('soql-language-server', 'SOQL Language Server', serverOptions, clientOptions);

  client = queryValidation.init(client);

  // Start the client. This will also launch the server
  await client.start();
  client = queryValidation.afterStart(client);
};

export const stopLanguageClient = (): Thenable<void> | undefined => client?.stop();
