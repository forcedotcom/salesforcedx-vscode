/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
    interceptConsoleLogger,
    isLWCWatchedDirectory,
    isLWCRootDirectoryCreated,
    containsDeletedLwcWatchedDirectory,
    toResolvedPath,
    getBasename,
    AttributeInfo,
    FileSystemDataProvider,
    FileSystemRequests,
    FileSystemNotifications,
    FileStat,
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
    CompletionItemKind,
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
    TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { URI } from 'vscode-uri';
import { AuraDataProvider } from './auraDataProvider';
import ComponentIndexer from './componentIndexer';
import { TYPESCRIPT_SUPPORT_SETTING } from './constants';
import { LWCWorkspaceContext } from './context/lwcContext';
import { compileDocument as javascriptCompileDocument } from './javascript/compiler';
import { LWCDataProvider } from './lwcDataProvider';

import { Tag, getTagName, getLwcTypingsName, getClassMembers, getAttribute, getAllLocations, updateTagMetadata, getClassMemberLocation } from './tag';
import templateLinter from './template/linter';
import TypingIndexer from './typingIndexer';

const propertyRegex = new RegExp(/\{(?<property>\w+)\.*.*\}/);
const iteratorRegex = new RegExp(/iterator:(?<name>\w+)/);

type Token = 'tag' | 'attributeKey' | 'attributeValue' | 'dynamicAttributeValue' | 'content' | 'dynamicContent';

type CursorInfo = {
    name: string;
    type: Token;
    tag?: string;
    range?: any;
};

export const findDynamicContent = (text: string, offset: number): string | null => {
    const regex = new RegExp(/\{(?<property>\w+)\.*|\:*\w+\}/, 'g');
    let match = regex.exec(text);
    while (match && offset > match.index) {
        if (match.groups?.property && offset > match.index && regex.lastIndex > offset) {
            return match.groups.property;
        }
        match = regex.exec(text);
    }
    return null;
};

console.log('LWC Server module: Starting import');

export default class Server {
    public readonly connection: Connection = createConnection();
    public readonly documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
    private context: LWCWorkspaceContext;
    private workspaceFolders: WorkspaceFolder[];
    private workspaceRoots: string[];
    public componentIndexer: ComponentIndexer;
    private typingIndexer: TypingIndexer;
    public languageService: LanguageService;
    public auraDataProvider: AuraDataProvider;
    public lwcDataProvider: LWCDataProvider;
    public fileSystemProvider: FileSystemDataProvider;

