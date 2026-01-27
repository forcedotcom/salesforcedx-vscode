/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Browser-specific version that extends BaseServer
// Overrides connection creation and adds browser-specific logic for web mode
import {
  Logger,
  syncDocumentToTextDocumentsProvider,
  scheduleReinitialization,
  normalizePath
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';
import { getLanguageService } from 'vscode-html-languageservice';
import {
  createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
  Connection,
  ShowMessageNotification,
  MessageType
} from 'vscode-languageserver/browser';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { AuraDataProvider } from './auraDataProvider';
import { BaseServer } from './baseServer';
import ComponentIndexer from './componentIndexer';
import { LWCDataProvider } from './lwcDataProvider';
import TypingIndexer from './typingIndexer';

export default class Server extends BaseServer {
  protected createConnection(): Connection {
    // In a web worker, use globalThis (which is self in worker context)
    return createConnection(new BrowserMessageReader(globalThis), new BrowserMessageWriter(globalThis));
  }

  /**
   * Override to add browser-specific re-indexing logic when LWC files are added after delayed initialization
   */
  protected async onDidOpen(changeEvent: { document: TextDocument }): Promise<void> {
    const { document } = changeEvent;
    const uri = document.uri;
    const content = document.getText();

    // Normalize URI to fsPath before syncing (entry point for path normalization)
    // Use fileSystemProvider.uriToNormalizedPath to handle both file:// and memfs:// schemes correctly
    const normalizedPath = this.fileSystemProvider.uriToNormalizedPath(uri);

    await syncDocumentToTextDocumentsProvider(normalizedPath, content, this.fileSystemProvider, this.workspaceRoots);

    // Check if this is an LWC file (template or JavaScript)
    // Use path-based check as fallback since context methods might not work before initialization
    const isLwcPath =
      normalizedPath.includes('/lwc/') &&
      (normalizedPath.endsWith('.html') || normalizedPath.endsWith('.js') || normalizedPath.endsWith('.ts'));

    let isLwcFile = false;
    if (isLwcPath) {
      isLwcFile = true;
    } else if (this.isDelayedInitializationComplete) {
      // Only check context methods if delayed init is complete (context is initialized)
      try {
        isLwcFile = (await this.context.isLWCTemplate(document)) || (await this.context.isLWCJavascript(document));
      } catch {
        // Error checking if LWC file - continue silently
      }
    }

    // If this is an LWC file and delayed initialization hasn't completed yet,
    // clear namespace cache to ensure namespace roots are recalculated as files are discovered.
    // Once delayed initialization is complete, namespace roots are stable and don't need recalculation
    // on every file open - they only change when directory structure changes.
    if (isLwcFile && !this.isDelayedInitializationComplete && this.context) {
      this.context.clearNamespaceCache();
    }

    // Perform delayed initialization once file loading has stabilized
    // scheduleReinitialization waits for file count to stabilize (no changes for 1.5 seconds)
    // This ensures all files from bootstrapWorkspaceAwareness are loaded before initialization
    if (!this.isDelayedInitializationComplete) {
      void scheduleReinitialization(this.fileSystemProvider, () => this.performDelayedInitialization());
    } else if (this.workspaceType === 'SFDX' && !this.componentIndexer) {
      // If delayed initialization was skipped because sfdx-project.json wasn't loaded,
      // check if this is the file being opened and re-trigger initialization
      const sfdxProjectPath = normalizePath(path.join(this.workspaceRoots[0], 'sfdx-project.json'));
      if (normalizedPath === sfdxProjectPath) {
        Logger.info('[onDidOpen] sfdx-project.json opened, re-triggering delayed initialization');
        void scheduleReinitialization(this.fileSystemProvider, () => this.performDelayedInitialization());
      }
    } else if (isLwcFile && this.componentIndexer) {
      // Delayed initialization already complete - but if this is an LWC file, we may need to re-index
      // Check if we have any components indexed - if not, delayed init ran too early
      const componentCount = this.componentIndexer.getCustomData().length;

      if (componentCount === 0) {
        // Delayed initialization ran before any LWC files were available
        void scheduleReinitialization(this.fileSystemProvider, () => this.performDelayedInitialization());
      } else {
        // We have some components, but this might be a new one
        // Re-index to pick up any newly added files
        try {
          await this.componentIndexer.init();
          const afterCount = this.componentIndexer.getCustomData().length;

          if (afterCount > componentCount) {
            // New components were added - update language service
            this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
            this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
            this.languageService = getLanguageService({
              customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
              useDefaultDataProvider: false
            });
          }
        } catch (error) {
          Logger.error(
            `[LWC Server Browser] onDidOpen: Error during re-indexing: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : undefined
          );
        }
      }
    }
  }

  /**
   * Override to add conditional completion - only mark complete if components were found
   */
  protected async performDelayedInitialization(): Promise<void> {
    if (this.isDelayedInitializationComplete) {
      return;
    }

    // Prevent concurrent initialization attempts - check BEFORE any logging
    if (this.isInitializing) {
      Logger.info('[performDelayedInitialization] Already initializing, skipping duplicate call');
      return;
    }

    this.isInitializing = true;
    Logger.info('[performDelayedInitialization] Starting delayed initialization (guard passed)');

    try {
      // Initialize workspace context now that essential files are loaded via onDidOpen
      // scheduleReinitialization waits for file loading to stabilize, so all files should be available
      this.context.initialize(this.workspaceType);

      // Clear namespace cache to force re-detection now that files are synced
      // This ensures directoryExists can infer directory existence from file paths
      this.context.clearNamespaceCache();

      // For SFDX workspaces, wait for sfdx-project.json to be loaded before initializing component indexer
      if (this.workspaceType === 'SFDX') {
        const sfdxProjectPath = normalizePath(path.join(this.workspaceRoots[0], 'sfdx-project.json'));
        let attempts = 0;
        const maxAttempts = 50; // Wait up to 5 seconds (50 * 100ms)

        while (attempts < maxAttempts && !this.fileSystemProvider.fileExists(sfdxProjectPath)) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;

          // Log every 10 attempts to see if files are being added
          if (attempts % 10 === 0) {
            const currentFileCount = this.fileSystemProvider.getAllFileUris().length;
            const currentMatching = this.fileSystemProvider
              .getAllFileUris()
              .filter(uri => uri.includes('sfdx-project.json'));
            Logger.info(
              `[performDelayedInitialization] Attempt ${attempts}/${maxAttempts}: ` +
                `Total files: ${currentFileCount}, ` +
                `Files with 'sfdx-project.json': ${currentMatching.length}, ` +
                `fileExists(${sfdxProjectPath}): ${this.fileSystemProvider.fileExists(sfdxProjectPath)}`
            );
          }
        }

        // Final check and logging
        const finalFileCount = this.fileSystemProvider.getAllFileUris().length;
        const finalMatching = this.fileSystemProvider.getAllFileUris().filter(uri => uri.includes('sfdx-project.json'));
        Logger.info(
          '[performDelayedInitialization] Final state: ' +
            `Total files: ${finalFileCount}, ` +
            `Files with 'sfdx-project.json': ${finalMatching.length}, ` +
            `fileExists(${sfdxProjectPath}): ${this.fileSystemProvider.fileExists(sfdxProjectPath)}`
        );

        if (!this.fileSystemProvider.fileExists(sfdxProjectPath)) {
          Logger.info(
            `[performDelayedInitialization] sfdx-project.json not found after ${maxAttempts * 100}ms. ` +
              'Component indexer initialization will be retried when the file is loaded via onDidOpen.'
          );
          // Don't mark as complete - allow re-triggering when sfdx-project.json is loaded
          this.isInitializing = false;
          return;
        }
      }

      // Re-initialize component indexer (files are now in fileSystemProvider)
      this.componentIndexer = new ComponentIndexer({
        workspaceRoot: this.workspaceRoots[0],
        fileSystemProvider: this.fileSystemProvider,
        workspaceType: this.workspaceType
      });

      await this.componentIndexer.init();

      const componentCount = this.componentIndexer.getCustomData().length;
      Logger.info(
        `[performDelayedInitialization] Component indexing complete: ${componentCount} components, ` +
          `tags.size=${this.componentIndexer.tags.size}, isDelayedInitializationComplete will be set to: ${componentCount > 0}`
      );

      // Update data providers to use the new indexer
      this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
      this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
      await TypingIndexer.create({ workspaceRoot: this.workspaceRoots[0] }, this.fileSystemProvider, this.connection);
      this.languageService = getLanguageService({
        customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
        useDefaultDataProvider: false
      });

      // Only mark as complete if we actually indexed components
      // If 0 components, keep the flag false so scheduleReinitialization can trigger again when more files arrive
      if (componentCount > 0) {
        this.isDelayedInitializationComplete = true;
        Logger.info('[performDelayedInitialization] Marked isDelayedInitializationComplete = true');
      } else {
        Logger.info(
          '[performDelayedInitialization] componentCount is 0, keeping isDelayedInitializationComplete = false ' +
            'to allow reinitialization when more files are loaded'
        );
      }

      // Configure TypeScript support now that files are loaded and context is initialized
      await this.configureTypeScriptSupport();

      // send notification that delayed initialization is complete (only if we have components)
      if (componentCount > 0) {
        Logger.info('[performDelayedInitialization] Sending "LWC Language Server is ready" notification');
        void this.connection.sendNotification(ShowMessageNotification.type, {
          type: MessageType.Info,
          message: 'LWC Language Server is ready'
        });
        Logger.info('[performDelayedInitialization] Notification sent successfully');
      } else {
        Logger.info(
          '[performDelayedInitialization] Skipping ready notification (componentCount=0, will retry when files are loaded)'
        );
      }
    } catch (error: unknown) {
      Logger.error(
        `Error during delayed initialization: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    } finally {
      // Always reset isInitializing, even if initialization didn't complete successfully
      // This allows retries when more files are loaded
      this.isInitializing = false;
    }
  }
}
