/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import {
  buildDocumentSelector,
  buildSchemes,
  getBaseClientOptions,
  type VisualforceInitializationOptions
} from './clientOptions';

/** Desktop language client: the server runs as a node child process over IPC. */
export const createLanguageClient = (
  serverPath: string,
  initializationOptions: VisualforceInitializationOptions
): LanguageClient => {
  const serverOptions: ServerOptions = {
    run: { module: serverPath, transport: TransportKind.ipc },
    debug: {
      module: serverPath,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6004'] }
    }
  };

  const clientOptions: LanguageClientOptions = {
    ...getBaseClientOptions(initializationOptions),
    documentSelector: buildDocumentSelector(buildSchemes())
  };

  return new LanguageClient('visualforce', 'Visualforce Language Server', serverOptions, clientOptions);
};
