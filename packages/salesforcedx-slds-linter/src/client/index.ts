/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import { commands, Disposable, ExtensionContext, window, workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  SettingMonitor,
  TextEdit,
  TransportKind
} from 'vscode-languageclient';

export function createLanguageServer(
  context: ExtensionContext
): LanguageClient {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join(
      'node_modules/@salesforce/salesforcedx-slds-linter/out/src',
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
      // Synchronize the setting section 'languageServerExample' to the server
      configurationSection: 'sldsLanguageServer',
      // Notify the server about file changes to '.clientrc files contain in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    }
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    'sldsLanguageServer',
    'SLDS Language Server',
    serverOptions,
    clientOptions
  );

  function applyTextEdit(uri: string, documentVersion: number, edits: TextEdit) {
    const textEditor = window.activeTextEditor;
    console.log('Hello');
    if (textEditor) {
      textEditor.edit(mutator => {
        mutator.replace(client.protocol2CodeConverter.asRange(edits.range), edits.newText);
      }
      );
    }
  }

  context.subscriptions.push(commands.registerCommand('deprecatedClassName', applyTextEdit));

  return client;
}
