/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common';
import { code2ProtocolConverter } from '@salesforce/salesforcedx-utils-vscode';
import { Uri, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient/browser';

const protocol2CodeConverter = (value: string) => Uri.parse(value);

export const createLanguageClient = (
  serverPath: string,
  initializationOptions: { workspaceType: WorkspaceType }
): LanguageClient => {
  // Browser mode: use web worker
  // Create a web worker for the language server
  const worker = new Worker(serverPath);

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: 'html', scheme: 'file' },
      { language: 'javascript', scheme: 'file' },
      { language: 'typescript', scheme: 'file' },
      { language: 'json', scheme: 'file' },
      { language: 'xml', scheme: 'file' }
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
    initializationOptions,
    uriConverters: {
      code2Protocol: code2ProtocolConverter,
      protocol2Code: protocol2CodeConverter
    }
  };

  // Browser LanguageClient constructor: (id, name, clientOptions, worker)
  return new LanguageClient('lwcLanguageServer', 'LWC Language Server', clientOptions, worker);
};
