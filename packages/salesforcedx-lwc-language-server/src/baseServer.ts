/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Logger,
  isLWCRootDirectoryCreated,
  toResolvedPath,
  getBasename,
  AttributeInfo,
  FileSystemDataProvider,
  BaseWorkspaceContext,
  syncDocumentToTextDocumentsProvider,
  scheduleReinitialization,
  NormalizedPath,
  WorkspaceType,
  normalizePath
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';
import { basename, dirname, parse } from 'node:path';
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
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AuraDataProvider } from './auraDataProvider';
import ComponentIndexer from './componentIndexer';
import { TYPESCRIPT_SUPPORT_SETTING } from './constants';
import { LWCWorkspaceContext } from './context/lwcContext';
import { compileDocument as javascriptCompileDocument } from './javascript/compiler';
import { LWCDataProvider } from './lwcDataProvider';
import { nls } from './messages';

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

const shouldCompleteJavascript = (params: CompletionParams): boolean => params.context?.triggerCharacter !== '{';

export abstract class BaseServer {
  public readonly connection: Connection;
  public readonly documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  protected context!: LWCWorkspaceContext;
  protected workspaceFolders!: WorkspaceFolder[];
  protected workspaceRoots!: NormalizedPath[];
  public componentIndexer!: ComponentIndexer;
  public languageService!: LanguageService;
  public auraDataProvider!: AuraDataProvider;
  public lwcDataProvider!: LWCDataProvider;
  public fileSystemProvider: FileSystemDataProvider;
  protected workspaceType: WorkspaceType;
  protected isDelayedInitializationComplete = false;

  constructor() {
    this.connection = this.createConnection();
    this.fileSystemProvider = new FileSystemDataProvider();

    this.connection.onInitialize(params => this.onInitialize(params));
    this.connection.onCompletion(params => this.onCompletion(params));
    this.connection.onCompletionResolve(item => this.onCompletionResolve(item));
    this.connection.onHover(params => this.onHover(params));
    this.connection.onShutdown(() => this.onShutdown());
    this.connection.onDefinition(params => this.onDefinition(params));
    this.connection.onDidChangeWatchedFiles(params => void this.onDidChangeWatchedFiles(params));
    this.workspaceType = 'UNKNOWN';
    this.documents.listen(this.connection);
  }

  protected abstract createConnection(): Connection;

