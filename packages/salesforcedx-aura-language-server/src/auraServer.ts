/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
    toResolvedPath,
    interceptConsoleLogger,
    TagInfo,
    isAuraRootDirectoryCreated,
    isAuraWatchedDirectory,
    FileSystemDataProvider,
    FileStat,
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';

import { getLanguageService, LanguageService, CompletionList } from 'vscode-html-languageservice';
import {
    createConnection,
    Connection,
    TextDocuments,
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
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import URI from 'vscode-uri';
import AuraIndexer from './aura-indexer/indexer';
import { getAuraBindingTemplateDeclaration, getAuraBindingValue } from './auraUtils';
import { AuraWorkspaceContext } from './context/auraContext';
import { setIndexer, getAuraTagProvider } from './markup/auraTags';
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
    init,
} from './tern-server/ternServer';

console.log('AuraServer module: Starting import');

interface TagParams {
    taginfo: TagInfo;
}

const tagAdded: NotificationType<TagParams> = new NotificationType<TagParams>('salesforce/tagAdded');
const tagDeleted: NotificationType<string> = new NotificationType<string>('salesforce/tagDeleted');
const tagsCleared: NotificationType<void> = new NotificationType<void>('salesforce/tagsCleared');

export default class Server {
    public readonly connection: Connection = createConnection();
    public readonly documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
    private context: AuraWorkspaceContext;
    private workspaceRoots: string[];
    private htmlLS: LanguageService;
    private auraIndexer: AuraIndexer;
    public fileSystemProvider: FileSystemDataProvider;

    constructor() {
        interceptConsoleLogger(this.connection);
        this.fileSystemProvider = new FileSystemDataProvider();
        this.connection.onInitialize((params) => this.onInitialize(params));
        this.connection.onCompletion((params) => this.onCompletion(params));
        this.connection.onCompletionResolve((item) => this.onCompletionResolve(item));
        this.connection.onHover((params) => this.onHover(params));
        this.connection.onDefinition((params) => this.onDefinition(params));
        this.connection.onTypeDefinition((params) => this.onTypeDefinition(params));
        this.connection.onDidChangeWatchedFiles((params) => void this.onDidChangeWatchedFiles(params));
        this.connection.onRequest('salesforce/listComponents', () => this.onListComponents());
        this.connection.onRequest('salesforce/listNamespaces', () => this.onListNamespaces());
        this.documents.listen(this.connection);
    }

