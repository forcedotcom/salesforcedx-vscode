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

    if (!this.languageService) {
      Logger.error('[LWC Server] onCompletion: languageService is not initialized');
      return;
    }

    const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);

    const isLWCTemplate = await this.context.isLWCTemplate(doc);
    const isLWCJavascript = await this.context.isLWCJavascript(doc);
    const isAuraMarkup = await this.context.isAuraMarkup(doc);

    if (isLWCTemplate) {
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
    } else if (isLWCJavascript) {
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
    } else if (isAuraMarkup) {
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
    Logger.info(`[onHover] Called with params: ${JSON.stringify({ uri: params?.textDocument?.uri, position: params?.position })}`);
    
    if (!params?.textDocument || !params.position) {
      Logger.warn('[onHover] Missing params or position');
      return null;
    }

    const {
      position,
      textDocument: { uri }
    } = params;

    Logger.info(`[onHover] Processing URI: ${uri}, position: ${position.line}:${position.character}`);

    const doc = this.documents.get(uri);
    if (!doc) {
      Logger.warn(`[onHover] Document not found for URI: ${uri}`);
      return null;
    }

    Logger.info(`[onHover] Document found, languageId: ${doc.languageId}, uri: ${doc.uri}`);

    try {
      const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);
      Logger.info('[onHover] HTML document parsed successfully');

      try {
        const isLWCTemplate = await this.context.isLWCTemplate(doc);
        Logger.info(`[onHover] isLWCTemplate result: ${isLWCTemplate}`);
        
        if (isLWCTemplate) {
          Logger.info(`[onHover] Document is LWC template, isDelayedInitializationComplete: ${this.isDelayedInitializationComplete}`);
          if (!this.isDelayedInitializationComplete) {
            Logger.info('[onHover] Returning initialization message');
            return {
              contents: nls.localize('server_initializing_message')
            };
          }
          this.auraDataProvider.activated = false;
          this.lwcDataProvider.activated = true;
          Logger.info('[onHover] Calling languageService.doHover for LWC template');
          const hoverResult = this.languageService.doHover(doc, position, htmlDoc);
          Logger.info(`[onHover] doHover returned: ${hoverResult ? 'result' : 'null'}`);
          return hoverResult;
        }
      } catch (error) {
        Logger.error(`[onHover] Error checking isLWCTemplate: ${error instanceof Error ? error.message : String(error)}`, error);
      }

      try {
        const isAuraMarkup = await this.context.isAuraMarkup(doc);
        Logger.info(`[onHover] isAuraMarkup result: ${isAuraMarkup}`);
        
        if (isAuraMarkup) {
          Logger.info(`[onHover] Document is Aura markup, isDelayedInitializationComplete: ${this.isDelayedInitializationComplete}`);
          if (!this.isDelayedInitializationComplete) {
            Logger.info('[onHover] Returning null (not initialized)');
            return null;
          }
          this.auraDataProvider.activated = true;
          this.lwcDataProvider.activated = false;
          Logger.info('[onHover] Calling languageService.doHover for Aura markup');
          const hoverResult = this.languageService.doHover(doc, position, htmlDoc);
          Logger.info(`[onHover] doHover returned: ${hoverResult ? 'result' : 'null'}`);
          return hoverResult;
        }
      } catch (error) {
        Logger.error(`[onHover] Error checking isAuraMarkup: ${error instanceof Error ? error.message : String(error)}`, error);
      }

      Logger.info('[onHover] Document is neither LWC template nor Aura markup, returning null');
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
    // Use fileSystemProvider.uriToNormalizedPath to handle both file:// and memfs:// schemes correctly
    const normalizedPath = this.fileSystemProvider.uriToNormalizedPath(uri);
    await syncDocumentToTextDocumentsProvider(normalizedPath, content, this.fileSystemProvider, this.workspaceRoots);

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
    Logger.info(`[onDefinition] Called with params: ${JSON.stringify({ uri: params?.textDocument?.uri, position: params?.position })}`);
    
    try {
      const cursorInfo: CursorInfo | null = this.cursorInfo(params);
      Logger.info(`[onDefinition] cursorInfo: ${cursorInfo ? JSON.stringify({ type: cursorInfo.type, name: cursorInfo.name, tag: cursorInfo.tag }) : 'null'}`);
      
      if (!cursorInfo) {
        Logger.info('[onDefinition] No cursorInfo, returning empty array');
        return [];
      }

      const tag: Tag | null = cursorInfo.tag ? this.componentIndexer.findTagByName(cursorInfo.tag) : null;
      Logger.info(`[onDefinition] Found tag: ${tag ? `tag.file=${tag.file}` : 'null'}`);

      let result: Location[] = [];
      switch (cursorInfo.type) {
        case 'tag':
          if (tag) {
            try {
              Logger.info(`[onDefinition] Getting all locations for tag: ${cursorInfo.tag}, tag.file: ${tag.file}`);
              result = getAllLocations(tag, this.fileSystemProvider);
              Logger.info(`[onDefinition] getAllLocations returned ${result.length} locations: ${result.map(l => l.uri).join(', ')}`);
            } catch (error) {
              Logger.error(`[onDefinition] Error getting all locations for tag ${cursorInfo.tag}: ${error instanceof Error ? error.message : String(error)}`, error);
              result = [];
            }
          } else {
            Logger.warn(`[onDefinition] Tag not found for name: ${cursorInfo.tag}`);
          }
          break;

        case 'attributeKey':
          const attr: AttributeInfo | null = tag ? getAttribute(tag, cursorInfo.name) : null;
          Logger.info(`[onDefinition] attributeKey case, attr: ${attr ? `location=${attr.location?.uri}` : 'null'}`);
          if (attr?.location) {
            result = [attr.location];
            Logger.info(`[onDefinition] Returning attribute location: ${attr.location.uri}`);
          } else {
            Logger.warn(`[onDefinition] No location found for attribute: ${cursorInfo.name}`);
          }
          break;

        case 'dynamicContent':
        case 'dynamicAttributeValue':
          const { uri } = params.textDocument;
          Logger.info(`[onDefinition] ${cursorInfo.type} case, uri: ${uri}, cursorInfo.range: ${cursorInfo.range ? 'exists' : 'null'}`);
          if (cursorInfo.range) {
            result = [Location.create(uri, cursorInfo.range)];
            Logger.info(`[onDefinition] Returning range location: ${uri}`);
          } else {
            try {
              Logger.info(`[onDefinition] Finding component by URI: ${uri}`);
              const component: Tag | null = this.componentIndexer.findTagByURI(uri);
              Logger.info(`[onDefinition] Component found: ${component ? `tag.file=${component.file}` : 'null'}`);
              if (component) {
                Logger.info(`[onDefinition] Getting class member location for: ${cursorInfo.name}`);
                const location = getClassMemberLocation(component, cursorInfo.name, this.fileSystemProvider);
                Logger.info(`[onDefinition] Class member location: ${location ? location.uri : 'null'}`);
                if (location) {
                  result = [location];
                }
              }
            } catch (error) {
              Logger.error(`[onDefinition] Error getting class member location: ${error instanceof Error ? error.message : String(error)}`, error);
            }
          }
          break;

        default:
          Logger.info(`[onDefinition] Unknown cursorInfo.type: ${cursorInfo.type}`);
          break;
      }

      Logger.info(`[onDefinition] Returning ${result.length} locations`);
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
      await this.componentIndexer.updateSfdxTsConfigPath(this.connection);
    }
  }

  /**
   * Performs delayed initialization of context and component indexer
   * Files are loaded into fileSystemProvider via onDidOpen events
   */
  protected async performDelayedInitialization(): Promise<void> {
    if (this.isDelayedInitializationComplete) {
      return;
    }

    try {
      // Initialize workspace context now that essential files are loaded via onDidOpen
      // scheduleReinitialization waits for file loading to stabilize, so all files should be available
      this.context.initialize(this.workspaceType);

      // Clear namespace cache to force re-detection now that files are synced
      // This ensures directoryExists can infer directory existence from file paths
      this.context.clearNamespaceCache();

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

      this.isDelayedInitializationComplete = true;

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
    }
  }
}
