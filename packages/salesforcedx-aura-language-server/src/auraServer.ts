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
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import URI from 'vscode-uri';
import AuraIndexer from './aura-indexer/indexer';
import { getAuraBindingTemplateDeclaration, getAuraBindingValue } from './auraUtils';
import { AuraWorkspaceContext } from './context/auraContext';
import { setIndexer, getAuraTagProvider } from './markup/auraTags';
import { startServer, addFile, delFile, onCompletion, onHover, onDefinition, onTypeDefinition, onReferences, onSignatureHelp } from './tern-server/ternServer';

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

    constructor() {
        interceptConsoleLogger(this.connection);

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
        this.documents.onDidClose((event) => this.onDidClose(event));
        this.documents.onDidOpen(addFile);
        this.documents.onDidChangeContent(addFile);
        this.documents.onDidClose(delFile);

        this.connection.onReferences(onReferences);
        this.connection.onSignatureHelp(onSignatureHelp);
    }

    public async onInitialize(params: InitializeParams): Promise<InitializeResult> {
        const { workspaceFolders } = params;
        this.workspaceRoots = (workspaceFolders ?? []).map((folder) => path.resolve(URI.parse(folder.uri).fsPath));

        try {
            if (this.workspaceRoots.length === 0) {
                console.warn('No workspace found');
                return { capabilities: {} };
            }

            for (const root of this.workspaceRoots) {
                console.info(`Starting *AURA* language server at ${root}`);
            }
            const startTime = globalThis.performance.now();

            this.context = new AuraWorkspaceContext(this.workspaceRoots);

            if (this.context.type === 'CORE_PARTIAL') {
                await startServer(path.join(this.workspaceRoots[0], '..'), path.join(this.workspaceRoots[0], '..'));
            } else {
                await startServer(this.workspaceRoots[0], this.workspaceRoots[0]);
            }

            await this.context.configureProject();

            this.auraIndexer = new AuraIndexer(this.context);
            setIndexer(this.auraIndexer);

            this.setupIndexerEvents();
            this.startIndexing();

            this.htmlLS = getLanguageService();
            this.htmlLS.setDataProviders(true, [getAuraTagProvider()]);

            console.info(`... language server started in ${globalThis.performance.now() - startTime}ms`);

            return {
                capabilities: {
                    textDocumentSync: {
                        openClose: true,
                        change: 1, // TextDocumentSyncKind.Full
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
                },
            };
        } catch (e: any) {
            throw new Error(`Aura Language Server initialization unsuccessful. Error message: ${e instanceof Error ? e.message : String(e)}`);
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
        const document = this.documents.get(completionParams.textDocument.uri);
        if (!document) {
            return { isIncomplete: false, items: [] };
        }

        if (await this.context.isAuraMarkup(document)) {
            const htmlDocument = this.htmlLS.parseHTMLDocument(document);

            const list = this.htmlLS.doComplete(document, completionParams.position, htmlDocument, {
                isSfdxProject: this.context.type === 'SFDX',
                useAttributeValueQuotes: true,
            });
            return list;
        }

        if (await this.context.isAuraJavascript(document)) {
            return onCompletion(completionParams);
        }

        return { isIncomplete: false, items: [] };
    }

    public onCompletionResolve(item: CompletionItem): CompletionItem {
        return item;
    }

    public async onHover(textDocumentPosition: TextDocumentPositionParams): Promise<Hover | null> {
        const document = this.documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            return null;
        }

        if (await this.context.isAuraMarkup(document)) {
            const htmlDocument = this.htmlLS.parseHTMLDocument(document);
            const hover = this.htmlLS.doHover(document, textDocumentPosition.position, htmlDocument);
            return hover;
        }

        if (await this.context.isAuraJavascript(document)) {
            return onHover(textDocumentPosition);
        }

        return null;
    }

    public async onTypeDefinition(textDocumentPosition: TextDocumentPositionParams): Promise<Definition | null> {
        const document = this.documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            return null;
        }

        if (await this.context.isAuraJavascript(document)) {
            return (await onTypeDefinition(textDocumentPosition)) ?? null;
        }

        return null;
    }

    private findJavascriptProperty(valueProperty: string, textDocumentPosition: TextDocumentPositionParams): Location | null {
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
            return {
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
        }

        return null;
    }

    public async onDefinition(textDocumentPosition: TextDocumentPositionParams): Promise<Location | null> {
        const document = this.documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            return null;
        }

        if (await this.context.isAuraMarkup(document)) {
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
        }

        if (await this.context.isAuraJavascript(document)) {
            return (await onDefinition(textDocumentPosition)) ?? null;
        }

        return null;
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