  public async onInitialize(params: InitializeParams): Promise<InitializeResult> {
    this.workspaceFolders = params.workspaceFolders ?? [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    this.workspaceType = params.initializationOptions?.workspaceType ?? 'UNKNOWN';

    // Set workspace folder URIs in file system provider first so it can convert URIs correctly
    const workspaceFolderUris = this.workspaceFolders.map(folder => folder.uri);
    this.fileSystemProvider.setWorkspaceFolderUris(workspaceFolderUris);

    // Normalize workspaceRoots at entry point to ensure all paths are consistent
    // Use uriToNormalizedPath to handle both file:// and memfs:// schemes correctly
    // This ensures all downstream code receives normalized paths
    this.workspaceRoots = this.workspaceFolders.map(folder => this.fileSystemProvider.uriToNormalizedPath(folder.uri));

    // Set up document event handlers
    this.documents.onDidOpen(changeEvent => this.onDidOpen(changeEvent));
    this.documents.onDidChangeContent(changeEvent => this.onDidChangeContent(changeEvent));
    this.documents.onDidSave(changeEvent => this.onDidSave(changeEvent));

    // Create context but don't initialize yet - wait for files to be loaded via onDidOpen
    this.context = new LWCWorkspaceContext(this.workspaceRoots, this.fileSystemProvider);

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

    if (!this.languageService) {
      Logger.error('[LWC Server] onCompletion: languageService is not initialized');
      return;
    }

    const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);

    if (await this.context.isLWCTemplate(doc)) {
      this.auraDataProvider.activated = false; // provide completions for lwc components in an Aura template
      this.lwcDataProvider.activated = true; // provide completions for lwc components in an LWC template
      const shouldProvideBindings = this.shouldProvideBindingsInHTML(params);
      if (shouldProvideBindings) {
        const docBasename = getBasename(doc);
        const customTags: CompletionItem[] = this.findBindItems(docBasename);
        return {
          isIncomplete: false,
          items: customTags
        };
      }
    } else if (await this.context.isLWCJavascript(doc)) {
      const shouldComplete = shouldCompleteJavascript(params);
      if (shouldComplete && this.componentIndexer) {
        const customData = this.componentIndexer.getCustomData();
        const customTags = customData.map(tag => ({
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

    const languageServiceResult = this.languageService.doComplete(doc, position, htmlDoc);
    return languageServiceResult;
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

  public findBindItems(docBasename: string): CompletionItem[] {
    const customTags: CompletionItem[] = [];
    if (!this.componentIndexer) {
      return customTags;
    }
    const allTags = this.componentIndexer.getCustomData();
    allTags.forEach(tag => {
      const tagName = getTagName(tag);
      if (tagName === docBasename) {
        const classMembers = getClassMembers(tag);
        classMembers.forEach(cm => {
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
    if (!params?.textDocument || !params.position) {
      Logger.warn('[onHover] Missing params or position');
      return null;
    }

    const {
      position,
      textDocument: { uri }
    } = params;

    const doc = this.documents.get(uri);
    if (!doc) {
      Logger.warn(`[onHover] Document not found for URI: ${uri}`);
      return null;
    }

    try {
      const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);

      try {
        if (await this.context.isLWCTemplate(doc)) {
          // Allow hover to work if component indexer is initialized, even if delayed initialization isn't complete
          // This is safe because namespace roots are already detected (isLWCTemplate returned true)
          if (!this.isDelayedInitializationComplete && !this.componentIndexer) {
            return {
              contents: nls.localize('server_initializing_message')
            };
          }
          this.auraDataProvider.activated = false;
          this.lwcDataProvider.activated = true;
          const hoverResult = this.languageService.doHover(doc, position, htmlDoc);
          return hoverResult;
        }
      } catch (error) {
        Logger.error(
          `[onHover] Error checking isLWCTemplate: ${error instanceof Error ? error.message : String(error)}`,
          error
        );
      }

      try {
        const isAuraMarkup = await this.context.isAuraMarkup(doc);

        if (isAuraMarkup) {
          if (!this.isDelayedInitializationComplete) {
            return null;
          }
          this.auraDataProvider.activated = true;
          this.lwcDataProvider.activated = false;
          const hoverResult = this.languageService.doHover(doc, position, htmlDoc);
          return hoverResult;
        }
      } catch (error) {
        Logger.error(
          `[onHover] Error checking isAuraMarkup: ${error instanceof Error ? error.message : String(error)}`,
          error
        );
      }

      return null;
    } catch (error) {
      Logger.error(`[onHover] Unexpected error: ${error instanceof Error ? error.message : String(error)}`, error);
      return null;
    }
  }

  /**
   * Syncs FileSystemDataProvider from TextDocuments when a document is opened.
   * This avoids duplicate reads - TextDocuments is the source of truth for open files.
   */
  protected async onDidOpen(changeEvent: { document: TextDocument }): Promise<void> {
    const { document } = changeEvent;
    const uri = document.uri;
    const content = document.getText();

    // Normalize URI to fsPath before syncing (entry point for path normalization)
    // Use fileSystemProvider.uriToNormalizedPath to handle both file:// and memfs:// schemes correctly
    const normalizedPath = this.fileSystemProvider.uriToNormalizedPath(uri);
    await syncDocumentToTextDocumentsProvider(normalizedPath, content, this.fileSystemProvider, this.workspaceRoots);

    // If this is an LWC file and delayed initialization hasn't completed yet,
    // clear namespace cache to ensure namespace roots are recalculated as files are discovered.
    // Once delayed initialization is complete, namespace roots are stable and don't need recalculation
    // on every file open - they only change when directory structure changes.
    const isLwcPath =
      normalizedPath.includes('/lwc/') &&
      (normalizedPath.endsWith('.html') ?? normalizedPath.endsWith('.js') ?? normalizedPath.endsWith('.ts'));

    if (isLwcPath && !this.isDelayedInitializationComplete) {
      if (this.context) {
        this.context.clearNamespaceCache();
      }
    }

    // Perform delayed initialization once file loading has stabilized
    // scheduleReinitialization waits for file count to stabilize (no changes for 1.5 seconds)
    // This ensures all files from bootstrapWorkspaceAwareness are loaded before initialization
    if (!this.isDelayedInitializationComplete) {
      void scheduleReinitialization(this.fileSystemProvider, () => this.performDelayedInitialization());
    }
  }

  public async onDidChangeContent(changeEvent: TextDocumentChangeEvent<TextDocument>): Promise<void> {
    const { document } = changeEvent;
    const { uri } = document;
    const content = document.getText();

    // Normalize URI to fsPath before syncing (entry point for path normalization)
    // Use fileSystemProvider.uriToNormalizedPath to handle both file:// and memfs:// schemes correctly
    const normalizedPath = this.fileSystemProvider.uriToNormalizedPath(uri);
    await syncDocumentToTextDocumentsProvider(normalizedPath, content, this.fileSystemProvider, this.workspaceRoots);

    if (await this.context.isLWCTemplate(document)) {
      const diagnostics = templateLinter(document);
      await this.connection.sendDiagnostics({ uri, diagnostics });
    }
    if (await this.context.isLWCJavascript(document)) {
      const { metadata, diagnostics } = javascriptCompileDocument(document);
      diagnostics && (await this.connection.sendDiagnostics({ uri, diagnostics }));
      if (metadata && this.componentIndexer) {
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
            this.context.updateNamespaceRootTypeCache();
            if (this.componentIndexer) {
              await this.componentIndexer.updateSfdxTsConfigPath(this.connection);
            }
          } else {
            const hasDeleteEvent = await containsDeletedLwcWatchedDirectory(this.context, changes);
            if (hasDeleteEvent) {
              // We need to scan the file system for deletion events as the change event does not include
              // information about the files that were deleted.
              if (this.componentIndexer) {
                await this.componentIndexer.updateSfdxTsConfigPath(this.connection);
              }
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
              if (filePaths.length > 0 && this.componentIndexer) {
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

    // Normalize URI to fsPath before syncing (entry point for path normalization)
    // Use fileSystemProvider.uriToNormalizedPath to handle both file:// and memfs:// schemes correctly
    const normalizedPath = this.fileSystemProvider.uriToNormalizedPath(uri);
    await syncDocumentToTextDocumentsProvider(normalizedPath, content, this.fileSystemProvider, this.workspaceRoots);

    if (await this.context.isLWCJavascript(document)) {
      const { metadata } = javascriptCompileDocument(document);
      if (metadata && this.componentIndexer) {
        const tag: Tag | null = this.componentIndexer.findTagByURI(document.uri);
        if (tag) {
          void updateTagMetadata(tag, metadata);
        }
      }
    }
  }

  public async onShutdown(): Promise<void> {
    // Persist custom components for faster startup on next session
    if (this.componentIndexer) {
      this.componentIndexer.persistCustomComponents();
    }

    await this.connection.sendNotification(ShowMessageNotification.type, {
      type: MessageType.Info,
      message: 'LWC Language Server shutting down'
    });
  }

  public async onExit(): Promise<void> {
    // Persist custom components for faster startup on next session
    if (this.componentIndexer) {
      this.componentIndexer.persistCustomComponents();
    }

    await this.connection.sendNotification(ShowMessageNotification.type, {
      type: MessageType.Info,
      message: 'LWC Language Server exiting'
    });
  }

  public onDefinition(params: TextDocumentPositionParams): Location[] {
    try {
      const cursorInfo: CursorInfo | null = this.cursorInfo(params);

      if (!cursorInfo) {
        return [];
      }

      const tag: Tag | null =
        cursorInfo.tag && this.componentIndexer ? this.componentIndexer.findTagByName(cursorInfo.tag) : null;

      let result: Location[] = [];
      switch (cursorInfo.type) {
        case 'tag':
          if (tag) {
            try {
              result = getAllLocations(tag, this.fileSystemProvider);
            } catch (error) {
              Logger.error(
                `[onDefinition] Error getting all locations for tag ${cursorInfo.tag}: ${error instanceof Error ? error.message : String(error)}`,
                error
              );
              result = [];
            }
          } else {
            Logger.warn(`[onDefinition] Tag not found for name: ${cursorInfo.tag}`);
          }
          break;

        case 'attributeKey':
          const attr: AttributeInfo | null = tag ? getAttribute(tag, cursorInfo.name) : null;
          if (attr?.location) {
            result = [attr.location];
          } else {
            Logger.warn(`[onDefinition] No location found for attribute: ${cursorInfo.name}`);
          }
          break;

        case 'dynamicContent':
        case 'dynamicAttributeValue':
          const { uri } = params.textDocument;
          if (cursorInfo.range) {
            result = [Location.create(uri, cursorInfo.range)];
          } else {
            try {
              if (!this.componentIndexer) {
                Logger.warn('[onDefinition] Component indexer not available');
                break;
              }
              const component: Tag | null = this.componentIndexer.findTagByURI(uri);
              if (component) {
                const location = getClassMemberLocation(component, cursorInfo.name, this.fileSystemProvider);
                if (location) {
                  result = [location];
                }
              } else {
                Logger.warn(
                  `[onDefinition] Component not found for URI: ${uri}. This may indicate the component indexer hasn't finished indexing yet.`
                );
              }
            } catch (error) {
              Logger.error(
                `[onDefinition] Error getting class member location: ${error instanceof Error ? error.message : String(error)}`,
                error
              );
            }
          }
          break;
      }
      return result;
    } catch (error) {
      Logger.error(`[onDefinition] Unexpected error: ${error instanceof Error ? error.message : String(error)}`, error);
      return [];
    }
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
          name: scanner.getTokenText().replaceAll(/"|'/g, ''),
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
    Logger.initialize(this.connection);
    this.connection.listen();
  }

  /**
   * Configures TypeScript support for the project
   * Can be overridden by subclasses to add custom logging or error handling
   */
  protected async configureTypeScriptSupport(): Promise<void> {
    const hasTsEnabled = await this.isTsSupportEnabled();
    if (hasTsEnabled) {
      this.context.setConnection(this.connection);
      await this.context.configureProjectForTs();
      if (this.componentIndexer) {
        await this.componentIndexer.updateSfdxTsConfigPath(this.connection);
      }
    }
  }

  protected isInitializing = false;

  /**
   * Performs delayed initialization of context and component indexer
   * Files are loaded into fileSystemProvider via onDidOpen events
   */
  protected async performDelayedInitialization(): Promise<void> {
    if (this.isDelayedInitializationComplete) {
      return;
    }

    // Prevent concurrent initialization attempts - check BEFORE any logging
    if (this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      // Initialize workspace context now that essential files are loaded via onDidOpen
      // scheduleReinitialization waits for file loading to stabilize, so all files should be available
      this.context.initialize(this.workspaceType);

      // Clear namespace cache to force re-detection now that files are synced
      // This ensures directoryExists can infer directory existence from file paths
      // But wait for LWC files to be loaded first - check if any LWC files exist
      const allFiles = this.fileSystemProvider.getAllFileUris();
      const hasLwcFiles = allFiles.some(
        uri => uri.includes('/lwc/') && (uri.endsWith('.html') || uri.endsWith('.js') || uri.endsWith('.ts'))
      );

      if (hasLwcFiles) {
        this.context.clearNamespaceCache();
      }

      // For SFDX workspaces, wait for sfdx-project.json to be loaded before initializing component indexer
      if (this.workspaceType === 'SFDX') {
        const sfdxProjectPath = normalizePath(path.join(this.workspaceRoots[0], 'sfdx-project.json'));
        if (!this.fileSystemProvider.fileExists(sfdxProjectPath)) {
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

      // Update data providers to use the new indexer
      this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
      this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
      await TypingIndexer.create({ workspaceRoot: this.workspaceRoots[0] }, this.fileSystemProvider, this.connection);
      this.languageService = getLanguageService({
        customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
        useDefaultDataProvider: false
      });

      // Configure TypeScript support now that files are loaded and context is initialized
      await this.configureTypeScriptSupport();

      // send notification that delayed initialization is complete
      void this.connection.sendNotification(ShowMessageNotification.type, {
        type: MessageType.Info,
        message: 'LWC Language Server is ready'
      });
    } catch (error: unknown) {
      Logger.error(
        `Error during delayed initialization: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    } finally {
      this.isDelayedInitializationComplete = true;
      this.isInitializing = false;
    }
  }
}
