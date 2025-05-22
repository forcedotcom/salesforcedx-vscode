/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { code2ProtocolConverter } from '@salesforce/salesforcedx-utils-vscode';
import { Uri, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

const protocol2CodeConverter = (value: string) => Uri.parse(value);

export const createLanguageClient = (serverPath: string): LanguageClient => {
  // Setup the language server
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6030'] };
  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverPath, transport: TransportKind.ipc },
    debug: {
      module: serverPath,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: 'html', scheme: 'file' },
      { language: 'javascript', scheme: 'file' },
      { language: 'typescript', scheme: 'file' }
    ],
    synchronize: {
      fileEvents: [
        workspace.createFileSystemWatcher('**/*.resource'),
        workspace.createFileSystemWatcher('**/labels/CustomLabels.labels-meta.xml'),
        workspace.createFileSystemWatcher('**/staticresources/*.resource-meta.xml'),
        workspace.createFileSystemWatcher('**/contentassets/*.asset-meta.xml'),
        workspace.createFileSystemWatcher('**/lwc/*/*.js'),
        workspace.createFileSystemWatcher('**/modules/*/*/*.js'),
        workspace.createFileSystemWatcher('**/modules/*/*/*.ts'),
        // need to watch for directory deletions as no events are created for contents or deleted directories
        workspace.createFileSystemWatcher('**/', false, true, false)
      ]
    },
    uriConverters: {
      code2Protocol: code2ProtocolConverter,
      protocol2Code: protocol2CodeConverter
    }
  };

  return new LanguageClient('lwcLanguageServer', 'LWC Language Server', serverOptions, clientOptions);
};
