/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Browser-specific version that extends BaseServer
// Overrides connection creation and adds browser-specific logic for web mode
import {
  createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
  Connection
} from 'vscode-languageserver/browser';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { BaseServer } from './baseServer';

export default class Server extends BaseServer {
  protected createConnection(): Connection {
    // In a web worker, use globalThis (which is self in worker context)
    return createConnection(new BrowserMessageReader(globalThis), new BrowserMessageWriter(globalThis));
  }

  /**
   * Override to add browser-specific re-indexing logic when LWC files are added after delayed initialization.
   * In web mode only the opened document is synced, so when any LWC file is opened (.html, .js, .ts under /lwc/)
   * we re-run the indexer so findFiles runs again and picks up downloaded components (memfs walk returns current files).
   */
  protected onDidOpen(changeEvent: { document: TextDocument }): void {
    super.onDidOpen(changeEvent);

    const uri = changeEvent.document.uri.toLowerCase();
    const isLwcFile = /\/lwc\/[^/]+\/[^/]+\.(html|js|ts)$/.test(uri);
    if (isLwcFile) {
      void this.reindexComponents();
    }
  }
}
