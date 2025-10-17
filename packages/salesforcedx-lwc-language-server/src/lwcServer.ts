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

    constructor() {
        this.connection.onInitialize(this.onInitialize.bind(this));
        this.connection.onInitialized(this.onInitialized.bind(this));
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
        this.connection.onHover(this.onHover.bind(this));
        this.connection.onShutdown(this.onShutdown.bind(this));
        this.connection.onDefinition(this.onDefinition.bind(this));
        this.connection.onInitialized(this.onInitialized.bind(this));
        this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));

        this.documents.listen(this.connection);
        this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
        this.documents.onDidSave(this.onDidSave.bind(this));
    }

    public async onInitialize(params: InitializeParams): Promise<InitializeResult> {
        this.workspaceFolders = params.workspaceFolders ?? [];
        this.workspaceRoots = this.workspaceFolders.map((folder) => URI.parse(folder.uri).fsPath);
        this.context = new LWCWorkspaceContext(this.workspaceRoots);
        this.componentIndexer = new ComponentIndexer({ workspaceRoot: this.workspaceRoots[0] });
        this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
        this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
        this.typingIndexer = await TypingIndexer.create({ workspaceRoot: this.workspaceRoots[0] });
        this.languageService = getLanguageService({
            customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
            useDefaultDataProvider: false,
        });

        await this.context.initialize();
        await this.context.configureProject();
        await this.componentIndexer.init();
        await this.lwcDataProvider.init();

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
        const hasTsEnabled = await this.isTsSupportEnabled();
        if (hasTsEnabled) {
            try {
                await this.context.configureProjectForTs();
            } catch (error) {
                console.error('onInitialized: Error in configureProjectForTs:', error);
                throw error;
            }
            await this.componentIndexer.updateSfdxTsConfigPath();
        }
    }

    public async isTsSupportEnabled(): Promise<any> {
        return this.connection.workspace.getConfiguration(TYPESCRIPT_SUPPORT_SETTING);
    }

    public async onCompletion(params: CompletionParams): Promise<CompletionList | undefined> {
        const {
            position,
            textDocument: { uri },
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
                    items: customTags,
                };
            }
        } else if (await this.context.isLWCJavascript(doc)) {
            if (this.shouldCompleteJavascript(params)) {
                const customTags = this.componentIndexer.getCustomData().map((tag) => ({
                    label: getLwcTypingsName(tag),
                    kind: CompletionItemKind.Folder,
                }));

                return {
                    isIncomplete: false,
                    items: customTags,
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
        return item;
    }

    public async onHover(params: TextDocumentPositionParams): Promise<Hover | null> {
        const {
            position,
            textDocument: { uri },
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
        const cursorInfo: CursorInfo | null = this.cursorInfo(params);

        if (!cursorInfo) {
            return [];
        }

        const tag: Tag | null = cursorInfo.tag ? this.componentIndexer.findTagByName(cursorInfo.tag) : null;

        switch (cursorInfo.type) {
            case 'tag':
                return tag ? getAllLocations(tag) : [];

            case 'attributeKey':
                const attr: AttributeInfo | null = tag ? getAttribute(tag, cursorInfo.name) : null;
                if (attr?.location) {
                    return [attr.location];
                }
                return [];

            case 'dynamicContent':
            case 'dynamicAttributeValue':
                const { uri } = params.textDocument;
                if (cursorInfo.range) {
                    return [Location.create(uri, cursorInfo.range)];
                } else {
                    const component: Tag | null = this.componentIndexer.findTagByURI(uri);
                    const location = component ? getClassMemberLocation(component, cursorInfo.name) : null;
                    if (location) {
                        return [location];
                    }
                }
        }
        return [];
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
}
