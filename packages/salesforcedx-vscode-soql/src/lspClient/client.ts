/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionContext, workspace } from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import type { LanguageClient as BrowserLanguageClient } from 'vscode-languageclient/browser';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import * as codeCompletion from './codeCompletion';
import * as queryValidation from './queryValidation';

let client: BaseLanguageClient;

const buildClientOptions = (): LanguageClientOptions => ({
  documentSelector: [{ language: 'soql' }],
  synchronize: {
    configurationSection: 'soql',
    fileEvents: workspace.createFileSystemWatcher('**/*.soql')
  },
  middleware: codeCompletion.middleware
});

export const startLanguageClient = async (extensionContext: ExtensionContext): Promise<void> => {
  if (process.env.ESBUILD_PLATFORM === 'web') {
    // In the web bundle, esbuild aliases vscode-languageclient/node -> /browser, so LanguageClient
    // is the browser version at runtime. Cast to get the correct browser constructor signature.
    const workerUri = extensionContext.extensionUri.with({
      path: [extensionContext.extensionUri.path.replace(/\/$/, ''), 'dist', 'serverWorker.js'].join('/')
    });
    const worker = new Worker(workerUri.toString(true));
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    client = new (LanguageClient as unknown as typeof BrowserLanguageClient)(
      'soql-language-server',
      'SOQL Language Server',
      buildClientOptions(),
      worker
    );
  } else {
    const module = extensionContext.asAbsolutePath('dist/server.js');
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    const serverOptions: ServerOptions = {
      run: { module, transport: TransportKind.ipc },
      debug: { module, transport: TransportKind.ipc, options: debugOptions }
    };
    client = new LanguageClient('soql-language-server', 'SOQL Language Server', serverOptions, buildClientOptions());
  }

  client = queryValidation.init(client);
  await client.start();
  client = queryValidation.afterStart(client);
};

export const stopLanguageClient = (): Thenable<void> | undefined => client?.stop();