    public async onInitialize(params: InitializeParams): Promise<InitializeResult> {
        const { workspaceFolders } = params;
        this.workspaceRoots = (workspaceFolders ?? []).map((folder) => path.resolve(URI.parse(folder.uri).fsPath));

        try {
            if (this.workspaceRoots.length === 0) {
                console.warn('No workspace found');
                return { capabilities: {} };
            }

            const startTime = globalThis.performance.now();

            // Use provided fileSystemProvider from initializationOptions if available
            this.populateFileSystemProvider(params);

            // Register event handlers that depend on fileSystemProvider after reconstruction
            this.connection.onReferences((reference) => onReferences(reference, this.fileSystemProvider));
            this.connection.onSignatureHelp((signatureParams) => onSignatureHelp(signatureParams, this.fileSystemProvider));

            // Register tern server document event handlers after fileSystemProvider reconstruction
            this.documents.onDidOpen(addFile);
            this.documents.onDidChangeContent(addFile);
            this.documents.onDidClose(delFile);
            this.documents.onDidClose((event) => this.onDidClose(event));

            this.context = new AuraWorkspaceContext(this.workspaceRoots, this.fileSystemProvider);

            // Initialize the workspace context to detect workspace type
            await this.context.initialize();

            try {
                if (this.context.type === 'CORE_PARTIAL') {
                    await startServer(path.join(this.workspaceRoots[0], '..'), path.join(this.workspaceRoots[0], '..'), this.fileSystemProvider);
                } else {
                    await startServer(this.workspaceRoots[0], this.workspaceRoots[0], this.fileSystemProvider);
                }
            } catch (error) {
                this.connection.console.error(`AuraServer onInitialize: Error in startServer: ${error}`);
                throw error;
            }

            // Initialize tern server now that startServer has been called and asyncTernRequest is available
            await init(this.fileSystemProvider);

            try {
                await this.context.configureProject();
            } catch (error) {
                this.connection.console.error(`AuraServer onInitialize: Error in configureProject: ${error}`);
                throw error;
            }

            this.auraIndexer = new AuraIndexer(this.context);
            setIndexer(this.auraIndexer);

            this.setupIndexerEvents();
            this.startIndexing();

            this.htmlLS = getLanguageService();
            this.htmlLS.setDataProviders(true, [getAuraTagProvider()]);

            console.info(`... language server started in ${globalThis.performance.now() - startTime}ms`);

            const capabilities = {
                textDocumentSync: {
                    openClose: true,
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    change: 1 as TextDocumentSyncKind,
                },
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: ['.', ':', '<', '"', '=', '/', '>'],
                },
                workspace: {
                    workspaceFolders: {
                        supported: true,
                    },
                },
                signatureHelpProvider: {
                    triggerCharacters: ['('],
                },
                referencesProvider: true,
                hoverProvider: true,
                definitionProvider: true,
                typeDefinitionProvider: true,
            };

            return {
                capabilities,
            };
        } catch (e: any) {
            throw new Error(`Aura Language Server initialization unsuccessful. Error message: ${e instanceof Error ? e.message : String(e)}`);
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
        console.log('=== onCompletion START ===');
        console.log('Completion request received:', {
            uri: completionParams.textDocument.uri,
            position: completionParams.position,
            context: completionParams.context,
        });

        const document = this.documents.get(completionParams.textDocument.uri);
        if (!document) {
            console.log('onCompletion: Document not found for URI:', completionParams.textDocument.uri);
            console.log('=== onCompletion END (no document) ===');
            return { isIncomplete: false, items: [] };
        }

        console.log('onCompletion: Document found:', {
            uri: document.uri,
            languageId: document.languageId,
            version: document.version,
            lineCount: document.lineCount,
        });

        try {
            const isAuraMarkup = await this.context.isAuraMarkup(document);
            console.log('onCompletion: isAuraMarkup:', isAuraMarkup);

            if (isAuraMarkup) {
                console.log('onCompletion: Processing as Aura markup');
                const htmlDocument = this.htmlLS.parseHTMLDocument(document);
                console.log('onCompletion: HTML document parsed successfully');

                const list = this.htmlLS.doComplete(document, completionParams.position, htmlDocument, {
                    isSfdxProject: this.context.type === 'SFDX',
                    useAttributeValueQuotes: true,
                });
                console.log('onCompletion: HTML completion result:', {
                    isIncomplete: list.isIncomplete,
                    itemsCount: list.items.length,
                });
                console.log('=== onCompletion END (markup) ===');
                return list;
            }

            const isAuraJavascript = await this.context.isAuraJavascript(document);
            console.log('onCompletion: isAuraJavascript:', isAuraJavascript);

            if (isAuraJavascript) {
                console.log('onCompletion: Processing as Aura JavaScript');
                const result = await onCompletion(completionParams, this.fileSystemProvider);
                console.log('onCompletion: JavaScript completion result:', {
                    isIncomplete: result.isIncomplete,
                    itemsCount: result.items.length,
                });
                console.log('=== onCompletion END (javascript) ===');
                return result;
            }

            console.log('onCompletion: Document is neither Aura markup nor JavaScript');
            console.log('=== onCompletion END (no match) ===');
            return { isIncomplete: false, items: [] };
        } catch (error) {
            console.error('onCompletion: Error occurred:', error);
            console.log('=== onCompletion END (error) ===');
            return { isIncomplete: false, items: [] };
        }
    }

    public onCompletionResolve(item: CompletionItem): CompletionItem {
        console.log('=== onCompletionResolve START ===');
        console.log('Completion resolve request received:', {
            label: item.label,
            kind: item.kind,
            detail: item.detail,
            documentation: item.documentation,
        });
        console.log('=== onCompletionResolve END ===');
        return item;
    }

    public async onHover(textDocumentPosition: TextDocumentPositionParams): Promise<Hover | null> {
        // Test both console.log (intercepted) and connection.console.log (direct)
        console.log('=== onHover START (console.log) ===');
        this.connection.console.log('=== onHover START (connection.console.log) ===');

        if (!textDocumentPosition) {
            return null;
        }

        if (!textDocumentPosition.textDocument) {
            return null;
        }

        if (!textDocumentPosition.position) {
            return null;
        }

        const document = this.documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            return null;
        }

