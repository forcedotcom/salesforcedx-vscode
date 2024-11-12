/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import * as codeCompletion from './codeCompletion';
import * as queryValidation from './queryValidation';

let client: LanguageClient;

export const clearDiagnostics = (): void => {
  client?.diagnostics?.clear();
};

export const startLanguageClient = async (extensionContext: ExtensionContext): Promise<void> => {
  // path to language server module
  const serverPath = extensionContext.extension.packageJSON.serverPath;
  const serverModule = extensionContext.asAbsolutePath(path.join(...serverPath));
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
  client.start();
  await client.onReady();
  client = queryValidation.afterStart(client);
};

export const stopLanguageClient = (): Thenable<void> | undefined => {
  if (!client) {
    return undefined;
  }
  return client.stop();
};
