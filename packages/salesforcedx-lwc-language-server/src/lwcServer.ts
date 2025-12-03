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
  BaseWorkspaceContext,
  syncDocumentToTextDocumentsProvider,
  scheduleReinitialization,
  normalizePath
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

    this.documents.listen(this.connection);
  }

  public async onInitialize(params: InitializeParams): Promise<InitializeResult> {
    console.log('[onInitialize] Starting initialization');
    this.workspaceFolders = params.workspaceFolders ?? [];
    // Normalize workspaceRoots at entry point to ensure all paths are consistent
    // This ensures all downstream code receives normalized paths
    this.workspaceRoots = this.workspaceFolders.map(folder => normalizePath(URI.parse(folder.uri).fsPath));
    console.log(`[onInitialize] Workspace roots: ${this.workspaceRoots.join(', ')}`);

    // Set up document event handlers
    this.documents.onDidOpen(changeEvent => this.onDidOpen(changeEvent));
    this.documents.onDidChangeContent(changeEvent => this.onDidChangeContent(changeEvent));
    this.documents.onDidSave(changeEvent => this.onDidSave(changeEvent));

    this.context = new LWCWorkspaceContext(this.workspaceRoots, this.fileSystemProvider);
    console.log('[onInitialize] Created LWCWorkspaceContext');

    this.componentIndexer = new ComponentIndexer({
      workspaceRoot: this.workspaceRoots[0],
      fileSystemProvider: this.fileSystemProvider
    });
    console.log('[onInitialize] Created ComponentIndexer');

    this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
    this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
    await TypingIndexer.create({ workspaceRoot: this.workspaceRoots[0] }, this.fileSystemProvider);
    this.languageService = getLanguageService({
      customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
      useDefaultDataProvider: false
    });

    await this.context.initialize();
    console.log('[onInitialize] Context initialized');
    this.context.configureProject();
    console.log('[onInitialize] Project configured');

    // Initialize componentIndexer to get workspace structure
    console.log('[onInitialize] Starting componentIndexer.init()');
    await this.componentIndexer.init();
    const tagsAfterInit = this.componentIndexer.getCustomData();
    console.log(`[onInitialize] componentIndexer.init() complete. Total tags: ${tagsAfterInit.length}`);
    if (tagsAfterInit.length > 0) {
      console.log(`[onInitialize] Tag names after init: ${tagsAfterInit.map(tag => getTagName(tag)).join(', ')}`);
    } else {
      console.log('[onInitialize] WARNING: No tags found after initialization. Checking fileSystemProvider state...');
      const allFileUris = this.fileSystemProvider.getAllFileUris();
      console.log(`[onInitialize] fileSystemProvider has ${allFileUris.length} files`);
      if (allFileUris.length > 0 && allFileUris.length <= 50) {
        console.log(`[onInitialize] fileSystemProvider file URIs: ${allFileUris.join(', ')}`);
      } else if (allFileUris.length > 50) {
        console.log(`[onInitialize] fileSystemProvider file URIs (first 25): ${allFileUris.slice(0, 25).join(', ')}`);
        console.log(`[onInitialize] fileSystemProvider file URIs (last 25): ${allFileUris.slice(-25).join(', ')}`);
      }
    }

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
      console.log(`[onCompletion] No document found for uri: ${uri}`);
      return;
    }

    console.log(
      `[onCompletion] Processing completion for uri: ${uri}, position: ${position.line}:${position.character}`
    );
    console.log(`[onCompletion] Document language: ${doc.languageId}, version: ${doc.version}`);
    const docText = doc.getText();
    const textAroundPosition = docText.substring(
      Math.max(0, doc.offsetAt(position) - 20),
      Math.min(docText.length, doc.offsetAt(position) + 20)
    );
    console.log(`[onCompletion] Text around position: "${textAroundPosition}"`);
    console.log(`[onCompletion] Trigger character: ${params.context?.triggerCharacter ?? 'none'}`);

    const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);

    const isLWCTemplate = await this.context.isLWCTemplate(doc);
    const isLWCJavascript = await this.context.isLWCJavascript(doc);
    const isAuraMarkup = await this.context.isAuraMarkup(doc);
    console.log(
      `[onCompletion] Document type - isLWCTemplate: ${isLWCTemplate}, isLWCJavascript: ${isLWCJavascript}, isAuraMarkup: ${isAuraMarkup}`
    );

    if (isLWCTemplate) {
      this.auraDataProvider.activated = false; // provide completions for lwc components in an Aura template
      this.lwcDataProvider.activated = true; // provide completions for lwc components in an LWC template
      const shouldProvideBindings = this.shouldProvideBindingsInHTML(params);
      console.log(
        `[onCompletion] LWC template - shouldProvideBindingsInHTML: ${shouldProvideBindings}, triggerCharacter: ${params.context?.triggerCharacter}, isWithinCurlyBraces: ${this.isWithinCurlyBraces(params)}`
      );
      if (shouldProvideBindings) {
        const docBasename = getBasename(doc);
        console.log(`[onCompletion] LWC template - finding bind items for basename: ${docBasename}`);
        const customTags: CompletionItem[] = this.findBindItems(docBasename);
        console.log(`[onCompletion] LWC template - found ${customTags.length} bind items`);
        if (customTags.length > 0 && customTags.length <= 20) {
          console.log(
            `[onCompletion] LWC template - bind item labels: ${customTags.map(item => item.label).join(', ')}`
          );
        }
        return {
          isIncomplete: false,
          items: customTags
        };
      } else {
        console.log(
          '[onCompletion] LWC template - shouldProvideBindingsInHTML returned false, falling through to languageService.doComplete'
        );
      }
    } else if (isLWCJavascript) {
      const shouldComplete = this.shouldCompleteJavascript(params);
      console.log(
        `[onCompletion] LWC JavaScript - shouldCompleteJavascript: ${shouldComplete}, triggerCharacter: ${params.context?.triggerCharacter}`
      );
      if (shouldComplete) {
        const customData = this.componentIndexer.getCustomData();
        console.log(
          `[onCompletion] LWC JavaScript - componentIndexer.getCustomData() returned ${customData.length} tags`
        );
        if (customData.length > 0) {
          console.log(
            `[onCompletion] LWC JavaScript - tag names: ${customData.map(tag => getTagName(tag)).join(', ')}`
          );
          console.log(`[onCompletion] LWC JavaScript - tag files: ${customData.map(tag => tag.file).join(', ')}`);
        } else {
          console.log(
            '[onCompletion] LWC JavaScript - WARNING: componentIndexer.getCustomData() returned empty array. Checking componentIndexer state...'
          );
          console.log(
            `[onCompletion] LWC JavaScript - componentIndexer.workspaceRoot: ${this.componentIndexer.workspaceRoot}`
          );
          console.log(
            `[onCompletion] LWC JavaScript - componentIndexer.workspaceType: ${this.componentIndexer.workspaceType}`
          );
          console.log(`[onCompletion] LWC JavaScript - componentIndexer.tags.size: ${this.componentIndexer.tags.size}`);
          if (this.componentIndexer.tags.size > 0) {
            const tagNames = Array.from(this.componentIndexer.tags.keys());
            console.log(`[onCompletion] LWC JavaScript - componentIndexer.tags keys: ${tagNames.join(', ')}`);
          }
          const allFileUris = this.componentIndexer.fileSystemProvider.getAllFileUris();
          console.log(`[onCompletion] LWC JavaScript - fileSystemProvider has ${allFileUris.length} files`);
          if (allFileUris.length > 0 && allFileUris.length <= 20) {
            console.log(`[onCompletion] LWC JavaScript - fileSystemProvider file URIs: ${allFileUris.join(', ')}`);
          } else if (allFileUris.length > 20) {
            console.log(
              `[onCompletion] LWC JavaScript - fileSystemProvider file URIs (first 10): ${allFileUris.slice(0, 10).join(', ')}`
            );
            console.log(
              `[onCompletion] LWC JavaScript - fileSystemProvider file URIs (last 10): ${allFileUris.slice(-10).join(', ')}`
            );
          }
          // Check if there are any LWC component files in the file system provider
          const lwcFiles = allFileUris.filter(fileUri => fileUri.includes('/lwc/') && fileUri.endsWith('.js'));
          console.log(`[onCompletion] LWC JavaScript - Found ${lwcFiles.length} .js files in /lwc/ directories`);
          if (lwcFiles.length > 0 && lwcFiles.length <= 20) {
            console.log(`[onCompletion] LWC JavaScript - LWC .js files: ${lwcFiles.join(', ')}`);
          }
        }
        const customTags = customData.map(tag => ({
          label: getLwcTypingsName(tag),
          kind: CompletionItemKind.Folder
        }));
        console.log(`[onCompletion] LWC JavaScript - returning ${customTags.length} completion items`);
        if (customTags.length > 0 && customTags.length <= 20) {
          console.log(
            `[onCompletion] LWC JavaScript - completion item labels: ${customTags.map(item => item.label).join(', ')}`
          );
        }
        return {
          isIncomplete: false,
          items: customTags
        };
      } else {
        console.log('[onCompletion] LWC JavaScript - shouldCompleteJavascript returned false, returning undefined');
        return;
      }
    } else if (isAuraMarkup) {
      this.auraDataProvider.activated = true;
      this.lwcDataProvider.activated = false;
    } else {
      console.log('[onCompletion] Document type not recognized, returning undefined');
      return;
    }

    const languageServiceResult = this.languageService.doComplete(doc, position, htmlDoc);
    console.log(
      `[onCompletion] languageService.doComplete returned ${languageServiceResult?.items?.length ?? 0} items`
    );
    if (
      languageServiceResult?.items &&
      languageServiceResult.items.length > 0 &&
      languageServiceResult.items.length <= 20
    ) {
      console.log(
        `[onCompletion] languageService completion item labels: ${languageServiceResult.items
          .slice(0, 10)
          .map(item => item.label)
          .join(', ')}`
      );
    }
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
    console.log(`[findBindItems] Looking for bind items for docBasename: ${docBasename}`);
    const customTags: CompletionItem[] = [];
    const allTags = this.componentIndexer.getCustomData();
    console.log(`[findBindItems] Checking ${allTags.length} tags for match with basename: ${docBasename}`);
    if (allTags.length === 0) {
      console.log(
        `[findBindItems] WARNING: No tags available. componentIndexer.tags.size: ${this.componentIndexer.tags.size}`
      );
      console.log(`[findBindItems] componentIndexer.workspaceRoot: ${this.componentIndexer.workspaceRoot}`);
      console.log(`[findBindItems] componentIndexer.workspaceType: ${this.componentIndexer.workspaceType}`);
    }
    allTags.forEach(tag => {
      const tagName = getTagName(tag);
      console.log(`[findBindItems] Checking tag: ${tagName} (file: ${tag.file}) against basename: ${docBasename}`);
      if (tagName === docBasename) {
        console.log(`[findBindItems] Found matching tag: ${tagName}, getting class members`);
        const classMembers = getClassMembers(tag);
        console.log(`[findBindItems] Found ${classMembers.length} class members for tag ${tagName}`);
        if (classMembers.length > 0 && classMembers.length <= 20) {
          console.log(
            `[findBindItems] Class member names: ${classMembers.map(cm => `${cm.name} (${cm.type}, ${cm.decorator ?? 'no decorator'})`).join(', ')}`
          );
        }
        classMembers.forEach(cm => {
          const bindName = `${getTagName(tag)}.${cm.name}`;
          const kind = cm.type === 'method' ? CompletionItemKind.Function : CompletionItemKind.Property;
          const detail = cm.decorator ? `@${cm.decorator}` : '';
          customTags.push({ label: cm.name, kind, documentation: bindName, detail, sortText: bindName });
        });
      } else {
        console.log(`[findBindItems] Tag ${tagName} does not match basename ${docBasename}`);
      }
    });
    console.log(`[findBindItems] Returning ${customTags.length} bind items`);
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

    const isLWCTemplate = await this.context.isLWCTemplate(doc);
    const isAuraMarkup = await this.context.isAuraMarkup(doc);

    if (isLWCTemplate) {
      this.auraDataProvider.activated = false;
      this.lwcDataProvider.activated = true;
    } else if (isAuraMarkup) {
      this.auraDataProvider.activated = true;
      this.lwcDataProvider.activated = false;
    } else {
      return null;
    }

    const hover = this.languageService.doHover(doc, position, htmlDoc);
    return hover;
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

    // Check if this is sfdx-project.json and re-detect workspace type if needed
    const fileName = normalizedPath.split('/').pop();
    if (fileName === 'sfdx-project.json' && this.context.type === 'UNKNOWN') {
      // Update context to use the populated TextDocuments provider
      this.context.fileSystemProvider = this.textDocumentsFileSystemProvider;

      // Wait for files to be processed before re-initializing
      void scheduleReinitialization(this.textDocumentsFileSystemProvider, () => this.performReinitialization());

      void this.context.initialize();
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

    // Normalize URI to fsPath before syncing (entry point for path normalization)
    const normalizedPath = normalizePath(URI.parse(uri).fsPath);
    void syncDocumentToTextDocumentsProvider(
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

  public onShutdown(): void {
    // Persist custom components for faster startup on next session
    this.componentIndexer.persistCustomComponents();

    void this.connection.sendNotification(ShowMessageNotification.type, {
      type: MessageType.Info,
      message: 'LWC Language Server shutting down'
    });
  }

  public onExit(): void {
    // Persist custom components for faster startup on next session
    this.componentIndexer.persistCustomComponents();

    void this.connection.sendNotification(ShowMessageNotification.type, {
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

  /**
   * Performs the actual re-initialization of component indexer and data providers
   */
  private async performReinitialization(): Promise<void> {
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
    await TypingIndexer.create({ workspaceRoot: this.workspaceRoots[0] }, this.textDocumentsFileSystemProvider);
    this.languageService = getLanguageService({
      customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
      useDefaultDataProvider: false
    });

    // send notification that re-initialization is complete with new FileSystemProvider
    void this.connection.sendNotification(ShowMessageNotification.type, {
      type: MessageType.Info,
      message: 'LWC Language Server is ready'
    });
  }
}