    constructor() {
        console.log('LWC Server constructor: Starting');
        this.fileSystemProvider = new FileSystemDataProvider();
        console.log('LWC Server constructor: Created fileSystemProvider');

        this.connection.onInitialize(this.onInitialize.bind(this));
        console.log('LWC Server constructor: Registered onInitialize');
        this.connection.onInitialized(this.onInitialized.bind(this));
        console.log('LWC Server constructor: Registered onInitialized');
        this.connection.onCompletion(this.onCompletion.bind(this));
        console.log('LWC Server constructor: Registered onCompletion');
        this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
        console.log('LWC Server constructor: Registered onCompletionResolve');
        this.connection.onHover(this.onHover.bind(this));
        console.log('LWC Server constructor: Registered onHover');
        this.connection.onShutdown(this.onShutdown.bind(this));
        console.log('LWC Server constructor: Registered onShutdown');
        this.connection.onDefinition(this.onDefinition.bind(this));
        console.log('LWC Server constructor: Registered onDefinition');
        this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));
        console.log('LWC Server constructor: Registered onDidChangeWatchedFiles');

        // Register file system notification handlers
        this.connection.onNotification(FileSystemNotifications.FILE_CONTENT_CHANGED, this.onFileContentChanged.bind(this));
        console.log('LWC Server constructor: Registered file system notification handlers');

        this.documents.listen(this.connection);
        console.log('LWC Server constructor: Started documents listener');
        this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
        console.log('LWC Server constructor: Registered onDidChangeContent');
        this.documents.onDidSave(this.onDidSave.bind(this));
        console.log('LWC Server constructor: Registered onDidSave');
        console.log('LWC Server constructor: Completed successfully');
    }

    public async onInitialize(params: InitializeParams): Promise<InitializeResult> {
        console.log('=== LWC onInitialize START ===');
        console.log('LWC Initialize request received:', {
            workspaceFolders: params.workspaceFolders?.length ?? 0,
            initializationOptions: params.initializationOptions ? Object.keys(params.initializationOptions) : 'none',
        });

        this.workspaceFolders = params.workspaceFolders ?? [];
        this.workspaceRoots = this.workspaceFolders.map((folder) => URI.parse(folder.uri).fsPath);
        console.log('LWC onInitialize: Mapped workspaceRoots:', this.workspaceRoots);

        // Use provided fileSystemProvider from initializationOptions if available
        if (params.initializationOptions?.fileSystemProvider) {
            console.log('LWC onInitialize: Reconstructing fileSystemProvider from serialized data');
            // Reconstruct the FileSystemDataProvider from serialized data
            const serializedProvider = params.initializationOptions.fileSystemProvider;
            if (typeof serializedProvider !== 'object' || serializedProvider === null) {
                throw new Error('Invalid fileSystemProvider in initializationOptions');
            }
            this.fileSystemProvider = new FileSystemDataProvider();

            // Restore the data from the serialized object
            if (serializedProvider.fileContents && typeof serializedProvider.fileContents === 'object') {
                console.log('LWC onInitialize: Restoring fileContents:', Object.keys(serializedProvider.fileContents).length, 'files');
                for (const [uri, content] of Object.entries(serializedProvider.fileContents)) {
                    if (typeof content === 'string') {
                        this.fileSystemProvider.updateFileContent(uri, content);
                    }
                }
            }

            if (serializedProvider.directoryListings && typeof serializedProvider.directoryListings === 'object') {
                console.log('LWC onInitialize: Restoring directoryListings:', Object.keys(serializedProvider.directoryListings).length, 'directories');
                for (const [uri, entries] of Object.entries(serializedProvider.directoryListings)) {
                    if (Array.isArray(entries)) {
                        this.fileSystemProvider.updateDirectoryListing(uri, entries);
                    }
                }
            }

            if (serializedProvider.fileStats && typeof serializedProvider.fileStats === 'object') {
                console.log('LWC onInitialize: Restoring fileStats:', Object.keys(serializedProvider.fileStats).length, 'stats');
                for (const [uri, stat] of Object.entries(serializedProvider.fileStats)) {
                    if (typeof stat === 'object' && stat !== null) {
                        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                        this.fileSystemProvider.updateFileStat(uri, stat as FileStat);
                    }
                }
            }

            if (serializedProvider.workspaceConfig && typeof serializedProvider.workspaceConfig === 'object') {
                console.log('LWC onInitialize: Restoring workspaceConfig');
                this.fileSystemProvider.updateWorkspaceConfig(serializedProvider.workspaceConfig);
            }
            console.log('LWC onInitialize: FileSystemDataProvider reconstructed successfully');
        }

        // Register file system request handlers that depend on fileSystemProvider after reconstruction
        this.connection.onRequest(FileSystemRequests.GET_FILE_CONTENT, this.onGetFileContent.bind(this));
        this.connection.onRequest(FileSystemRequests.GET_DIRECTORY_LISTING, this.onGetDirectoryListing.bind(this));
        this.connection.onRequest(FileSystemRequests.GET_FILE_STAT, this.onGetFileStat.bind(this));
        this.connection.onRequest(FileSystemRequests.CREATE_TYPING_FILES, this.onCreateTypingFiles.bind(this));
        this.connection.onRequest(FileSystemRequests.DELETE_TYPING_FILES, this.onDeleteTypingFiles.bind(this));
        this.connection.onRequest(FileSystemRequests.UPDATE_COMPONENT_INDEX, this.onUpdateComponentIndex.bind(this));
        console.log('LWC onInitialize: Registered file system request handlers');

        console.log('LWC onInitialize: Creating workspace context');
        this.context = new LWCWorkspaceContext(this.workspaceRoots, this.fileSystemProvider);
        console.log('LWC onInitialize: Creating component indexer');
        this.componentIndexer = new ComponentIndexer({ workspaceRoot: this.workspaceRoots[0], fileSystemProvider: this.fileSystemProvider });
        console.log('LWC onInitialize: Creating data providers');
        this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
        this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
        console.log('LWC onInitialize: Creating typing indexer');
        this.typingIndexer = await TypingIndexer.create({ workspaceRoot: this.workspaceRoots[0] }, this.fileSystemProvider);
        console.log('LWC onInitialize: Creating language service');
        this.languageService = getLanguageService({
            customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
            useDefaultDataProvider: false,
        });

        console.log('LWC onInitialize: Initializing context');
        await this.context.initialize();
        console.log('LWC onInitialize: Configuring project');
        await this.context.configureProject();
        console.log('LWC onInitialize: Initializing component indexer');
        await this.componentIndexer.init();

        console.log('LWC onInitialize: Returning capabilities');
        console.log('=== LWC onInitialize END ===');
        return this.capabilities;
    }

    public get capabilities(): InitializeResult {
        return {
            capabilities: {
                textDocumentSync: {
                    openClose: true,
                    change: TextDocumentSyncKind.Full,
                },
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: ['.', '-', '_', '<', '"', '=', '/', '>', '{'],
                },
                hoverProvider: true,
                definitionProvider: true,
                workspace: {
                    workspaceFolders: {
                        supported: true,
                    },
                },
            },
        };
    }

    public async onInitialized(): Promise<void> {
        console.log('=== LWC onInitialized START ===');
        const hasTsEnabled = await this.isTsSupportEnabled();
        console.log('LWC onInitialized: TypeScript support enabled:', hasTsEnabled);
        if (hasTsEnabled) {
            try {
                console.log('LWC onInitialized: Configuring project for TypeScript');
                await this.context.configureProjectForTs();
                console.log('LWC onInitialized: TypeScript project configuration completed');
            } catch (error) {
                console.error('LWC onInitialized: Error in configureProjectForTs:', error);
                throw error;
            }
            console.log('LWC onInitialized: Updating SFDX TypeScript config path');
            await this.componentIndexer.updateSfdxTsConfigPath();
            console.log('LWC onInitialized: SFDX TypeScript config path updated');
        }
        console.log('=== LWC onInitialized END ===');
    }

    public async isTsSupportEnabled(): Promise<any> {
        return this.connection.workspace.getConfiguration(TYPESCRIPT_SUPPORT_SETTING);
    }

    public async onCompletion(params: CompletionParams): Promise<CompletionList | undefined> {
        console.log('=== LWC onCompletion START ===');
        console.log('LWC Completion request received:', {
            uri: params.textDocument.uri,
            position: params.position,
            context: params.context,
        });

        const {
            position,
            textDocument: { uri },
        } = params;
        const doc = this.documents.get(uri);
        if (!doc) {
            console.log('LWC onCompletion: Document not found for URI:', uri);
            console.log('=== LWC onCompletion END (no document) ===');
            return;
        }

        console.log('LWC onCompletion: Document found:', {
            uri: doc.uri,
            languageId: doc.languageId,
            version: doc.version,
            lineCount: doc.lineCount,
        });

        const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);
        console.log('LWC onCompletion: HTML document parsed successfully');

        if (await this.context.isLWCTemplate(doc)) {
            console.log('LWC onCompletion: Processing as LWC template');
            this.auraDataProvider.activated = false; // provide completions for lwc components in an Aura template
            this.lwcDataProvider.activated = true; // provide completions for lwc components in an LWC template
            if (this.shouldProvideBindingsInHTML(params)) {
                console.log('LWC onCompletion: Providing bindings in HTML');
                const docBasename = getBasename(doc);
                const customTags: CompletionItem[] = this.findBindItems(docBasename);
                console.log('LWC onCompletion: Found bind items:', customTags.length);
                console.log('=== LWC onCompletion END (bindings) ===');
                return {
                    isIncomplete: false,
                    items: customTags,
                };
            }
        } else if (await this.context.isLWCJavascript(doc)) {
            console.log('LWC onCompletion: Processing as LWC JavaScript');
            if (this.shouldCompleteJavascript(params)) {
                console.log('LWC onCompletion: Providing JavaScript completions');
                const customTags = this.componentIndexer.getCustomData().map((tag) => ({
                    label: getLwcTypingsName(tag),
                    kind: CompletionItemKind.Folder,
                }));
                console.log('LWC onCompletion: Found custom tags:', customTags.length);
                console.log('=== LWC onCompletion END (javascript) ===');
                return {
                    isIncomplete: false,
                    items: customTags,
                };
            } else {
                console.log('LWC onCompletion: Skipping JavaScript completion');
                console.log('=== LWC onCompletion END (skip javascript) ===');
                return;
            }
        } else if (await this.context.isAuraMarkup(doc)) {
            console.log('LWC onCompletion: Processing as Aura markup');
            this.auraDataProvider.activated = true;
            this.lwcDataProvider.activated = false;
        } else {
            console.log('LWC onCompletion: Document type not recognized');
            console.log('=== LWC onCompletion END (no match) ===');
            return;
        }

        console.log('LWC onCompletion: Using language service for completion');
        const result = this.languageService.doComplete(doc, position, htmlDoc);
        console.log('LWC onCompletion: Language service result:', {
            isIncomplete: result.isIncomplete,
            itemsCount: result.items.length,
        });
        console.log('=== LWC onCompletion END (language service) ===');
        return result;
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
        this.componentIndexer.getCustomData().forEach((tag) => {
            if (getTagName(tag) === docBasename) {
                getClassMembers(tag).forEach((cm) => {
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
        console.log('=== LWC onCompletionResolve START ===');
        console.log('LWC Completion resolve request received:', {
            label: item.label,
            kind: item.kind,
            detail: item.detail,
            documentation: item.documentation,
        });
        console.log('=== LWC onCompletionResolve END ===');
        return item;
    }

    public async onHover(params: TextDocumentPositionParams): Promise<Hover | null> {
        console.log('=== LWC onHover START ===');
        console.log('LWC Hover request received:', {
            uri: params.textDocument.uri,
            position: params.position,
        });

        const {
            position,
            textDocument: { uri },
        } = params;
        const doc = this.documents.get(uri);
        if (!doc) {
            console.log('LWC onHover: Document not found for URI:', uri);
            console.log('=== LWC onHover END (no document) ===');
            return null;
        }

        console.log('LWC onHover: Document found:', {
            uri: doc.uri,
            languageId: doc.languageId,
            version: doc.version,
            lineCount: doc.lineCount,
        });

        const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);
        console.log('LWC onHover: HTML document parsed successfully');

        if (await this.context.isLWCTemplate(doc)) {
            console.log('LWC onHover: Processing as LWC template');
            this.auraDataProvider.activated = false;
            this.lwcDataProvider.activated = true;
        } else if (await this.context.isAuraMarkup(doc)) {
            console.log('LWC onHover: Processing as Aura markup');
            this.auraDataProvider.activated = true;
            this.lwcDataProvider.activated = false;
        } else {
            console.log('LWC onHover: Document type not recognized');
            console.log('=== LWC onHover END (no match) ===');
            return null;
        }

        console.log('LWC onHover: Using language service for hover');
        const result = this.languageService.doHover(doc, position, htmlDoc);
        console.log('LWC onHover: Language service result:', {
            hasContents: result?.contents !== undefined,
            contentsLength: result?.contents ? (typeof result.contents === 'string' ? result.contents.length : 'array') : 0,
            range: result?.range ?? 'no range',
        });
        console.log('=== LWC onHover END ===');
        return result;
    }

    public async onDidChangeContent(changeEvent: any): Promise<void> {
        const { document } = changeEvent;
        const { uri } = document;
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
                    message: `Error updating tsconfig.sfdx.json path mapping: ${e.message}`,
                });
            }
        }
    }

    public async onDidSave(change: TextDocumentChangeEvent<TextDocument>): Promise<void> {
        const { document } = change;
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
            message: 'LWC Language Server shutting down',
        });
    }

    public async onExit(): Promise<void> {
        // Persist custom components for faster startup on next session
        await this.componentIndexer.persistCustomComponents();

        await this.connection.sendNotification(ShowMessageNotification.type, {
            type: MessageType.Info,
            message: 'LWC Language Server exiting',
        });
    }

    public onDefinition(params: TextDocumentPositionParams): Location[] {
        console.log('=== LWC onDefinition START ===');
        console.log('LWC Definition request received:', {
            uri: params.textDocument.uri,
            position: params.position,
        });

        const cursorInfo: CursorInfo | null = this.cursorInfo(params);
        console.log('LWC onDefinition: Cursor info:', {
            hasCursorInfo: cursorInfo !== null,
            type: cursorInfo?.type,
            name: cursorInfo?.name,
            tag: cursorInfo?.tag,
        });

        if (!cursorInfo) {
            console.log('LWC onDefinition: No cursor info found');
            console.log('=== LWC onDefinition END (no cursor info) ===');
            return [];
        }

        const tag: Tag | null = cursorInfo.tag ? this.componentIndexer.findTagByName(cursorInfo.tag) : null;
        console.log('LWC onDefinition: Tag lookup:', {
            tagName: cursorInfo.tag,
            tagFound: tag !== null,
        });

        let result: Location[] = [];
        switch (cursorInfo.type) {
            case 'tag':
                console.log('LWC onDefinition: Processing tag definition');
                result = tag ? getAllLocations(tag) : [];
                console.log('LWC onDefinition: Tag locations found:', result.length);
                break;

            case 'attributeKey':
                console.log('LWC onDefinition: Processing attribute key definition');
                const attr: AttributeInfo | null = tag ? getAttribute(tag, cursorInfo.name) : null;
                if (attr?.location) {
                    result = [attr.location];
                    console.log('LWC onDefinition: Attribute location found');
                } else {
                    console.log('LWC onDefinition: No attribute location found');
                }
                break;

            case 'dynamicContent':
            case 'dynamicAttributeValue':
                console.log('LWC onDefinition: Processing dynamic content/attribute value definition');
                const { uri } = params.textDocument;
                if (cursorInfo.range) {
                    result = [Location.create(uri, cursorInfo.range)];
                    console.log('LWC onDefinition: Range-based location created');
                } else {
                    const component: Tag | null = this.componentIndexer.findTagByURI(uri);
                    const location = component ? getClassMemberLocation(component, cursorInfo.name) : null;
                    if (location) {
                        result = [location];
                        console.log('LWC onDefinition: Class member location found');
                    } else {
                        console.log('LWC onDefinition: No class member location found');
                    }
                }
                break;

            default:
                console.log('LWC onDefinition: Unknown cursor type:', cursorInfo.type);
        }

        console.log('LWC onDefinition: Final result:', {
            locationsCount: result.length,
            locations: result.map((loc) => ({ uri: loc.uri, range: loc.range })),
        });
        console.log('=== LWC onDefinition END ===');
        return result;
    }

    public cursorInfo({ textDocument: { uri }, position }: TextDocumentPositionParams, document?: TextDocument): CursorInfo | null {
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
                            end: doc?.positionAt(scanner.getTokenEnd()),
                        },
                    });
                }
            }
            if (token === TokenType.AttributeValue && attributeName === 'for:item') {
                iterators.unshift({
                    name: scanner.getTokenText().replace(/"|'/g, ''),
                    range: {
                        start: doc?.positionAt(scanner.getTokenOffset()),
                        end: doc?.positionAt(scanner.getTokenEnd()),
                    },
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
                    const item = iterators.find((i) => i.name === match?.groups?.property) ?? null;
                    return {
                        type: 'dynamicAttributeValue',
                        name: match?.groups?.property ?? '',
                        range: item?.range,
                        tag,
                    };
                } else {
                    return { type: 'attributeValue', name: content, tag };
                }
            }
            case TokenType.Content: {
                const relativeOffset: number = offset - scanner.getTokenOffset();
                const match = findDynamicContent(content, relativeOffset);

                if (match) {
                    const item = iterators.find((i) => i.name === match) ?? null;

                    return {
                        type: 'dynamicContent',
                        name: match,
                        range: item?.range,
                        tag,
                    };
                } else {
                    return {
                        type: 'content',
                        tag,
                        name: content,
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
    private async onGetFileContent(params: { uri: string }): Promise<{ content: string; exists: boolean }> {
        const content = this.fileSystemProvider.getFileContent(params.uri);
        return {
            content: content ?? '',
            exists: content !== undefined,
        };
    }

    private async onGetDirectoryListing(params: { uri: string }): Promise<{ entries: any[]; exists: boolean }> {
        const entries = this.fileSystemProvider.getDirectoryListing(params.uri);
        return {
            entries: entries ?? [],
            exists: entries !== undefined,
        };
    }

    private async onGetFileStat(params: { uri: string }): Promise<{ stat: any }> {
        const stat = this.fileSystemProvider.getFileStat(params.uri);
        return { stat: stat ?? { exists: false } };
    }

    private async onCreateTypingFiles(params: { files: { uri: string; content: string }[] }): Promise<void> {
        // Handle typing file creation requests from client
        for (const file of params.files) {
            this.fileSystemProvider.updateFileContent(file.uri, file.content);
        }
    }

    private async onDeleteTypingFiles(_params: { files: string[] }): Promise<void> {
        // Handle typing file deletion requests from client
        // Note: Actual deletion will be handled by the client
        // This is just for server-side tracking
    }

    private async onUpdateComponentIndex(params: { components: { uri: string; content: string; mtime: number; type: string }[] }): Promise<void> {
        // Handle component index updates from client
        for (const component of params.components) {
            this.fileSystemProvider.updateFileContent(component.uri, component.content);
        }
    }

    // File system notification handlers
    private onFileContentChanged(params: { uri: string; content: string }): void {
        this.fileSystemProvider.updateFileContent(params.uri, params.content);
    }
}

console.log('LWC Server module: Module loaded successfully');
