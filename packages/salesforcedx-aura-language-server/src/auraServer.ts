/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  toResolvedPath,
  Logger,
  TagInfo,
  FileSystemDataProvider,
  FileStat,
  syncDocumentToTextDocumentsProvider,
  scheduleReinitialization,
  normalizePath,
  NormalizedPath,
  WorkspaceType
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';

import { getLanguageService, LanguageService, CompletionList } from 'vscode-html-languageservice';
import {
  createConnection,
  Connection,
  TextDocuments,
  TextDocumentChangeEvent,
  InitializeParams,
  InitializeResult,
  TextDocumentPositionParams,
  CompletionItem,
  DidChangeWatchedFilesParams,
  Hover,
  Location,
  ShowMessageNotification,
  MessageType,
  CompletionParams,
  FileChangeType,
  NotificationType,
  Definition,
  TextDocumentSyncKind,
  ReferenceParams
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import URI from 'vscode-uri';
import AuraIndexer from './aura-indexer/indexer';
import {
  getAuraBindingTemplateDeclaration,
  getAuraBindingValue,
  isAuraWatchedDirectory,
  isAuraRootDirectoryCreated
} from './auraUtils';
import { AuraWorkspaceContext } from './context/auraContext';
import { setIndexer, getAuraTagProvider } from './markup/auraTags';
import { nls } from './messages';
import {
  startServer,
  addFile,
  delFile,
  onCompletion,
  onHover,
  onDefinition,
  onTypeDefinition,
  onReferences,
  onSignatureHelp,
  init
} from './tern-server/ternServer';

interface TagParams {
  taginfo: TagInfo;
}

const tagAdded: NotificationType<TagParams> = new NotificationType<TagParams>('salesforce/tagAdded');
const tagDeleted: NotificationType<string> = new NotificationType<string>('salesforce/tagDeleted');
const tagsCleared: NotificationType<void> = new NotificationType<void>('salesforce/tagsCleared');

export default class Server {
  public readonly connection: Connection = createConnection();
  public readonly documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  private context!: AuraWorkspaceContext;
  private workspaceRoots!: NormalizedPath[];
  private htmlLS!: LanguageService;
  private auraIndexer!: AuraIndexer;
  public fileSystemProvider: FileSystemDataProvider;
  private isDelayedInitializationComplete = false;
  private isIndexerInitialized = false;
  private hasDetectedAuraFiles = false;
  private workspaceType: WorkspaceType;

  constructor() {
    this.fileSystemProvider = new FileSystemDataProvider();
    this.connection.onInitialize(params => this.onInitialize(params));
    this.connection.onCompletion(params => this.onCompletion(params));
    this.connection.onCompletionResolve(item => this.onCompletionResolve(item));
    this.connection.onHover(params => this.onHover(params));
    this.connection.onDefinition(params => this.onDefinition(params));
    this.connection.onTypeDefinition(params => this.onTypeDefinition(params));
    this.connection.onDidChangeWatchedFiles(params => void this.onDidChangeWatchedFiles(params));
    this.connection.onRequest('salesforce/listComponents', () => this.onListComponents());
    this.connection.onRequest('salesforce/listNamespaces', () => this.onListNamespaces());
    this.workspaceType = 'UNKNOWN';
    this.documents.listen(this.connection);
  }

  public onInitialize(params: InitializeParams): InitializeResult {
    const { workspaceFolders } = params;
    // Normalize workspaceRoots at entry point to ensure all paths are consistent
    // This ensures all downstream code receives normalized paths
    this.workspaceRoots = (workspaceFolders ?? []).map(folder =>
      normalizePath(path.resolve(URI.parse(folder.uri).fsPath))
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    this.workspaceType = params.initializationOptions?.workspaceType ?? 'UNKNOWN';
    try {
      if (this.workspaceRoots.length === 0) {
        Logger.warn(nls.localize('no_workspace_found_message'));
        return { capabilities: {} };
      }

      // Set up document event handlers
      this.documents.onDidOpen(changeEvent => this.onDidOpen(changeEvent));
      this.documents.onDidChangeContent(changeEvent => this.onDidChangeContent(changeEvent));
      this.documents.onDidSave(changeEvent => this.onDidSave(changeEvent));

      // Populate FileSystemDataProvider with static resources from initializationOptions
      // These are static framework files needed for Tern server initialization
      this.populateFileSystemProvider(params);

      // Note: Workspace context initialization is delayed until performDelayedInitialization()
      // to ensure all essential files (like sfdx-project.json) are loaded via onDidOpen events

      this.htmlLS = getLanguageService();
      this.htmlLS.setDataProviders(true, [getAuraTagProvider()]);

      const capabilities = {
        textDocumentSync: {
          openClose: true,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          change: 1 as TextDocumentSyncKind
        },
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.', ':', '<', '"', '=', '/', '>']
        },
        workspace: {
          workspaceFolders: {
            supported: true
          }
        },
        signatureHelpProvider: {
          triggerCharacters: ['(']
        },
        referencesProvider: true,
        hoverProvider: true,
        definitionProvider: true,
        typeDefinitionProvider: true
      };

      return {
        capabilities
      };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(nls.localize('initialization_unsuccessful_message', errorMessage));
    }
  }

  private isFileStat(obj: unknown): obj is FileStat {
    return typeof obj === 'object' && obj !== null && 'type' in obj && 'exists' in obj;
  }

  private populateFileSystemProvider(params: InitializeParams) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (params.initializationOptions?.fileSystemProvider) {
      // Reconstruct the FileSystemDataProvider from serialized data
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const serializedProvider = params.initializationOptions.fileSystemProvider;

      if (typeof serializedProvider !== 'object' || serializedProvider === null) {
        throw new Error(nls.localize('invalid_filesystem_provider_message'));
      }

      // Restore the data from the serialized object
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (serializedProvider.fileContents && typeof serializedProvider.fileContents === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        for (const [uri, content] of Object.entries(serializedProvider.fileContents)) {
          if (typeof content === 'string') {
            this.fileSystemProvider.updateFileContent(uri, content);
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (serializedProvider.directoryListings && typeof serializedProvider.directoryListings === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        for (const [uri, entries] of Object.entries(serializedProvider.directoryListings)) {
          if (Array.isArray(entries)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            this.fileSystemProvider.updateDirectoryListing(uri, entries);
          }
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (serializedProvider.fileStats && typeof serializedProvider.fileStats === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        for (const [uri, stat] of Object.entries(serializedProvider.fileStats)) {
          if (this.isFileStat(stat)) {
            this.fileSystemProvider.updateFileStat(uri, stat);
          }
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (serializedProvider.workspaceConfig && typeof serializedProvider.workspaceConfig === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        this.fileSystemProvider.updateWorkspaceConfig(serializedProvider.workspaceConfig);
      }
    } else {
      throw new Error(nls.localize('no_filesystem_provider_message'));
    }
  }

  private setupIndexerEvents(): void {
    this.auraIndexer.eventEmitter.on('set', (tag: TagInfo) => {
      void this.connection.sendNotification(tagAdded, { taginfo: tag });
    });

    this.auraIndexer.eventEmitter.on('delete', (tag: string) => {
      void this.connection.sendNotification(tagDeleted, tag);
    });

    this.auraIndexer.eventEmitter.on('clear', () => {
      void this.connection.sendNotification(tagsCleared, undefined);
    });
  }

  private startIndexing(): void {
    setTimeout(() => {
      void (async () => {
        void this.connection.sendNotification('salesforce/indexingStarted');
        await this.auraIndexer.configureAndIndex();
        void this.connection.sendNotification('salesforce/indexingEnded');
      })();
    }, 0);
  }

  public async onCompletion(completionParams: CompletionParams): Promise<CompletionList> {
    const document = this.getDocumentIfReady(completionParams.textDocument.uri);
    if (!document) {
      return { isIncomplete: false, items: [] };
    }

    try {
      const isAuraMarkup = await this.context.isAuraMarkup(document);

      if (isAuraMarkup) {
        const htmlDocument = this.htmlLS.parseHTMLDocument(document);

        const list = this.htmlLS.doComplete(document, completionParams.position, htmlDocument, {
          isSfdxProject: this.context.type === 'SFDX',
          useAttributeValueQuotes: true
        });
        return list;
      }

      const isAuraJavascript = await this.context.isAuraJavascript(document);

      if (isAuraJavascript) {
        const result = await onCompletion(completionParams, this.fileSystemProvider);
        return result;
      }

      return { isIncomplete: false, items: [] };
    } catch {
      return { isIncomplete: false, items: [] };
    }
  }

  public onCompletionResolve(item: CompletionItem): CompletionItem {
    return item;
  }

  public async onHover(textDocumentPosition: TextDocumentPositionParams): Promise<Hover | null> {
    if (!textDocumentPosition?.textDocument || !textDocumentPosition.position) {
      return null;
    }

    const document = this.getDocumentIfReady(textDocumentPosition.textDocument.uri);
    if (!document) {
      return null;
    }

    try {
      const isAuraMarkup = await this.context.isAuraMarkup(document);

      if (isAuraMarkup) {
        if (!this.isDelayedInitializationComplete) {
          return {
            contents: nls.localize('server_initializing_message')
          };
        }
        const htmlDocument = this.htmlLS.parseHTMLDocument(document);
        const hover = this.htmlLS.doHover(document, textDocumentPosition.position, htmlDocument);
        return hover;
      }

      const isAuraJavascript = await this.context.isAuraJavascript(document);

      if (isAuraJavascript) {
        if (!this.isDelayedInitializationComplete) {
          return {
            contents: nls.localize('server_initializing_message')
          };
        }
        const result = await onHover(textDocumentPosition, this.fileSystemProvider);
        return result;
      }

      return null;
    } catch (error: unknown) {
      Logger.error(`Error in onHover: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  public async onTypeDefinition(textDocumentPosition: TextDocumentPositionParams): Promise<Definition | null> {
    const document = this.documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
      return null;
    }

    try {
      const isAuraJavascript = await this.context.isAuraJavascript(document);

      if (isAuraJavascript) {
        const result = await onTypeDefinition(textDocumentPosition, this.fileSystemProvider);
        return result ?? null;
      }

      return null;
    } catch {
      return null;
    }
  }

  private findJavascriptProperty(
    valueProperty: string,
    textDocumentPosition: TextDocumentPositionParams
  ): Location | null {
    // couldn't find it within the markup file, try looking for it as a javascript property
    const fsPath = URI.parse(textDocumentPosition.textDocument.uri).fsPath;
    const parsedPath = path.parse(fsPath);
    const componentName = parsedPath.name;
    const namespace = path.basename(path.dirname(parsedPath.dir));
    const tag = this.auraIndexer.getAuraByTag(`${namespace}:${componentName}`);

    if (tag) {
      // aura tag doesn't contain controller methods yet
      // but, if its not a v.value, its probably fine to just open the controller file
      const controllerPath = path.join(parsedPath.dir, `${componentName}Controller.js`);

      const result = {
        uri: URI.file(controllerPath).toString(),
        range: {
          start: {
            character: 0,
            line: 1
          },
          end: {
            character: 0,
            line: 1
          }
        }
      };
      return result;
    }

    return null;
  }

  public async onDefinition(textDocumentPosition: TextDocumentPositionParams): Promise<Location | null> {
    const document = this.getDocumentIfReady(textDocumentPosition.textDocument.uri);
    if (!document) {
      return null;
    }

    try {
      const isAuraMarkup = await this.context.isAuraMarkup(document);

      if (isAuraMarkup) {
        const htmlDocument = this.htmlLS.parseHTMLDocument(document);

        const def = getAuraBindingTemplateDeclaration(document, textDocumentPosition.position, htmlDocument);

        if (def) {
          return def;
        }

        const valueProperty = getAuraBindingValue(document, textDocumentPosition.position, htmlDocument);

        if (valueProperty) {
          const result = this.findJavascriptProperty(valueProperty, textDocumentPosition);
          return result;
        }

        return null;
      }

      const isAuraJavascript = await this.context.isAuraJavascript(document);

      if (isAuraJavascript) {
        const result = await onDefinition(textDocumentPosition, this.fileSystemProvider);
        return result ?? null;
      }

      return null;
    } catch {
      return null;
    }
  }

  public async onReferences(reference: ReferenceParams): Promise<Location[] | null> {
    const document = this.getDocumentIfReady(reference.textDocument.uri);

    return document && (await this.context.isAuraJavascript(document))
      ? ((await onReferences(reference, this.fileSystemProvider)) ?? null)
      : null;
  }

  public async onDidChangeWatchedFiles(change: DidChangeWatchedFilesParams): Promise<void> {
    const changes = change.changes;

    try {
      if (isAuraRootDirectoryCreated(this.context, changes)) {
        this.context.getIndexingProvider('aura')?.resetIndex();
        await this.context.getIndexingProvider('aura')?.configureAndIndex();
        // re-index everything on directory deletions as no events are reported for contents of deleted directories
      } else {
        for (const event of changes) {
          const isWatchedDir = await isAuraWatchedDirectory(this.context, event.uri);
          if (event.type === FileChangeType.Deleted && isWatchedDir) {
            const dir = toResolvedPath(event.uri);
            this.auraIndexer.clearTagsforDirectory(dir, this.context.type === 'SFDX');
          } else {
            const file = toResolvedPath(event.uri);
            if (
              file.endsWith('.app') ||
              file.endsWith('.cmp') ||
              file.endsWith('.intf') ||
              file.endsWith('.evt') ||
              file.endsWith('.lib')
            ) {
              await this.auraIndexer.indexFile(file, this.context.type === 'SFDX');
            }
          }
        }
      }
    } catch (e) {
      void this.connection.sendNotification(ShowMessageNotification.type, {
        type: MessageType.Error,
        message: `Error re-indexing workspace: ${e instanceof Error ? e.message : String(e)}`
      });
    }
  }

  public onListComponents(): string {
    const tags = this.auraIndexer.getAuraTags();
    const result = JSON.stringify([...tags]);
    return result;
  }

  public onListNamespaces(): string {
    const tags = this.auraIndexer.getAuraNamespaces();
    const result = JSON.stringify(tags);
    return result;
  }

  public onDidClose(event: { document: { uri: string } }): void {
    void this.connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
  }

  private async onDidOpen(changeEvent: { document: TextDocument }): Promise<void> {
    const { document } = changeEvent;
    const uri = document.uri;
    const content = document.getText();

    // Normalize URI to fsPath before syncing (entry point for path normalization)
    const normalizedPath = normalizePath(URI.parse(uri).fsPath);
    await syncDocumentToTextDocumentsProvider(normalizedPath, content, this.fileSystemProvider, this.workspaceRoots);

    // Perform delayed initialization once we have documents
    if (!this.isDelayedInitializationComplete) {
      void scheduleReinitialization(this.fileSystemProvider, () => this.performDelayedInitialization());
    }

    // Check if this is an Aura component file and initialize indexer if needed
    // Parse URI to get filename in a cross-platform way (URIs use forward slashes, but path.basename handles both)
    const fileName = path.basename(URI.parse(uri).fsPath);
    if (fileName && this.isAuraComponentFile(fileName)) {
      this.hasDetectedAuraFiles = true;

      if (!this.isIndexerInitialized && this.isDelayedInitializationComplete) {
        void this.initializeIndexer();
      }
    }
  }

  public async onDidChangeContent(changeEvent: TextDocumentChangeEvent<TextDocument>): Promise<void> {
    const { document } = changeEvent;
    const { uri } = document;
    const content = document.getText();

    // Normalize URI to fsPath before syncing (entry point for path normalization)
    const normalizedPath = normalizePath(URI.parse(uri).fsPath);
    await syncDocumentToTextDocumentsProvider(normalizedPath, content, this.fileSystemProvider, this.workspaceRoots);
  }

  public async onDidSave(change: TextDocumentChangeEvent<TextDocument>): Promise<void> {
    const { document } = change;
    const uri = document.uri;
    const content = document.getText();

    // Normalize URI to fsPath before syncing (entry point for path normalization)
    const normalizedPath = normalizePath(URI.parse(uri).fsPath);
    await syncDocumentToTextDocumentsProvider(normalizedPath, content, this.fileSystemProvider, this.workspaceRoots);
  }

  /**
   * Checks if a filename represents an Aura component file
   */
  private isAuraComponentFile(fileName: string): boolean {
    const auraExtensions = ['.cmp', '.app', '.intf', '.evt', '.lib', '.auradoc', '.design', '.tokens'];
    return auraExtensions.some(ext => fileName.endsWith(ext));
  }

  /** Get document if it exists and context is ready for processing */
  private getDocumentIfReady(uri: string): TextDocument | undefined {
    const document = this.documents.get(uri);
    return document ?? undefined;
  }

  /**
   * Initializes the indexer when workspace Aura files are available
   */
  private initializeIndexer(): void {
    if (this.isIndexerInitialized) {
      return;
    }

    try {
      // Initialize indexer and related components
      this.auraIndexer = new AuraIndexer(this.context);
      setIndexer(this.auraIndexer);

      this.setupIndexerEvents();
      this.startIndexing();

      this.isIndexerInitialized = true;
    } catch (error: unknown) {
      throw new Error(
        nls.localize('indexer_initialization_error_message', error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Performs delayed initialization of Tern server and indexer components
   * using the populated fileSystemProvider
   */
  private async performDelayedInitialization(): Promise<void> {
    if (this.isDelayedInitializationComplete) {
      return;
    }

    try {
      // Initialize workspace context now that essential files are loaded via onDidOpen
      if (!this.context) {
        this.context = new AuraWorkspaceContext(this.workspaceRoots, this.fileSystemProvider);
        this.context.initialize(this.workspaceType);
      } else {
        // Update context to use fileSystemProvider for better file access
        this.context.fileSystemProvider = this.fileSystemProvider;
      }

      // Initialize Tern server with original fileSystemProvider (contains Aura resources)
      if (this.context.type === 'CORE_PARTIAL') {
        const corePartialRoot = normalizePath(path.join(this.workspaceRoots[0], '..'));
        await startServer(corePartialRoot, corePartialRoot, this.fileSystemProvider);
      } else {
        await startServer(this.workspaceRoots[0], this.workspaceRoots[0], this.fileSystemProvider);
      }

      // Initialize tern server with original fileSystemProvider (has Aura resources)
      await init(this.fileSystemProvider);

      // Register event handlers that depend on fileSystemProvider
      this.connection.onReferences(reference => this.onReferences(reference));
      this.connection.onSignatureHelp(signatureParams => onSignatureHelp(signatureParams, this.fileSystemProvider));

      // Register tern server document event handlers
      this.documents.onDidOpen(addFile);
      this.documents.onDidChangeContent(addFile);
      this.documents.onDidClose(delFile);
      this.documents.onDidClose(event => this.onDidClose(event));

      // Configure project with updated context
      this.context.configureProject();

      this.isDelayedInitializationComplete = true;

      if (this.hasDetectedAuraFiles && !this.isIndexerInitialized) {
        this.initializeIndexer();
      }
    } catch (error: unknown) {
      throw new Error(
        nls.localize('delayed_initialization_error_message', error instanceof Error ? error.message : String(error))
      );
    }

    // send notification that delayed initialization is complete
    void this.connection.sendNotification(ShowMessageNotification.type, {
      type: MessageType.Info,
      message: 'Aura Language Server is ready'
    });
  }

  public listen(): void {
    Logger.initialize(this.connection);
    this.connection.listen();
  }
}
