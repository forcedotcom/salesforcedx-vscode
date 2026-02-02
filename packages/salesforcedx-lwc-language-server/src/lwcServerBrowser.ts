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
   * Override to add browser-specific re-indexing logic when LWC files are added after delayed initialization
   */
  protected async onDidOpen(changeEvent: { document: TextDocument }): Promise<{ isLwcPath: boolean }> {
    const { isLwcPath } = await super.onDidOpen(changeEvent);

    // Delayed initialization already complete - but if this is an LWC file, we may need to re-index
    // Check if we have any components indexed - if not, delayed init ran too early
    if (this.isDelayedInitializationComplete && isLwcPath && this.componentIndexer) {
      const componentCount = this.componentIndexer.getCustomData().length;
      if (componentCount === 0) {
        void scheduleReinitialization(this.fileSystemProvider, () => this.performDelayedInitialization());
      }
    }

    return { isLwcPath };
  }
}
