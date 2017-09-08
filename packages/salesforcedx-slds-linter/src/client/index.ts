/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { nls } from '../messages';

import {
  commands,
  ExtensionContext,
  window
} from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TextEdit,
  TransportKind
} from 'vscode-languageclient';

export function createLanguageServer(
  context: ExtensionContext
): LanguageClient {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join(
      'node_modules',
      '@salesforce',
      'salesforcedx-slds-linter',
      'out',
      'src',
      'server',
      'index.js'
    )
  );
  // The debug options for the server
  const debugOptions = { execArgv: ['--nolazy', '--debug=6009'] };

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

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: ['plaintext', 'html'],
    synchronize: {
      // Synchronize the setting section 'sldsLanguageServer' to the server
      configurationSection: 'sldsLanguageServer'
    }
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    'sldsLanguageServer',
    'SLDS Language Server',
    serverOptions,
    clientOptions
  );

  function applyTextEdit(uri: string, edits: TextEdit[]) {
    const textEditor = window.activeTextEditor;
    if (textEditor && textEditor.document.uri.toString() === uri) {
      textEditor
        .edit(mutator => {
          for (const edit of edits) {
            mutator.replace(
              client.protocol2CodeConverter.asRange(edit.range),
              edit.newText
            );
          }
        })
        .then(success => {
          if (!success) {
            window.showErrorMessage(
              nls.localize('fix_error')
            );
          }
        });
    }
  }

  context.subscriptions.push(
    commands.registerCommand('deprecatedClassName', applyTextEdit)
  );

  return client;
}
