/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Browser-specific version that extends BaseServer
// Overrides connection creation and adds browser-specific logic for web mode
import { getLanguageService } from 'vscode-html-languageservice';
import {
  createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
  Connection
} from 'vscode-languageserver/browser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AuraDataProvider } from './auraDataProvider';
import { BaseServer } from './baseServer';
import ComponentIndexer from './componentIndexer';
import { LWCDataProvider } from './lwcDataProvider';

export default class Server extends BaseServer {
  protected createConnection(): Connection {
    // In a web worker, use globalThis (which is self in worker context)
    return createConnection(new BrowserMessageReader(globalThis), new BrowserMessageWriter(globalThis));
  }

  /**
   * Re-run only the component indexer and refresh data providers.
   * Used when new LWC .js/.ts files are opened after delayed init (e.g. in browser when sibling is opened).
   */
  private async reindexComponents(): Promise<void> {
    if (!this.componentIndexer) {
      return;
    }
    this.componentIndexer = new ComponentIndexer({
      workspaceRoot: this.workspaceRoots[0],
      fileSystemAccessor: this.fileSystemAccessor,
      workspaceType: this.workspaceType,
      workspaceFolderUri: this.workspaceFolders[0]?.uri
    });
    await this.componentIndexer.init();
    this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
    this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
    this.languageService = getLanguageService({
      customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
      useDefaultDataProvider: false
    });
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
