/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Browser-specific version that extends BaseServer
// Overrides connection creation and adds browser-specific logic for web mode
import { scheduleReinitialization } from '@salesforce/salesforcedx-lightning-lsp-common';
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
   * In web mode only the opened document is synced, so when a new .js/.ts is opened (e.g. sibling of .html)
   * we must re-run the indexer so the component is available for go-to-definition.
   */
  protected async onDidOpen(changeEvent: { document: TextDocument }): Promise<{ isLwcPath: boolean }> {
    const { isLwcPath } = await super.onDidOpen(changeEvent);

    if (this.isDelayedInitializationComplete && isLwcPath && this.componentIndexer) {
      const uri = changeEvent.document.uri.toLowerCase();
      const isComponentImpl = uri.endsWith('.js') || uri.endsWith('.ts');
      if (isComponentImpl) {
        void scheduleReinitialization(this.fileSystemProvider, () => this.reindexComponents());
      }
    } else if (!this.isDelayedInitializationComplete && isLwcPath && this.componentIndexer) {
      const componentCount = this.componentIndexer.getCustomData().length;
      if (componentCount === 0) {
        void scheduleReinitialization(this.fileSystemProvider, () => this.performDelayedInitialization());
      }
    }

    return { isLwcPath };
  }
}
