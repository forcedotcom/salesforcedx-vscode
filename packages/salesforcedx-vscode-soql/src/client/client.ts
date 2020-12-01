/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { DescribeGlobalSObjectResult } from 'jsforce';
import * as path from 'path';
import {
  CompletionItem,
  CompletionItemKind,
  ExtensionContext,
  workspace
} from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';
import ProtocolCompletionItem from 'vscode-languageclient/lib/protocolCompletionItem';
import { retrieveSObjects } from '../sfdx';

let client: LanguageClient;

export function startLanguageClient(extensionContext: ExtensionContext): void {
  // path to language server module
  const serverModule = extensionContext.asAbsolutePath(
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
      fileEvents: workspace.createFileSystemWatcher('**/*.soql')
    },
    middleware: {
      // The SOQL LSP server may include special completion items as "placeholders" for
      // the client to expand with information from the users' default Salesforce Org.
      // We do that here as middleware, transforming the server response before passing
      // it up to VSCode.
      provideCompletionItem: async (
        document,
        position,
        context,
        token,
        next
      ) => {
        const items = (await next(
          document,
          position,
          context,
          token
        )) as ProtocolCompletionItem[];
        const sobjectsIdx = items.findIndex(
          item =>
            item.kind === CompletionItemKind.Class &&
            item.label === '__SOBJECTS_PLACEHOLDER__'
        );
        if (sobjectsIdx >= 0) {
          console.log('=== Expanding __SOBJECTS_PLACEHOLDER__');
          const sobjectItems = (await retrieveSObjects()).map(objName => {
            const item = new ProtocolCompletionItem(objName);
            item.kind = CompletionItemKind.Class;
            return item;
          });

          items.splice(sobjectsIdx, 1, ...sobjectItems);
        }
        return items;
      }
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