        try {
            const isAuraMarkup = await this.context.isAuraMarkup(document);

            if (isAuraMarkup) {
                const htmlDocument = this.htmlLS.parseHTMLDocument(document);

                const hover = this.htmlLS.doHover(document, textDocumentPosition.position, htmlDocument);
                return hover;
            }

            const isAuraJavascript = await this.context.isAuraJavascript(document);

            if (isAuraJavascript) {
                const result = await onHover(textDocumentPosition, this.fileSystemProvider);
                return result;
            }

            return null;
        } catch (error) {
            console.error('onHover: Error occurred:', error);
            return null;
        }
    }

    public async onTypeDefinition(textDocumentPosition: TextDocumentPositionParams): Promise<Definition | null> {
        console.log('=== onTypeDefinition START ===');
        console.log('Type definition request received:', {
            uri: textDocumentPosition.textDocument.uri,
            position: textDocumentPosition.position,
        });

        const document = this.documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            console.log('onTypeDefinition: Document not found for URI:', textDocumentPosition.textDocument.uri);
            console.log('=== onTypeDefinition END (no document) ===');
            return null;
        }

        console.log('onTypeDefinition: Document found:', {
            uri: document.uri,
            languageId: document.languageId,
            version: document.version,
            lineCount: document.lineCount,
        });

        try {
            const isAuraJavascript = await this.context.isAuraJavascript(document);
            console.log('onTypeDefinition: isAuraJavascript:', isAuraJavascript);

            if (isAuraJavascript) {
                console.log('onTypeDefinition: Processing as Aura JavaScript');
                const result = await onTypeDefinition(textDocumentPosition, this.fileSystemProvider);
                console.log('onTypeDefinition: Type definition result:', {
                    hasResult: result !== null,
                    uri: result && 'uri' in result ? result.uri : 'no result',
                    range: result && 'range' in result ? result.range : 'no range',
                });
                console.log('=== onTypeDefinition END (javascript) ===');
                return result ?? null;
            }

            console.log('onTypeDefinition: Document is not Aura JavaScript');
            console.log('=== onTypeDefinition END (no match) ===');
            return null;
        } catch (error) {
            console.error('onTypeDefinition: Error occurred:', error);
            console.log('=== onTypeDefinition END (error) ===');
            return null;
        }
    }

    private findJavascriptProperty(valueProperty: string, textDocumentPosition: TextDocumentPositionParams): Location | null {
        console.log('=== findJavascriptProperty START ===');
        console.log('Searching for JavaScript property:', valueProperty);

        // couldn't find it within the markup file, try looking for it as a javascript property
        const fsPath = URI.parse(textDocumentPosition.textDocument.uri).fsPath;
        const parsedPath = path.parse(fsPath);
        const componentName = parsedPath.name;
        const namespace = path.basename(path.dirname(parsedPath.dir));
        const tag = this.auraIndexer.getAuraByTag(`${namespace}:${componentName}`);

        console.log('findJavascriptProperty: Parsed path info:', {
            fsPath,
            componentName,
            namespace,
            tagFound: tag !== null,
        });

        if (tag) {
            console.log('findJavascriptProperty: Aura tag found, looking for controller');
            // aura tag doesn't contain controller methods yet
            // but, if its not a v.value, its probably fine to just open the controller file
            const controllerPath = path.join(parsedPath.dir, `${componentName}Controller.js`);
            console.log('findJavascriptProperty: Controller path:', controllerPath);

            const result = {
                uri: URI.file(controllerPath).toString(),
                range: {
                    start: {
                        character: 0,
                        line: 1,
                    },
                    end: {
                        character: 0,
                        line: 1,
                    },
                },
            };
            console.log('findJavascriptProperty: Returning controller location:', result);
            console.log('=== findJavascriptProperty END (found controller) ===');
            return result;
        }

        console.log('findJavascriptProperty: No Aura tag found');
        console.log('=== findJavascriptProperty END (no tag) ===');
        return null;
    }

    public async onDefinition(textDocumentPosition: TextDocumentPositionParams): Promise<Location | null> {
        console.log('=== onDefinition START ===');
        console.log('Definition request received:', {
            uri: textDocumentPosition.textDocument.uri,
            position: textDocumentPosition.position,
        });

        const document = this.documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            console.log('onDefinition: Document not found for URI:', textDocumentPosition.textDocument.uri);
            console.log('=== onDefinition END (no document) ===');
            return null;
        }

        console.log('onDefinition: Document found:', {
            uri: document.uri,
            languageId: document.languageId,
            version: document.version,
            lineCount: document.lineCount,
        });

        try {
            const isAuraMarkup = await this.context.isAuraMarkup(document);
            console.log('onDefinition: isAuraMarkup:', isAuraMarkup);

            if (isAuraMarkup) {
                console.log('onDefinition: Processing as Aura markup');
                const htmlDocument = this.htmlLS.parseHTMLDocument(document);
                console.log('onDefinition: HTML document parsed successfully');

                const def = getAuraBindingTemplateDeclaration(document, textDocumentPosition.position, htmlDocument);
                console.log('onDefinition: Aura binding template declaration result:', {
                    hasResult: def !== null,
                    uri: def?.uri ?? 'no result',
                    range: def?.range ?? 'no range',
                });

                if (def) {
                    console.log('=== onDefinition END (template declaration) ===');
                    return def;
                }

                const valueProperty = getAuraBindingValue(document, textDocumentPosition.position, htmlDocument);
                console.log('onDefinition: Aura binding value result:', {
                    hasValue: valueProperty !== null,
                    value: valueProperty,
                });

                if (valueProperty) {
                    console.log('onDefinition: Looking for JavaScript property:', valueProperty);
                    const result = this.findJavascriptProperty(valueProperty, textDocumentPosition);
                    console.log('onDefinition: JavaScript property search result:', {
                        hasResult: result !== null,
                        uri: result?.uri ?? 'no result',
                        range: result?.range ?? 'no range',
                    });
                    console.log('=== onDefinition END (javascript property) ===');
                    return result;
                }

                console.log('onDefinition: No binding template or value found');
                console.log('=== onDefinition END (no binding) ===');
                return null;
            }

            const isAuraJavascript = await this.context.isAuraJavascript(document);
            console.log('onDefinition: isAuraJavascript:', isAuraJavascript);

            if (isAuraJavascript) {
                console.log('onDefinition: Processing as Aura JavaScript');
                const result = await onDefinition(textDocumentPosition, this.fileSystemProvider);
                console.log('onDefinition: JavaScript definition result:', {
                    hasResult: result !== null,
                    uri: result && 'uri' in result ? result.uri : 'no result',
                    range: result && 'range' in result ? result.range : 'no range',
                });
                console.log('=== onDefinition END (javascript) ===');
                return result ?? null;
            }

            console.log('onDefinition: Document is neither Aura markup nor JavaScript');
            console.log('=== onDefinition END (no match) ===');
            return null;
        } catch (error) {
            console.error('onDefinition: Error occurred:', error);
            console.log('=== onDefinition END (error) ===');
            return null;
        }
    }

    public async onDidChangeWatchedFiles(change: DidChangeWatchedFilesParams): Promise<void> {
        console.info('aura onDidChangeWatchedFiles...');
        const changes = change.changes;

        try {
            if (isAuraRootDirectoryCreated(this.context, changes)) {
                this.context.getIndexingProvider('aura')?.resetIndex();
                await this.context.getIndexingProvider('aura')?.configureAndIndex();
                // re-index everything on directory deletions as no events are reported for contents of deleted directories
                const startTime = globalThis.performance.now();
                console.info(`reindexed workspace in ${globalThis.performance.now() - startTime}ms, directory was deleted:`, changes);
            } else {
                for (const event of changes) {
                    const isWatchedDir = await isAuraWatchedDirectory(this.context, event.uri);
                    if (event.type === FileChangeType.Deleted && isWatchedDir) {
                        const dir = toResolvedPath(event.uri);
                        this.auraIndexer.clearTagsforDirectory(dir, this.context.type === 'SFDX');
                    } else {
                        const file = toResolvedPath(event.uri);
                        if (file.endsWith('.app') || file.endsWith('.cmp') || file.endsWith('.intf') || file.endsWith('.evt') || file.endsWith('.lib')) {
                            await this.auraIndexer.indexFile(file, this.context.type === 'SFDX');
                        }
                    }
                }
            }
        } catch (e) {
            void this.connection.sendNotification(ShowMessageNotification.type, {
                type: MessageType.Error,
                message: `Error re-indexing workspace: ${e instanceof Error ? e.message : String(e)}`,
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

    public listen(): void {
        this.connection.listen();
    }
}

console.log('AuraServer module: Module loaded successfully');
