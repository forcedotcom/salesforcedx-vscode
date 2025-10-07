import * as path from 'path';

import {
    createConnection,
    IConnection,
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
    WorkspaceFolder,
} from 'vscode-languageserver';

import { getLanguageService, LanguageService, CompletionList } from 'vscode-html-languageservice';

import URI from 'vscode-uri';
import {
    toResolvedPath,
    interceptConsoleLogger,
    TagInfo,
    elapsedMillis,
    isAuraRootDirectoryCreated,
    isAuraWatchedDirectory,
} from '@salesforce/salesforcedx-lightning-lsp-common';
import { AuraWorkspaceContext } from './context/aura-context';
import { startServer, addFile, delFile, onCompletion, onHover, onDefinition, onTypeDefinition, onReferences, onSignatureHelp } from './tern-server/tern-server';
import AuraIndexer from './aura-indexer/indexer';
import { setIndexer, getAuraTagProvider } from './markup/auraTags';
import { getAuraBindingTemplateDeclaration, getAuraBindingValue } from './aura-utils';

interface TagParams {
    taginfo: TagInfo;
}

const tagAdded: NotificationType<TagParams, void> = new NotificationType<TagParams, void>('salesforce/tagAdded');
const tagDeleted: NotificationType<string, void> = new NotificationType<string, void>('salesforce/tagDeleted');
const tagsCleared: NotificationType<void, void> = new NotificationType<void, void>('salesforce/tagsCleared');

export default class Server {
    readonly connection: IConnection = createConnection();
    readonly documents: TextDocuments = new TextDocuments();
    context: AuraWorkspaceContext;
    workspaceFolders: WorkspaceFolder[];
    workspaceRoots: string[];
    htmlLS: LanguageService;
    auraIndexer: AuraIndexer;

