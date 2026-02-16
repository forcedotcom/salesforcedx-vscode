/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { WorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { buildDocumentSelector, getBaseClientOptions } from './clientOptions';

export const createLanguageClient = (
  serverPath: string,
  initializationOptions: { workspaceType: WorkspaceType }
): LanguageClient => {
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
    ...getBaseClientOptions(initializationOptions),
    documentSelector: buildDocumentSelector(['file'])
  };

  return new LanguageClient('lwcLanguageServer', 'LWC Language Server', serverOptions, clientOptions);
};
