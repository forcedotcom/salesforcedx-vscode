/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  interceptConsoleLogger,
  isLWCRootDirectoryCreated,
  toResolvedPath,
  getBasename,
  AttributeInfo,
  FileSystemDataProvider,
  FileSystemRequests,
  FileSystemNotifications,
  FileStat,
  BaseWorkspaceContext,
  DirectoryEntry
} from '@salesforce/salesforcedx-lightning-lsp-common';
import { basename, dirname, parse, join } from 'node:path';
import {
  getLanguageService,
  LanguageService,
  HTMLDocument,
  CompletionList,
  TokenType,
  Hover,
  CompletionItem,
  CompletionItemKind
} from 'vscode-html-languageservice';
import {
  createConnection,
  Connection,
  TextDocuments,
  TextDocumentChangeEvent,
  Location,
  WorkspaceFolder,
  InitializeResult,
  InitializeParams,
  TextDocumentPositionParams,
  CompletionParams,
  DidChangeWatchedFilesParams,
  ShowMessageNotification,
  MessageType,
  FileChangeType,
  Position,
  Range,
  TextDocumentSyncKind,
  FileEvent
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { URI } from 'vscode-uri';
import { AuraDataProvider } from './auraDataProvider';
import ComponentIndexer from './componentIndexer';
import { TYPESCRIPT_SUPPORT_SETTING } from './constants';
import { LWCWorkspaceContext } from './context/lwcContext';
import { compileDocument as javascriptCompileDocument } from './javascript/compiler';
import { LWCDataProvider } from './lwcDataProvider';

import {
  Tag,
  getTagName,
  getLwcTypingsName,
  getClassMembers,
  getAttribute,
  getAllLocations,
  updateTagMetadata,
  getClassMemberLocation
} from './tag';
import templateLinter from './template/linter';
import TypingIndexer from './typingIndexer';

const propertyRegex = new RegExp(/\{(?<property>\w+)\.*.*\}/);
const iteratorRegex = new RegExp(/iterator:(?<name>\w+)/);

type Token = 'tag' | 'attributeKey' | 'attributeValue' | 'dynamicAttributeValue' | 'content' | 'dynamicContent';

type CursorInfo = {
  name: string;
  type: Token;
  tag?: string;
  range?: Range;
};

export const findDynamicContent = (text: string, offset: number): string | null => {
  const regex = new RegExp(/\{(?<property>\w+)(?:[.:]\w+)?\}/, 'g');
  let match = regex.exec(text);
  while (match && offset > match.index) {
    if (match.groups?.property && offset > match.index && regex.lastIndex > offset) {
      return match.groups.property;
    }
    match = regex.exec(text);
  }
  return null;
};

const isLWCWatchedDirectory = async (context: BaseWorkspaceContext, uri: string): Promise<boolean> => {
  const file = toResolvedPath(uri);
  return await context.isFileInsideModulesRoots(file);
};

const containsDeletedLwcWatchedDirectory = async (
  context: BaseWorkspaceContext,
  changes: FileEvent[]
): Promise<boolean> => {
  for (const event of changes) {
    const insideLwcWatchedDirectory = await isLWCWatchedDirectory(context, event.uri);
    if (event.type === FileChangeType.Deleted && insideLwcWatchedDirectory) {
      const { dir, name, ext } = parse(event.uri);
      const folder = basename(dir);
      const parentFolder = basename(dirname(dir));
      // LWC component OR folder deletion, subdirectory of lwc or lwc directory itself
      if (
        ((ext.endsWith('.ts') || ext.endsWith('.js')) && folder === name && parentFolder === 'lwc') ||
        (!ext && (folder === 'lwc' || name === 'lwc'))
      ) {
        return true;
      }
    }
  }
  return false;
};

export default class Server {
  public readonly connection: Connection = createConnection();
  public readonly documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  private context!: LWCWorkspaceContext;
  private workspaceFolders!: WorkspaceFolder[];
  private workspaceRoots!: string[];
  public componentIndexer!: ComponentIndexer;
  public languageService!: LanguageService;
  public auraDataProvider!: AuraDataProvider;
  public lwcDataProvider!: LWCDataProvider;
  public fileSystemProvider: FileSystemDataProvider;
  private textDocumentsFileSystemProvider: FileSystemDataProvider;

  constructor() {
    this.fileSystemProvider = new FileSystemDataProvider();
    this.textDocumentsFileSystemProvider = new FileSystemDataProvider();

    this.connection.onInitialize(params => this.onInitialize(params));
    this.connection.onInitialized(() => void this.onInitialized());
    this.connection.onCompletion(params => this.onCompletion(params));
    this.connection.onCompletionResolve(item => this.onCompletionResolve(item));
    this.connection.onHover(params => this.onHover(params));
    this.connection.onShutdown(() => this.onShutdown());
    this.connection.onDefinition(params => this.onDefinition(params));
    this.connection.onDidChangeWatchedFiles(params => void this.onDidChangeWatchedFiles(params));

    // Register file system notification handlers
    this.connection.onNotification(
      FileSystemNotifications.FILE_CONTENT_CHANGED,
      (params: { uri: string; content: string }) => void this.onFileContentChanged(params)
    );

    this.documents.listen(this.connection);
    this.documents.onDidOpen(changeEvent => this.onDidOpen(changeEvent));
    this.documents.onDidChangeContent(changeEvent => this.onDidChangeContent(changeEvent));
    this.documents.onDidSave(changeEvent => this.onDidSave(changeEvent));
  }

  public async onInitialize(params: InitializeParams): Promise<InitializeResult> {
    this.workspaceFolders = params.workspaceFolders ?? [];
    this.workspaceRoots = this.workspaceFolders.map(folder => URI.parse(folder.uri).fsPath);

    this.populateFileSystemProvider(params);

    // Register file system request handlers that depend on fileSystemProvider after reconstruction
    this.connection.onRequest(FileSystemRequests.GET_FILE_CONTENT, (fileSystemParams: { uri: string }) =>
      this.onGetFileContent(fileSystemParams)
    );
    this.connection.onRequest(FileSystemRequests.GET_DIRECTORY_LISTING, (fileSystemParams: { uri: string }) =>
      this.onGetDirectoryListing(fileSystemParams)
    );
    this.connection.onRequest(FileSystemRequests.GET_FILE_STAT, (fileSystemParams: { uri: string }) =>
      this.onGetFileStat(fileSystemParams)
    );
    this.connection.onRequest(
      FileSystemRequests.CREATE_TYPING_FILES,
      (fileSystemParams: { files: { uri: string; content: string }[] }) => this.onCreateTypingFiles(fileSystemParams)
    );
    this.connection.onRequest(FileSystemRequests.DELETE_TYPING_FILES, (fileSystemParams: { files: string[] }) =>
      this.onDeleteTypingFiles(fileSystemParams)
    );
    this.connection.onRequest(
      FileSystemRequests.UPDATE_COMPONENT_INDEX,
      (fileSystemParams: { components: { uri: string; content: string; mtime: number; type: string }[] }) =>
        this.onUpdateComponentIndex(fileSystemParams)
    );

    this.context = new LWCWorkspaceContext(this.workspaceRoots, this.fileSystemProvider);
    this.componentIndexer = new ComponentIndexer({
      workspaceRoot: this.workspaceRoots[0],
      fileSystemProvider: this.fileSystemProvider
    });
    this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
    this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
    await TypingIndexer.create({ workspaceRoot: this.workspaceRoots[0] }, this.fileSystemProvider);
    this.languageService = getLanguageService({
      customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
      useDefaultDataProvider: false
    });

    await this.context.initialize();
    this.context.configureProject();

    // Sync TextDocuments FileSystemDataProvider from any already-open documents
    this.syncFileSystemProviderFromDocuments();

    // Wait for TextDocuments provider to be populated (files loaded asynchronously)
    // Then compare to verify they match before replacing
    await this.waitForTextDocumentsProvider();

    // Initialize componentIndexer to get workspace structure
    await this.componentIndexer.init();

    // Compare FileSystemDataProvider from init vs TextDocuments to verify they match
    // Also verify TextDocuments provider has all expected files from workspace
    setTimeout(() => {
      void this.compareFileSystemProviders();
    }, 1000); // 1 second delay to allow async document opens

    return this.capabilities;
  }

  public get capabilities(): InitializeResult {
    return {
      capabilities: {
        textDocumentSync: {
          openClose: true,
          change: TextDocumentSyncKind.Full
        },
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.', '-', '_', '<', '"', '=', '/', '>', '{']
        },
        hoverProvider: true,
        definitionProvider: true,
        workspace: {
          workspaceFolders: {
            supported: true
          }
        }
      }
    };
  }

  public async onInitialized(): Promise<void> {
    const hasTsEnabled = await this.isTsSupportEnabled();
    if (hasTsEnabled) {
      await this.context.configureProjectForTs();
      await this.componentIndexer.updateSfdxTsConfigPath();
    }
  }

  public async isTsSupportEnabled(): Promise<boolean> {
    return Boolean(await this.connection.workspace.getConfiguration(TYPESCRIPT_SUPPORT_SETTING));
  }

  public async onCompletion(params: CompletionParams): Promise<CompletionList | undefined> {
    const {
      position,
      textDocument: { uri }
    } = params;
    const doc = this.documents.get(uri);
    if (!doc) {
      return;
    }

    const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);

    if (await this.context.isLWCTemplate(doc)) {
      this.auraDataProvider.activated = false; // provide completions for lwc components in an Aura template
      this.lwcDataProvider.activated = true; // provide completions for lwc components in an LWC template
      if (this.shouldProvideBindingsInHTML(params)) {
        const docBasename = getBasename(doc);
        const customTags: CompletionItem[] = this.findBindItems(docBasename);
        return {
          isIncomplete: false,
          items: customTags
        };
      }
    } else if (await this.context.isLWCJavascript(doc)) {
      if (this.shouldCompleteJavascript(params)) {
        const customTags = this.componentIndexer.getCustomData().map(tag => ({
          label: getLwcTypingsName(tag),
          kind: CompletionItemKind.Folder
        }));
        return {
          isIncomplete: false,
          items: customTags
        };
      } else {
        return;
      }
    } else if (await this.context.isAuraMarkup(doc)) {
      this.auraDataProvider.activated = true;
      this.lwcDataProvider.activated = false;
    } else {
      return;
    }

    return this.languageService.doComplete(doc, position, htmlDoc);
  }

  public shouldProvideBindingsInHTML(params: CompletionParams): boolean {
    return params.context?.triggerCharacter === '{' || this.isWithinCurlyBraces(params);
  }

  public isWithinCurlyBraces(params: CompletionParams): boolean {
    const position = params.position;
    const doc = this.documents.get(params.textDocument.uri);
    if (!doc) {
      return false;
    }
    const offset = doc.offsetAt(position);
    const text = doc.getText();
    let startIndex = offset - 1;
    let char = text.charAt(startIndex);
    const regPattern = /(\w|\$)/; // Valid variable names in JavaScript can contain letters, digits, underscore or $
    while (char.match(regPattern)) {
      startIndex -= 1;
      char = text.charAt(startIndex);
    }
    return char === '{';
  }

  public shouldCompleteJavascript(params: CompletionParams): boolean {
    return params.context?.triggerCharacter !== '{';
  }

  public findBindItems(docBasename: string): CompletionItem[] {
    const customTags: CompletionItem[] = [];
    this.componentIndexer.getCustomData().forEach(tag => {
      if (getTagName(tag) === docBasename) {
        getClassMembers(tag).forEach(cm => {
          const bindName = `${getTagName(tag)}.${cm.name}`;
          const kind = cm.type === 'method' ? CompletionItemKind.Function : CompletionItemKind.Property;
          const detail = cm.decorator ? `@${cm.decorator}` : '';
          customTags.push({ label: cm.name, kind, documentation: bindName, detail, sortText: bindName });
        });
      }
    });
    return customTags;
  }

  public onCompletionResolve(item: CompletionItem): CompletionItem {
    return item;
  }

  public async onHover(params: TextDocumentPositionParams): Promise<Hover | null> {
    const {
      position,
      textDocument: { uri }
    } = params;
    const doc = this.documents.get(uri);
    if (!doc) {
      return null;
    }

    const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);

    if (await this.context.isLWCTemplate(doc)) {
      this.auraDataProvider.activated = false;
      this.lwcDataProvider.activated = true;
    } else if (await this.context.isAuraMarkup(doc)) {
      this.auraDataProvider.activated = true;
      this.lwcDataProvider.activated = false;
    } else {
      return null;
    }

    return this.languageService.doHover(doc, position, htmlDoc);
  }

  /**
   * Ensures parent directories are tracked in FileSystemDataProvider.
   * Creates directory entries and stats for all parent directories up to the workspace root.
   */
  private ensureDirectoryTracked(dirUri: string, provider: FileSystemDataProvider): void {
    // Check if directory is already tracked
    if (provider.directoryExists(dirUri)) {
      return;
    }

    // Create directory stat
    provider.updateFileStat(dirUri, {
      type: 'directory',
      exists: true,
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0
    });

    // Get or create directory listing
    const entries = provider.getDirectoryListing(dirUri) ?? [];

    // Update directory listing (will be populated as files are added)
    provider.updateDirectoryListing(dirUri, entries);

    // Recursively ensure parent directory is tracked
    const parentDir = dirname(dirUri);
    if (parentDir && parentDir !== dirUri && parentDir !== '.') {
      // Check if parent is within workspace roots
      const isInWorkspace = this.workspaceRoots.some(root => dirUri.startsWith(root));
      if (isInWorkspace) {
        this.ensureDirectoryTracked(parentDir, provider);
      }
    }
  }

  /**
   * Adds a file entry to its parent directory's listing.
   */
  private addFileToDirectoryListing(fileUri: string, provider: FileSystemDataProvider): void {
    const filePath = URI.parse(fileUri).fsPath;
    const parentDir = dirname(filePath);
    const fileName = basename(filePath);

    // Ensure parent directory is tracked
    this.ensureDirectoryTracked(parentDir, provider);

    // Get current directory listing
    const entries = provider.getDirectoryListing(parentDir) ?? [];

    // Check if file already exists in listing
    const existingEntry = entries.find(entry => entry.name === fileName);
    if (!existingEntry) {
      // Add file entry to directory listing
      const updatedEntries: DirectoryEntry[] = [
        ...entries,
        {
          name: fileName,
          type: 'file',
          uri: fileUri
        }
      ];
      provider.updateDirectoryListing(parentDir, updatedEntries);
    }
  }

  /**
   * Syncs a document to the TextDocuments FileSystemDataProvider.
   * Normalizes URI to fsPath to match init provider format.
   */
  private syncDocumentToTextDocumentsProvider(uri: string, content: string): void {
    // Normalize URI to fsPath to match init provider format (plain path, not file:// URI)
    const normalizedUri = URI.parse(uri).fsPath;

    // Update TextDocuments FileSystemDataProvider with document content
    this.textDocumentsFileSystemProvider.updateFileContent(normalizedUri, content);
    this.textDocumentsFileSystemProvider.updateFileStat(normalizedUri, {
      type: 'file',
      exists: true,
      ctime: Date.now(),
      mtime: Date.now(),
      size: content.length
    });

    // Ensure parent directory is tracked and file is in directory listing
    this.addFileToDirectoryListing(normalizedUri, this.textDocumentsFileSystemProvider);
  }

  /**
   * Syncs FileSystemDataProvider from TextDocuments when a document is opened.
   * This avoids duplicate reads - TextDocuments is the source of truth for open files.
   */
  private onDidOpen(changeEvent: { document: TextDocument }): void {
    const { document } = changeEvent;
    const uri = document.uri;
    const content = document.getText();

    // Sync to TextDocuments FileSystemDataProvider
    this.syncDocumentToTextDocumentsProvider(uri, content);
  }

  public async onDidChangeContent(changeEvent: TextDocumentChangeEvent<TextDocument>): Promise<void> {
    const { document } = changeEvent;
    const { uri } = document;
    const content = document.getText();

    // Sync to TextDocuments FileSystemDataProvider
    this.syncDocumentToTextDocumentsProvider(uri, content);

    if (await this.context.isLWCTemplate(document)) {
      const diagnostics = templateLinter(document);
      await this.connection.sendDiagnostics({ uri, diagnostics });
    }
    if (await this.context.isLWCJavascript(document)) {
      const { metadata, diagnostics } = javascriptCompileDocument(document);
      diagnostics && (await this.connection.sendDiagnostics({ uri, diagnostics }));
      if (metadata) {
        const tag: Tag | null = this.componentIndexer.findTagByURI(uri);
        if (tag) {
          await updateTagMetadata(tag, metadata);
        }
      }
    }
  }

  // TODO: Once the LWC custom module resolution plugin has been developed in the language server
  // this can be removed.
  public async onDidChangeWatchedFiles(changeEvent: DidChangeWatchedFilesParams): Promise<void> {
    if (this.context.type === 'SFDX') {
      try {
        const hasTsEnabled = await this.isTsSupportEnabled();
        if (hasTsEnabled) {
          const { changes } = changeEvent;
          if (isLWCRootDirectoryCreated(this.context, changes)) {
            // LWC directory created
            await this.context.updateNamespaceRootTypeCache();
            await this.componentIndexer.updateSfdxTsConfigPath();
          } else {
            const hasDeleteEvent = await containsDeletedLwcWatchedDirectory(this.context, changes);
            if (hasDeleteEvent) {
              // We need to scan the file system for deletion events as the change event does not include
              // information about the files that were deleted.
              await this.componentIndexer.updateSfdxTsConfigPath();
            } else {
              const filePaths = [];
              for (const event of changes) {
                const insideLwcWatchedDirectory = await isLWCWatchedDirectory(this.context, event.uri);
                if (event.type === FileChangeType.Created && insideLwcWatchedDirectory) {
                  // File creation
                  const filePath = toResolvedPath(event.uri);
                  const { dir, name: fileName, ext } = parse(filePath);
                  const folderName = basename(dir);
                  const parentFolder = basename(dirname(dir));
                  // Only update path mapping for newly created lwc modules
                  if (/.*(.ts|.js)$/.test(ext) && folderName === fileName && parentFolder === 'lwc') {
                    filePaths.push(filePath);
                  }
                }
              }
              if (filePaths.length > 0) {
                await this.componentIndexer.insertSfdxTsConfigPath(filePaths);
              }
            }
          }
        }
      } catch (e) {
        await this.connection.sendNotification(ShowMessageNotification.type, {
          type: MessageType.Error,
          message: `Error updating tsconfig.sfdx.json path mapping: ${e instanceof Error ? e.message : String(e)}`
        });
      }
    }
  }

  public async onDidSave(change: TextDocumentChangeEvent<TextDocument>): Promise<void> {
    const { document } = change;
    const uri = document.uri;
    const content = document.getText();

    // Sync to TextDocuments FileSystemDataProvider
    this.syncDocumentToTextDocumentsProvider(uri, content);

    if (await this.context.isLWCJavascript(document)) {
      const { metadata } = await javascriptCompileDocument(document);
      if (metadata) {
        const tag: Tag | null = this.componentIndexer.findTagByURI(document.uri);
        if (tag) {
          await updateTagMetadata(tag, metadata);
        }
      }
    }
  }

  public async onShutdown(): Promise<void> {
    // Persist custom components for faster startup on next session
    await this.componentIndexer.persistCustomComponents();

    await this.connection.sendNotification(ShowMessageNotification.type, {
      type: MessageType.Info,
      message: 'LWC Language Server shutting down'
    });
  }

  public async onExit(): Promise<void> {
    // Persist custom components for faster startup on next session
    await this.componentIndexer.persistCustomComponents();

    await this.connection.sendNotification(ShowMessageNotification.type, {
      type: MessageType.Info,
      message: 'LWC Language Server exiting'
    });
  }

  public onDefinition(params: TextDocumentPositionParams): Location[] {
    const cursorInfo: CursorInfo | null = this.cursorInfo(params);
    if (!cursorInfo) {
      return [];
    }

    const tag: Tag | null = cursorInfo.tag ? this.componentIndexer.findTagByName(cursorInfo.tag) : null;

    let result: Location[] = [];
    switch (cursorInfo.type) {
      case 'tag':
        result = tag ? getAllLocations(tag) : [];
        break;

      case 'attributeKey':
        const attr: AttributeInfo | null = tag ? getAttribute(tag, cursorInfo.name) : null;
        if (attr?.location) {
          result = [attr.location];
        } else {
        }
        break;

      case 'dynamicContent':
      case 'dynamicAttributeValue':
        const { uri } = params.textDocument;
        if (cursorInfo.range) {
          result = [Location.create(uri, cursorInfo.range)];
        } else {
          const component: Tag | null = this.componentIndexer.findTagByURI(uri);
          const location = component ? getClassMemberLocation(component, cursorInfo.name) : null;
          if (location) {
            result = [location];
          }
        }
        break;

      default:
        break;
    }

    return result;
  }

  public cursorInfo(
    { textDocument: { uri }, position }: TextDocumentPositionParams,
    document?: TextDocument
  ): CursorInfo | null {
    const doc = document ?? this.documents.get(uri);
    const offset = doc?.offsetAt(position);
    const scanner = doc ? this.languageService.createScanner(doc.getText()) : null;
    if (!scanner || !offset || !doc) {
      return null;
    }
    let token: TokenType;
    let tag: string | undefined;
    let attributeName: string | undefined;
    const iterators: { name: string; range: { start: Position; end: Position } }[] = [];

    do {
      token = scanner.scan();
      if (token === TokenType.StartTag) {
        tag = scanner.getTokenText();
      }
      if (token === TokenType.AttributeName) {
        attributeName = scanner.getTokenText();
        const iterator = iteratorRegex.exec(attributeName);
        if (iterator) {
          iterators.unshift({
            name: iterator?.groups?.name ?? '', // this does not account for same sibling iterators
            range: {
              start: doc?.positionAt(scanner.getTokenOffset() + 9),
              end: doc?.positionAt(scanner.getTokenEnd())
            }
          });
        }
      }
      if (token === TokenType.AttributeValue && attributeName === 'for:item') {
        iterators.unshift({
          name: scanner.getTokenText().replace(/"|'/g, ''),
          range: {
            start: doc?.positionAt(scanner.getTokenOffset()),
            end: doc?.positionAt(scanner.getTokenEnd())
          }
        });
      }
    } while (token !== TokenType.EOS && scanner.getTokenEnd() <= offset);

    const content = scanner.getTokenText();

    switch (token) {
      case TokenType.StartTag:
      case TokenType.EndTag: {
        return { type: 'tag', name: tag ?? '', tag };
      }
      case TokenType.AttributeName: {
        return { type: 'attributeKey', tag, name: content };
      }
      case TokenType.AttributeValue: {
        const match = propertyRegex.exec(content);
        if (match) {
          const item = iterators.find(i => i.name === match?.groups?.property) ?? null;
          return {
            type: 'dynamicAttributeValue',
            name: match?.groups?.property ?? '',
            range: item?.range,
            tag
          };
        } else {
          return { type: 'attributeValue', name: content, tag };
        }
      }
      case TokenType.Content: {
        const relativeOffset: number = offset - scanner.getTokenOffset();
        const match = findDynamicContent(content, relativeOffset);

        if (match) {
          const item = iterators.find(i => i.name === match) ?? null;

          return {
            type: 'dynamicContent',
            name: match,
            range: item?.range,
            tag
          };
        } else {
          return {
            type: 'content',
            tag,
            name: content
          };
        }
      }
    }

    return null;
  }

  public listen(): void {
    interceptConsoleLogger(this.connection);
    this.connection.listen();
  }

  // File system request handlers
  private onGetFileContent(params: { uri: string }): { content: string; exists: boolean } {
    const content = this.fileSystemProvider.getFileContent(params.uri);
    return {
      content: content ?? '',
      exists: content !== undefined
    };
  }

  private onGetDirectoryListing(params: { uri: string }): { entries: any[]; exists: boolean } {
    const entries = this.fileSystemProvider.getDirectoryListing(params.uri);
    return {
      entries: entries ?? [],
      exists: entries !== undefined
    };
  }

  private onGetFileStat(params: { uri: string }): { stat: any } {
    const stat = this.fileSystemProvider.getFileStat(params.uri);
    return { stat: stat ?? { exists: false } };
  }

  private onCreateTypingFiles(params: { files: { uri: string; content: string }[] }): void {
    // Handle typing file creation requests from client
    for (const file of params.files) {
      this.fileSystemProvider.updateFileContent(file.uri, file.content);
    }
  }

  private onDeleteTypingFiles(_params: { files: string[] }): void {
    // Handle typing file deletion requests from client
    // Note: Actual deletion will be handled by the client
    // This is just for server-side tracking
  }

  private onUpdateComponentIndex(params: {
    components: { uri: string; content: string; mtime: number; type: string }[];
  }): void {
    // Handle component index updates from client
    for (const component of params.components) {
      this.fileSystemProvider.updateFileContent(component.uri, component.content);
    }
  }

  // File system notification handlers
  private onFileContentChanged(params: { uri: string; content: string }): void {
    this.fileSystemProvider.updateFileContent(params.uri, params.content);
  }

  private isFileStat(obj: unknown): obj is FileStat {
    return typeof obj === 'object' && obj !== null && 'type' in obj && 'exists' in obj;
  }

  /**
   * Syncs TextDocuments FileSystemDataProvider from all currently open TextDocuments.
   * This populates the TextDocuments provider for comparison with the init provider.
   */
  private syncFileSystemProviderFromDocuments(): void {
    for (const document of this.documents.all()) {
      const uri = document.uri;
      const content = document.getText();

      this.syncDocumentToTextDocumentsProvider(uri, content);
    }
  }

  /**
   * Waits for TextDocuments provider to be populated (files loaded asynchronously).
   * This allows async file loading without blocking server initialization.
   * After waiting, comparison will verify that TextDocuments provider matches init provider.
   */
  private async waitForTextDocumentsProvider(): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds max wait
    const checkInterval = 500; // Check every 500ms
    const startTime = Date.now();
    let lastFileCount = 0;
    let stableCount = 0; // Count of consecutive checks with same file count

    this.connection.console.log('Waiting for TextDocuments provider to be populated...');

    while (Date.now() - startTime < maxWaitTime) {
      const currentFileCount = this.textDocumentsFileSystemProvider.getAllFileUris().length;

      // If file count is stable for 3 consecutive checks (1.5 seconds), assume loading is done
      if (currentFileCount === lastFileCount && currentFileCount > 0) {
        stableCount++;
        if (stableCount >= 3) {
          this.connection.console.log(
            `TextDocuments provider populated with ${currentFileCount} files. Ready for comparison.`
          );
          break;
        }
      } else {
        stableCount = 0;
      }

      lastFileCount = currentFileCount;
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    const finalFileCount = this.textDocumentsFileSystemProvider.getAllFileUris().length;
    const initFileCount = this.fileSystemProvider.getAllFileUris().length;
    const initFiles = this.fileSystemProvider.getAllFileUris().slice(0, 10);
    const textDocsFiles = this.textDocumentsFileSystemProvider.getAllFileUris().slice(0, 10);

    this.connection.console.log(
      `TextDocuments provider: ${finalFileCount} files. Init provider: ${initFileCount} files.`
    );

    if (initFileCount > 0) {
      this.connection.console.log(`Init provider files (first 10): ${initFiles.join(', ')}`);
    }
    if (finalFileCount > 0) {
      this.connection.console.log(`TextDocuments provider files (first 10): ${textDocsFiles.join(', ')}`);
    }
  }

  /**
   * Compares the FileSystemDataProvider populated at initialization with
   * the one populated from open TextDocuments. Also verifies that TextDocuments
   * provider has all expected files from the workspace structure.
   *
   * Note: Since init provider is now empty (for async loading), this comparison
   * verifies that TextDocuments provider has the expected files. Once verified,
   * we can replace init provider with TextDocuments provider.
   */
  private compareFileSystemProviders(): void {
    const initProvider = this.fileSystemProvider;
    const textDocsProvider = this.textDocumentsFileSystemProvider;

    // Log a note about the expected behavior
    const initFileCount = initProvider.getAllFileUris().length;
    const textDocsFileCount = textDocsProvider.getAllFileUris().length;

    if (initFileCount === 0 && textDocsFileCount > 0) {
      this.connection.console.log(
        `Note: Init provider is empty (async loading enabled). TextDocuments provider has ${textDocsFileCount} files. ` +
          'This is expected - TextDocuments provider will replace init provider once verified.'
      );
    }

    // Verify TextDocuments provider against expected workspace files
    this.verifyTextDocumentsProviderAgainstWorkspace(textDocsProvider);

    // Get all file URIs from both providers
    const initFileUris = new Set(initProvider.getAllFileUris());
    const textDocsFileUris = new Set(textDocsProvider.getAllFileUris());

    // Filter to only LWC source files for comparison (js, ts, html)
    // This excludes meta.xml, css, design, svg, etc. which are in init but not in TextDocuments
    const lwcSourceFilePattern = /\.(js|ts|html)$/;
    const initLwcFiles = new Set(
      Array.from(initFileUris).filter(uri => {
        const fsPath = URI.parse(uri).fsPath;
        return lwcSourceFilePattern.test(fsPath) && fsPath.includes('/lwc/');
      })
    );
    const textDocsLwcFiles = new Set(
      Array.from(textDocsFileUris).filter(uri => {
        const fsPath = URI.parse(uri).fsPath;
        return lwcSourceFilePattern.test(fsPath) && fsPath.includes('/lwc/');
      })
    );

    const differences: string[] = [];
    const matches: string[] = [];
    const initOnlyFiles: string[] = [];
    const textDocsOnlyFiles: string[] = [];
    const contentDifferences: string[] = [];

    // Files in TextDocuments provider but not in init provider (LWC source files only)
    for (const uri of textDocsLwcFiles) {
      if (!initLwcFiles.has(uri)) {
        textDocsOnlyFiles.push(uri);
        differences.push(`File ${uri} exists in TextDocuments provider but not in init provider`);
      }
    }

    // Files in init provider but not in TextDocuments provider (LWC source files only)
    for (const uri of initLwcFiles) {
      if (!textDocsLwcFiles.has(uri)) {
        initOnlyFiles.push(uri);
        differences.push(`File ${uri} exists in init provider but not in TextDocuments provider`);
      }
    }

    // Files in both providers - compare content (LWC source files only)
    const commonFiles = new Set([...initLwcFiles].filter(uri => textDocsLwcFiles.has(uri)));
    for (const uri of commonFiles) {
      const initContent = initProvider.getFileContent(uri);
      const textDocsContent = textDocsProvider.getFileContent(uri);

      if (initContent === textDocsContent) {
        matches.push(uri);
      } else {
        contentDifferences.push(uri);
        differences.push(`File ${uri} content differs between providers`);
      }
    }

    // Log summary
    this.connection.console.log(
      `FileSystemProvider comparison summary:
  - Init provider: ${initFileUris.size} total files (${initLwcFiles.size} LWC source files)
  - TextDocuments provider: ${textDocsFileUris.size} total files (${textDocsLwcFiles.size} LWC source files)
  - LWC source file comparison:
    - Common files: ${commonFiles.size}
    - Matches: ${matches.length}
    - Content differences: ${contentDifferences.length}
    - Init-only LWC files: ${initOnlyFiles.length}
    - TextDocuments-only LWC files: ${textDocsOnlyFiles.length}
  Note: Init provider includes ${initFileUris.size - initLwcFiles.size} non-LWC-source files (.css, .meta.xml, .design, .svg, etc.) that TextDocuments provider doesn't track`
    );

    // Determine if one is a superset
    if (textDocsOnlyFiles.length > 0 && initOnlyFiles.length === 0) {
      this.connection.console.log(
        `TextDocuments provider is a SUPERSET of init provider (+${textDocsOnlyFiles.length} files)`
      );
    } else if (initOnlyFiles.length > 0 && textDocsOnlyFiles.length === 0) {
      this.connection.console.log(
        `Init provider is a SUPERSET of TextDocuments provider (+${initOnlyFiles.length} files)`
      );
    } else if (textDocsOnlyFiles.length > 0 && initOnlyFiles.length > 0) {
      this.connection.console.log(
        `Providers have DIFFERENT files: TextDocuments has ${textDocsOnlyFiles.length} unique, Init has ${initOnlyFiles.length} unique`
      );
    } else if (contentDifferences.length > 0) {
      this.connection.console.log(`Providers have same files but ${contentDifferences.length} content differences`);
    } else {
      this.connection.console.log('Providers match perfectly!');
    }

    // Log detailed differences (limit to first 20 to avoid spam)
    if (differences.length > 0) {
      const displayCount = Math.min(differences.length, 20);
      this.connection.console.warn(
        `FileSystemProvider comparison found ${differences.length} differences (showing first ${displayCount}):`
      );
      differences.slice(0, displayCount).forEach(diff => {
        this.connection.console.warn(`  - ${diff}`);
      });
      if (differences.length > displayCount) {
        this.connection.console.warn(`  ... and ${differences.length - displayCount} more differences`);
      }
    }

    // Log directory listing comparison for open document directories
    const dirDifferences: string[] = [];
    for (const document of this.documents.all()) {
      const uri = document.uri;
      const filePath = URI.parse(uri).fsPath;
      const parentDir = dirname(filePath);

      const initListing = initProvider.getDirectoryListing(parentDir);
      const textDocsListing = textDocsProvider.getDirectoryListing(parentDir);

      if (initListing && textDocsListing) {
        const initFileNames = new Set(initListing.map(e => e.name));
        const textDocsFileNames = new Set(textDocsListing.map(e => e.name));

        if (initFileNames.size !== textDocsFileNames.size) {
          dirDifferences.push(
            `Directory ${parentDir} has different number of entries: init=${initFileNames.size}, textDocs=${textDocsFileNames.size}`
          );
        }

        for (const fileName of textDocsFileNames) {
          if (!initFileNames.has(fileName)) {
            dirDifferences.push(
              `Directory ${parentDir} has ${fileName} in TextDocuments provider but not in init provider`
            );
          }
        }
        for (const fileName of initFileNames) {
          if (!textDocsFileNames.has(fileName)) {
            dirDifferences.push(
              `Directory ${parentDir} has ${fileName} in init provider but not in TextDocuments provider`
            );
          }
        }
      } else if (initListing && !textDocsListing) {
        dirDifferences.push(`Directory ${parentDir} exists in init provider but not in TextDocuments provider`);
      } else if (!initListing && textDocsListing) {
        dirDifferences.push(`Directory ${parentDir} exists in TextDocuments provider but not in init provider`);
      }
    }

    if (dirDifferences.length > 0) {
      this.connection.console.warn(`Directory listing differences: ${dirDifferences.length}`);
      dirDifferences.slice(0, 10).forEach(diff => {
        this.connection.console.warn(`  - ${diff}`);
      });
    }
  }

  /**
   * Verifies that TextDocuments provider has all expected LWC source files
   * by analyzing the actual files present in TextDocuments provider.
   * For each component .js file found, we verify its .html and optional .ts files exist.
   */
  private verifyTextDocumentsProviderAgainstWorkspace(textDocsProvider: FileSystemDataProvider): void {
    try {
      // Get all LWC source files from TextDocuments provider
      const lwcSourcePattern = /\.(js|ts|html)$/;
      const allFiles = textDocsProvider.getAllFileUris().filter(uri => {
        const fsPath = URI.parse(uri).fsPath;
        return lwcSourcePattern.test(fsPath) && fsPath.includes('/lwc/');
      });

      // Group files by component directory
      // Component structure: /path/to/lwc/componentName/componentName.js
      const componentDirs = new Map<string, Set<string>>();

      for (const fileUri of allFiles) {
        const fsPath = URI.parse(fileUri).fsPath;
        const dir = dirname(fsPath);
        const fileName = basename(fsPath);
        const ext = parse(fsPath).ext;

        // Check if this is a component file (componentName/componentName.js pattern)
        const parentDir = dirname(dir);
        const componentName = basename(dir);
        const parentName = basename(parentDir);

        // Only process if it's in a component directory (directory name matches component name)
        // and parent is 'lwc'
        if (parentName === 'lwc' && fileName.startsWith(componentName)) {
          if (!componentDirs.has(dir)) {
            componentDirs.set(dir, new Set());
          }
          componentDirs.get(dir)!.add(ext);
        }
      }

      // Build expected file set: for each component directory with .js, we expect .html
      const expectedFiles = new Set<string>();
      const actualFiles = new Set(allFiles);

      for (const [componentDir, extensions] of componentDirs) {
        const componentName = basename(componentDir);

        // If we have .js, we expect .html (and optionally .ts)
        if (extensions.has('.js')) {
          const jsFile = join(componentDir, `${componentName}.js`);
          const htmlFile = join(componentDir, `${componentName}.html`);
          expectedFiles.add(jsFile);
          expectedFiles.add(htmlFile);

          // If .ts exists, include it
          if (extensions.has('.ts')) {
            const tsFile = join(componentDir, `${componentName}.ts`);
            expectedFiles.add(tsFile);
          }
        }
      }

      // Compare expected vs actual
      const missingFiles: string[] = [];

      for (const expectedFile of expectedFiles) {
        if (!actualFiles.has(expectedFile)) {
          missingFiles.push(expectedFile);
        }
      }

      // Note: We allow test files and other files that aren't in expectedFiles
      // We mainly care about missing expected files

      // Log verification results
      const coveragePercent =
        expectedFiles.size > 0 ? ((actualFiles.size / expectedFiles.size) * 100).toFixed(1) : '100';

      if (missingFiles.length === 0) {
        this.connection.console.log(
          `✅ TextDocuments provider verification: All ${expectedFiles.size} expected LWC source files are present.`
        );
      } else {
        // Check if missing files are actually optional (e.g., some components might not have .html)
        // HTML files might be optional for some components
        const optionalMissing = missingFiles.filter(file => file.endsWith('.html'));

        if (optionalMissing.length === missingFiles.length) {
          this.connection.console.log(
            `✅ TextDocuments provider verification: All core files present. ${missingFiles.length} optional .html files missing (may be intentional):`
          );
        } else {
          this.connection.console.warn(
            `⚠️ TextDocuments provider verification: ${missingFiles.length} of ${expectedFiles.size} expected files are missing:`
          );
        }

        missingFiles.slice(0, 20).forEach(file => {
          if (optionalMissing.length === missingFiles.length) {
            this.connection.console.log(`  - Optional: ${file}`);
          } else {
            this.connection.console.warn(`  - Missing: ${file}`);
          }
        });
        if (missingFiles.length > 20) {
          this.connection.console.warn(`  ... and ${missingFiles.length - 20} more missing files`);
        }
      }

      this.connection.console.log(
        `TextDocuments provider verification summary:
  - Components found: ${componentDirs.size}
  - Expected LWC source files: ${expectedFiles.size} (${componentDirs.size} components × 2 files)
  - Actual LWC source files: ${actualFiles.size} (includes test files and other files)
  - Missing files: ${missingFiles.length}
  - Coverage: ${coveragePercent}%

  ✅ TextDocuments provider is ready - contains ${actualFiles.size} LWC source files.`
      );
    } catch (error) {
      this.connection.console.error(
        `Error verifying TextDocuments provider against workspace: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private populateFileSystemProvider(params: InitializeParams) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (params.initializationOptions?.fileSystemProvider) {
      // Reconstruct the FileSystemDataProvider from serialized data
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const serializedProvider = params.initializationOptions.fileSystemProvider;

      if (typeof serializedProvider !== 'object' || serializedProvider === null) {
        throw new Error('Invalid fileSystemProvider in initializationOptions');
      }
      this.fileSystemProvider = new FileSystemDataProvider();

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

      // Verify that the fileSystemProvider has all required methods
      if (typeof this.fileSystemProvider.updateDirectoryListing !== 'function') {
        throw new Error('FileSystemDataProvider reconstruction failed - updateDirectoryListing method missing');
      }
    }
  }
}
