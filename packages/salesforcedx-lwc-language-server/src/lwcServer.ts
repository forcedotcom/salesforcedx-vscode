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
  normalizePath,
  NormalizedPath,
  WorkspaceType
} from '@salesforce/salesforcedx-lightning-lsp-common';
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

export default class Server {
  public readonly connection: Connection = createConnection();
  public readonly documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  private context!: LWCWorkspaceContext;
  private workspaceFolders!: WorkspaceFolder[];
  private workspaceRoots!: NormalizedPath[];
  public componentIndexer!: ComponentIndexer;
  public languageService!: LanguageService;
  public auraDataProvider!: AuraDataProvider;
  public lwcDataProvider!: LWCDataProvider;
  public fileSystemProvider: FileSystemDataProvider;
  private textDocumentsFileSystemProvider: FileSystemDataProvider;
  private workspaceType: WorkspaceType;
  private isDelayedInitializationComplete = false;

  constructor() {
    this.fileSystemProvider = new FileSystemDataProvider();
    this.textDocumentsFileSystemProvider = new FileSystemDataProvider();

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

  public async onInitialize(params: InitializeParams): Promise<InitializeResult> {
    this.workspaceFolders = params.workspaceFolders ?? [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    this.workspaceType = params.initializationOptions?.workspaceType ?? 'UNKNOWN';
    // Normalize workspaceRoots at entry point to ensure all paths are consistent
    // This ensures all downstream code receives normalized paths
    this.workspaceRoots = this.workspaceFolders.map(folder => normalizePath(URI.parse(folder.uri).fsPath));

    // Set up document event handlers
    this.documents.onDidOpen(changeEvent => this.onDidOpen(changeEvent));
    this.documents.onDidChangeContent(changeEvent => this.onDidChangeContent(changeEvent));
    this.documents.onDidSave(changeEvent => this.onDidSave(changeEvent));

    // Create context but don't initialize yet - wait for files to be loaded via onDidOpen
    this.context = new LWCWorkspaceContext(this.workspaceRoots, this.fileSystemProvider);

    // Create component indexer with fileSystemProvider (will be re-initialized after delayed init)
    this.componentIndexer = new ComponentIndexer({
      workspaceRoot: this.workspaceRoots[0],
      fileSystemProvider: this.fileSystemProvider
    });

    // Create data providers (will be re-initialized after delayed init)
    this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
    this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
    await TypingIndexer.create({ workspaceRoot: this.workspaceRoots[0] }, this.fileSystemProvider, this.connection);
    this.languageService = getLanguageService({
      customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
      useDefaultDataProvider: false
    });

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
      const shouldComplete = this.shouldCompleteJavascript(params);
      if (shouldComplete) {
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

  public shouldCompleteJavascript(params: CompletionParams): boolean {
    return params.context?.triggerCharacter !== '{';
  }

  public findBindItems(docBasename: string): CompletionItem[] {
    const customTags: CompletionItem[] = [];
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
      return null;
    }

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
      if (!this.isDelayedInitializationComplete) {
        return {
          contents: nls.localize('server_initializing_message')
        };
      }
      this.auraDataProvider.activated = false;
      this.lwcDataProvider.activated = true;
      return this.languageService.doHover(doc, position, htmlDoc);
    } else if (await this.context.isAuraMarkup(doc)) {
      if (!this.isDelayedInitializationComplete) {
        return null;
      }
      this.auraDataProvider.activated = true;
      this.lwcDataProvider.activated = false;
      return this.languageService.doHover(doc, position, htmlDoc);
    } else {
      return null;
    }
  }

  /**
   * Syncs FileSystemDataProvider from TextDocuments when a document is opened.
   * This avoids duplicate reads - TextDocuments is the source of truth for open files.
   */
  private async onDidOpen(changeEvent: { document: TextDocument }): Promise<void> {
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

    // Perform delayed initialization once file loading has stabilized
    // scheduleReinitialization waits for file count to stabilize (no changes for 1.5 seconds)
    // This ensures all files from bootstrapWorkspaceAwareness are loaded before initialization
    if (!this.isDelayedInitializationComplete) {
      void scheduleReinitialization(this.textDocumentsFileSystemProvider, () => this.performDelayedInitialization());
    }
  }

  public async onDidChangeContent(changeEvent: TextDocumentChangeEvent<TextDocument>): Promise<void> {
    const { document } = changeEvent;
    const { uri } = document;
    const content = document.getText();

    // Normalize URI to fsPath before syncing (entry point for path normalization)
    const normalizedPath = normalizePath(URI.parse(uri).fsPath);
    await syncDocumentToTextDocumentsProvider(
      normalizedPath,
      content,
      this.textDocumentsFileSystemProvider,
      this.workspaceRoots
    );

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
            this.context.updateNamespaceRootTypeCache();
            await this.componentIndexer.updateSfdxTsConfigPath(this.connection);
          } else {
            const hasDeleteEvent = await containsDeletedLwcWatchedDirectory(this.context, changes);
            if (hasDeleteEvent) {
              // We need to scan the file system for deletion events as the change event does not include
              // information about the files that were deleted.
              await this.componentIndexer.updateSfdxTsConfigPath(this.connection);
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

    // Normalize URI to fsPath before syncing (entry point for path normalization)
    const normalizedPath = normalizePath(URI.parse(uri).fsPath);
    await syncDocumentToTextDocumentsProvider(
      normalizedPath,
      content,
      this.textDocumentsFileSystemProvider,
      this.workspaceRoots
    );

    if (await this.context.isLWCJavascript(document)) {
      const { metadata } = javascriptCompileDocument(document);
      if (metadata) {
        const tag: Tag | null = this.componentIndexer.findTagByURI(document.uri);
        if (tag) {
          void updateTagMetadata(tag, metadata);
        }
      }
    }
  }

  public async onShutdown(): Promise<void> {
    // Persist custom components for faster startup on next session
    this.componentIndexer.persistCustomComponents();

    await this.connection.sendNotification(ShowMessageNotification.type, {
      type: MessageType.Info,
      message: 'LWC Language Server shutting down'
    });
  }

  public async onExit(): Promise<void> {
    // Persist custom components for faster startup on next session
    this.componentIndexer.persistCustomComponents();

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
        result = tag ? getAllLocations(tag, this.fileSystemProvider) : [];
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
   * Performs delayed initialization of context and component indexer
   * using the populated textDocumentsFileSystemProvider
   */
  private async performDelayedInitialization(): Promise<void> {
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

      // Update data providers to use the new indexer
      this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
      this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
      await TypingIndexer.create(
        { workspaceRoot: this.workspaceRoots[0] },
        this.textDocumentsFileSystemProvider,
        this.connection
      );
      this.languageService = getLanguageService({
        customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
        useDefaultDataProvider: false
      });

      this.isDelayedInitializationComplete = true;

      // Configure TypeScript support now that files are loaded and context is initialized
      // This ensures sfdx-project.json is available in the FileSystemDataProvider
      try {
        const hasTsEnabled = await this.isTsSupportEnabled();
        Logger.info(`[LWC Server] TypeScript support enabled: ${hasTsEnabled}`);
        if (hasTsEnabled) {
          Logger.info('[LWC Server] Configuring project for TypeScript...');
          // Set connection for file operations (works in both Node.js and web)
          this.context.setConnection(this.connection);
          // Make tsconfig generation non-blocking to avoid connection disposal issues
          // Fire and forget - if it fails, we'll continue without tsconfig
          void this.context.configureProjectForTs().then(async () => {
            Logger.info('[LWC Server] Updating tsconfig.sfdx.json path mappings...');
            // Ensure component indexer has the correct workspaceType before updating path mappings
            // The component indexer's workspaceType is set in init(), but we want to ensure it's correct
            if (this.componentIndexer.workspaceType === 'UNKNOWN') {
              this.componentIndexer.workspaceType = this.workspaceType;
            }
            await this.componentIndexer.updateSfdxTsConfigPath(this.connection);
            Logger.info('[LWC Server] TypeScript configuration complete');
          }).catch((tsConfigError) => {
            // Log error but don't crash the server - tsconfig generation is optional
            Logger.error(
              `[LWC Server] Failed to configure TypeScript support: ${tsConfigError instanceof Error ? tsConfigError.message : String(tsConfigError)}`,
              tsConfigError instanceof Error ? tsConfigError : undefined
            );
            Logger.info('[LWC Server] Continuing without TypeScript configuration');
          });
        } else {
          Logger.info('[LWC Server] TypeScript support is disabled, skipping tsconfig generation');
        }
      } catch (tsConfigError) {
        // Log error but don't crash the server - tsconfig generation is optional
        Logger.error(
          `[LWC Server] Failed to check TypeScript support: ${tsConfigError instanceof Error ? tsConfigError.message : String(tsConfigError)}`,
          tsConfigError instanceof Error ? tsConfigError : undefined
        );
        Logger.info('[LWC Server] Continuing without TypeScript configuration');
      }

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
    }
  }
}