    constructor() {
        interceptConsoleLogger(this.connection);

        this.connection.onInitialize(this.onInitialize.bind(this));
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
        this.connection.onHover(this.onHover.bind(this));
        this.connection.onDefinition(this.onDefinition.bind(this));
        this.connection.onTypeDefinition(this.onTypeDefinition.bind(this));
        this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));
        this.connection.onRequest('salesforce/listComponents', this.onListComponents.bind(this));
        this.connection.onRequest('salesforce/listNamespaces', this.onListNamespaces.bind(this));

        this.documents.listen(this.connection);
        this.documents.onDidClose(this.onDidClose.bind(this));
        this.documents.onDidOpen(addFile);
        this.documents.onDidChangeContent(addFile);
        this.documents.onDidClose(delFile);

        this.connection.onReferences(onReferences);
        this.connection.onSignatureHelp(onSignatureHelp);
    }

    async onInitialize(params: InitializeParams): Promise<InitializeResult> {
        const { workspaceFolders } = params;
        this.workspaceFolders = workspaceFolders;
        this.workspaceRoots = workspaceFolders.map((folder) => path.resolve(URI.parse(folder.uri).fsPath));

        try {
            if (this.workspaceRoots.length === 0) {
                console.warn('No workspace found');
                return { capabilities: {} };
            }

            for (const root of this.workspaceRoots) {
                console.info(`Starting *AURA* language server at ${root}`);
            }
            const startTime = process.hrtime();

            this.context = new AuraWorkspaceContext(this.workspaceRoots);

            if (this.context.type === 'CORE_PARTIAL') {
                await startServer(path.join(this.workspaceRoots[0], '..'), path.join(this.workspaceRoots[0], '..'));
            } else {
                await startServer(this.workspaceRoots[0], this.workspaceRoots[0]);
            }

            this.context.configureProject();

            this.auraIndexer = new AuraIndexer(this.context);
            setIndexer(this.auraIndexer);

            this.setupIndexerEvents();
            this.startIndexing();

            this.htmlLS = getLanguageService();
            this.htmlLS.setDataProviders(true, [getAuraTagProvider()]);

            console.info('... language server started in ' + elapsedMillis(startTime));

            return {
                capabilities: {
                    textDocumentSync: this.documents.syncKind,
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
        } catch (e) {
            throw new Error(`Aura Language Server initialization unsuccessful. Error message: ${e.message}`);
        }
    }

    private setupIndexerEvents(): void {
        this.auraIndexer.eventEmitter.on('set', (tag: TagInfo) => {
            this.connection.sendNotification(tagAdded, { taginfo: tag });
        });

        this.auraIndexer.eventEmitter.on('delete', (tag: string) => {
            this.connection.sendNotification(tagDeleted, tag);
        });

        this.auraIndexer.eventEmitter.on('clear', () => {
            this.connection.sendNotification(tagsCleared, undefined);
        });
    }

    private startIndexing(): void {
        setTimeout(async () => {
            this.connection.sendNotification('salesforce/indexingStarted');
            await this.auraIndexer.configureAndIndex();
            this.connection.sendNotification('salesforce/indexingEnded');
        }, 0);
    }

    async onCompletion(completionParams: CompletionParams): Promise<CompletionList> {
        const document = this.documents.get(completionParams.textDocument.uri);

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

    onCompletionResolve(item: CompletionItem): CompletionItem {
        return item;
    }

    async onHover(textDocumentPosition: TextDocumentPositionParams): Promise<Hover> {
        const document = this.documents.get(textDocumentPosition.textDocument.uri);

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

    async onTypeDefinition(textDocumentPosition: TextDocumentPositionParams): Promise<Definition> {
        const document = this.documents.get(textDocumentPosition.textDocument.uri);

        if (await this.context.isAuraJavascript(document)) {
            return onTypeDefinition(textDocumentPosition);
        }

        return null;
    }

    private findJavascriptProperty(valueProperty: string, textDocumentPosition: TextDocumentPositionParams): Location | null {
        // couldn't find it within the markup file, try looking for it as a javascript property
        const fsPath = URI.parse(textDocumentPosition.textDocument.uri).fsPath;
        const parsedPath = path.parse(fsPath);
        const componentName = parsedPath.name;
        const namespace = path.basename(path.dirname(parsedPath.dir));
        const tag = this.auraIndexer.getAuraByTag(namespace + ':' + componentName);

        if (tag) {
            // aura tag doesn't contain controller methods yet
            // but, if its not a v.value, its probably fine to just open the controller file
            const controllerPath = path.join(parsedPath.dir, componentName + 'Controller.js');
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

    async onDefinition(textDocumentPosition: TextDocumentPositionParams): Promise<Location> {
        const document = this.documents.get(textDocumentPosition.textDocument.uri);

        if (await this.context.isAuraMarkup(document)) {
            const htmlDocument = this.htmlLS.parseHTMLDocument(document);

            const def = getAuraBindingTemplateDeclaration(document, textDocumentPosition.position, htmlDocument);
            if (def) {
                return def;
            }

            const valueProperty = getAuraBindingValue(document, textDocumentPosition.position, htmlDocument);
            if (valueProperty) {
                return this.findJavascriptProperty(valueProperty, textDocumentPosition);
            }
        }

        if (await this.context.isAuraJavascript(document)) {
            return onDefinition(textDocumentPosition);
        }

        return null;
    }

    async onDidChangeWatchedFiles(change: DidChangeWatchedFilesParams): Promise<void> {
        console.info('aura onDidChangeWatchedFiles...');
        const changes = change.changes;

        try {
            if (isAuraRootDirectoryCreated(this.context, changes)) {
                this.context.getIndexingProvider('aura').resetIndex();
                this.context.getIndexingProvider('aura').configureAndIndex();
                // re-index everything on directory deletions as no events are reported for contents of deleted directories
                const startTime = process.hrtime();
                console.info('reindexed workspace in ' + elapsedMillis(startTime) + ', directory was deleted:', changes);
                return;
            } else {
                for (const event of changes) {
                    if (event.type === FileChangeType.Deleted && isAuraWatchedDirectory(this.context, event.uri)) {
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
            this.connection.sendNotification(ShowMessageNotification.type, {
                type: MessageType.Error,
                message: `Error re-indexing workspace: ${e.message}`,
            });
        }
    }

    onListComponents(): string {
        const tags = this.auraIndexer.getAuraTags();
        const result = JSON.stringify([...tags]);
        return result;
    }

    onListNamespaces(): string {
        const tags = this.auraIndexer.getAuraNamespaces();
        const result = JSON.stringify(tags);
        return result;
    }

    onDidClose(event: any): void {
        this.connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
    }

    listen(): void {
        this.connection.listen();
    }
}
