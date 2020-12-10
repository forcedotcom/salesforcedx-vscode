/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  QueryValidationFeature,
  RequestTypes
} from '@salesforce/soql-language-server';
import * as path from 'path';
import { ExtensionContext, extensions, workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';
import { QueryRunner } from '../editor/queryRunner';

const sfdxCoreExtension = extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);
const workspaceContext = sfdxCoreExtension?.exports?.workspaceContext;

let client: LanguageClient;

export function clearDiagnostics(): void {
  client?.diagnostics?.clear();
}

export async function startLanguageClient(
  context: ExtensionContext
): Promise<void> {
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
      fileEvents: workspace.createFileSystemWatcher('**/*.soql')
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'soql-language-server',
    'SOQL Language Server',
    serverOptions,
    clientOptions
  );
  client.registerFeature(new QueryValidationFeature());

  // Start the client. This will also launch the server
  client.start();

  await client.onReady().then(() => {
    client.onRequest(RequestTypes.RunQuery, async (queryText: string) => {
      try {
        const conn = await workspaceContext.getConnection();
        const queryData = await new QueryRunner(conn).runQuery(queryText, {
          showErrors: false
        });
        return { result: queryData };
      } catch (e) {
        const error = {
          name: e.name,
          errorCode: e.errorCode,
          message: e.message
        };
        return { error };
      }
    });
  });
}

export function stopLanguageClient(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
