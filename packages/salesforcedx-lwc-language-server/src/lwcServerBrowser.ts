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
  normalizePath,
  syncDocumentToTextDocumentsProvider,
  scheduleReinitialization
} from '@salesforce/salesforcedx-lightning-lsp-common';
import { getLanguageService } from 'vscode-html-languageservice';
import {
  createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
  Connection,
  TextDocumentPositionParams,
  Location,
  ShowMessageNotification,
  MessageType
} from 'vscode-languageserver/browser';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { URI } from 'vscode-uri';
import { AuraDataProvider } from './auraDataProvider';
import { BaseServer } from './baseServer';
import ComponentIndexer from './componentIndexer';
import { LWCDataProvider } from './lwcDataProvider';
import { getAllLocations, getClassMemberLocation, getAttribute, Tag } from './tag';
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
    const normalizedPath = normalizePath(URI.parse(uri).fsPath);
    await syncDocumentToTextDocumentsProvider(
      normalizedPath,
      content,
      this.textDocumentsFileSystemProvider,
      this.workspaceRoots
    );

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

    // Perform delayed initialization once file loading has stabilized
    // scheduleReinitialization waits for file count to stabilize (no changes for 1.5 seconds)
    // This ensures all files from bootstrapWorkspaceAwareness are loaded before initialization
    if (!this.isDelayedInitializationComplete) {
      void scheduleReinitialization(this.textDocumentsFileSystemProvider, () => this.performDelayedInitialization());
    } else if (isLwcFile) {
      // Delayed initialization already complete - but if this is an LWC file, we may need to re-index
      // Check if we have any components indexed - if not, delayed init ran too early
      const componentCount = this.componentIndexer.getCustomData().length;

      if (componentCount === 0) {
        // Delayed initialization ran before any LWC files were available
        // Schedule re-initialization to wait for files to accumulate
        // The flag is already false (or will be kept false), so performDelayedInitialization will run
        void scheduleReinitialization(this.textDocumentsFileSystemProvider, () => this.performDelayedInitialization());
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
        } catch {
          // Error during re-indexing - continue silently
        }
      }
    }
  }

  /**
   * Override to add URI scheme conversion for web mode virtual file systems
   */
  public onDefinition(params: TextDocumentPositionParams): Location[] {
    const cursorInfo = this.cursorInfo(params);
    if (!cursorInfo) {
      return [];
    }

    const tag = cursorInfo.tag ? this.componentIndexer.findTagByName(cursorInfo.tag) : null;

    // Use textDocumentsFileSystemProvider in web mode since that's where files are synced
    // After delayed initialization, componentIndexer uses textDocumentsFileSystemProvider
    const fsProvider = this.textDocumentsFileSystemProvider ?? this.fileSystemProvider;

    let result: Location[] = [];
    switch (cursorInfo.type) {
      case 'tag':
        result = tag ? getAllLocations(tag, fsProvider) : [];
        break;

      case 'attributeKey':
        const attr = tag ? getAttribute(tag, cursorInfo.name) : null;
        if (attr?.location) {
          result = [attr.location];
        }
        break;

      case 'dynamicContent':
      case 'dynamicAttributeValue':
        const { uri: dynamicUri } = params.textDocument;
        if (cursorInfo.range) {
          result = [Location.create(dynamicUri, cursorInfo.range)];
        } else {
          const component: Tag | null = this.componentIndexer.findTagByURI(dynamicUri);
          const location = component ? getClassMemberLocation(component, cursorInfo.name) : null;
            if (location) {
              // In web mode, convert file:// URI to match the scheme of the original request (e.g., memfs://)
              const originalScheme = URI.parse(dynamicUri).scheme;
              const locationScheme = URI.parse(location.uri).scheme;
              if (originalScheme !== locationScheme && originalScheme !== 'file') {
                // Replace the scheme to match the original request
                const adjustedUri = location.uri.replace(`${locationScheme}://`, `${originalScheme}://`);
                result = [Location.create(adjustedUri, location.range)];
            } else {
              result = [location];
            }
          }
        }
        break;
    }

    return result;
  }

  /**
   * Override TypeScript configuration to add browser-specific logging
   */
  protected async configureTypeScriptSupport(): Promise<void> {
    const hasTsEnabled = await this.isTsSupportEnabled();
    Logger.info(`[LWC Server Browser] TypeScript support enabled: ${hasTsEnabled}`);
    if (hasTsEnabled) {
      Logger.info('[LWC Server Browser] Configuring project for TypeScript...');
      try {
        this.context.setConnection(this.connection);
        await this.context.configureProjectForTs();
        Logger.info('[LWC Server Browser] Updating tsconfig.sfdx.json path mappings...');
        await this.componentIndexer.updateSfdxTsConfigPath(this.connection);
        Logger.info('[LWC Server Browser] TypeScript configuration complete');
      } catch (tsConfigError: unknown) {
        // Log error but don't crash the server - tsconfig generation is optional
        Logger.error(
          `[LWC Server Browser] Failed to configure TypeScript support: ${tsConfigError instanceof Error ? tsConfigError.message : String(tsConfigError)}`,
          tsConfigError instanceof Error ? tsConfigError : undefined
        );
        Logger.info('[LWC Server Browser] Continuing without TypeScript configuration');
      }
    } else {
      Logger.info('[LWC Server Browser] TypeScript support is disabled, skipping tsconfig generation');
    }
  }

  /**
   * Override to add conditional completion - only mark complete if components were found
   */
  protected async performDelayedInitialization(): Promise<void> {
    if (this.isDelayedInitializationComplete) {
      return;
    }

    try {
      // Initialize workspace context now that essential files are loaded via onDidOpen
      // scheduleReinitialization waits for file loading to stabilize, so all files should be available
      this.context.fileSystemProvider = this.textDocumentsFileSystemProvider;
      this.context.initialize(this.workspaceType);

      // Clear namespace cache to force re-detection now that files are synced
      // This ensures directoryExists can infer directory existence from file paths
      this.context.clearNamespaceCache();

      // Re-initialize component indexer with updated FileSystemProvider
      this.componentIndexer = new ComponentIndexer({
        workspaceRoot: this.workspaceRoots[0],
        fileSystemProvider: this.textDocumentsFileSystemProvider
      });

      await this.componentIndexer.init();

      const componentCount = this.componentIndexer.getCustomData().length;

      // Update data providers to use the new indexer
      this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
      this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
      await TypingIndexer.create({ workspaceRoot: this.workspaceRoots[0] }, this.textDocumentsFileSystemProvider, this.connection);
      this.languageService = getLanguageService({
        customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
        useDefaultDataProvider: false
      });

      // Only mark as complete if we actually indexed components
      // If 0 components, keep the flag false so scheduleReinitialization can trigger again when more files arrive
      if (componentCount > 0) {
        this.isDelayedInitializationComplete = true;
      }

      // Configure TypeScript support now that files are loaded and context is initialized
      // Use base class implementation but add browser-specific logging
      await this.configureTypeScriptSupport();

      // send notification that delayed initialization is complete (only if we have components)
      if (componentCount > 0) {
        void this.connection.sendNotification(ShowMessageNotification.type, {
          type: MessageType.Info,
          message: 'LWC Language Server is ready'
        });
      }
    } catch (error: unknown) {
      Logger.error(
        `Error during delayed initialization: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }
}
