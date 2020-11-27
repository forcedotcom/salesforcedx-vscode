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
import { CompletionItemKind, ExtensionContext, workspace } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';
import { QueryRunner } from '../editor/queryRunner';

import ProtocolCompletionItem from 'vscode-languageclient/lib/protocolCompletionItem';
import { retrieveSObject, retrieveSObjects, withSFConnection } from '../sfdx';

let client: LanguageClient;

export function clearDiagnostics(): void {
  client?.diagnostics?.clear();
}

export async function startLanguageClient(
  extensionContext: ExtensionContext
): Promise<void> {
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

        return expandPlaceholders(items);
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
  client.registerFeature(new QueryValidationFeature());

  // Start the client. This will also launch the server
  client.start();

  await client.onReady();
  client.onRequest(RequestTypes.RunQuery, async (queryText: string) => {
    try {
      return await withSFConnection(async conn => {
        const queryData = await new QueryRunner(conn).runQuery(queryText, {
          showErrors: false
        });
        return { result: queryData };
      });
    } catch (e) {
      // NOTE: The return value must be serializable, for JSON-RPC.
      // Thus we cannot include the exception object as-is
      return {
        error: {
          name: e.name,
          errorCode: e.errorCode,
          message: e.message
        }
      };
    }
  });
}

export function stopLanguageClient(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

async function expandPlaceholders(
  completionItems: ProtocolCompletionItem[]
): Promise<ProtocolCompletionItem[]> {
  // Expand SObject names
  const sobjectsIdx = completionItems.findIndex(
    item => item.label === '__SOBJECTS_PLACEHOLDER'
  );
  if (sobjectsIdx >= 0) {
    const sobjectItems = (await retrieveSObjects()).map(objName => {
      const item = new ProtocolCompletionItem(objName);
      item.kind = CompletionItemKind.Class;
      return item;
    });

    completionItems.splice(sobjectsIdx, 1, ...sobjectItems);
  }

  //  Expand SObject fields
  const SOBJECT_FIELDS_PLACEHOLDER = /__SOBJECT_FIELDS_PLACEHOLDER:(\w+)/;
  const sobjectFieldsIdx = completionItems.findIndex(item =>
    SOBJECT_FIELDS_PLACEHOLDER.test(item.label)
  );
  if (sobjectFieldsIdx >= 0) {
    const m = completionItems[sobjectFieldsIdx].label.match(
      SOBJECT_FIELDS_PLACEHOLDER
    );

    if (m) {
      const objName = m[1];
      const objMetadata = await retrieveSObject(objName);
      const sobjectFields = objMetadata.fields.reduce((fieldItems, field) => {
        fieldItems.push(newFieldCompletionItem(field.name));

        if (field.relationshipName) {
          fieldItems.push(
            newFieldCompletionItem(
              `${field.relationshipName} \(${field.referenceTo}\)`,
              CompletionItemKind.Class,
              field.relationshipName + '.'
            )
          );
        }

        return fieldItems;
      }, [] as ProtocolCompletionItem[]);
      completionItems.splice(sobjectFieldsIdx, 1, ...sobjectFields);
    }
  }

  return completionItems;
}

function newFieldCompletionItem(
  label: string,
  kind: CompletionItemKind = CompletionItemKind.Field,
  insertText?: string
): ProtocolCompletionItem {
  const item = new ProtocolCompletionItem(label);
  item.kind = kind;
  item.insertText = insertText;
  return item;
}
