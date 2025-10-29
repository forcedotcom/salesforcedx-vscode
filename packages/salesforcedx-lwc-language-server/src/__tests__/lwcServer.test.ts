/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */

import { SFDX_WORKSPACE_ROOT, sfdxFileSystemProvider } from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import { sync } from 'fast-glob';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getLanguageService } from 'vscode-html-languageservice';
import {
    InitializeParams,
    TextDocumentPositionParams,
    Location,
    MarkupContent,
    Hover,
    CompletionParams,
    CompletionTriggerKind,
    DidChangeWatchedFilesParams,
    FileChangeType,
    TextDocumentSyncKind,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import Server, { findDynamicContent } from '../lwcServer';

// File paths and URIs
const filename = path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'lwc', 'todo', 'todo.html');
const uri = URI.file(filename).toString();

const jsFilename = path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'lwc', 'todo', 'todo.js');
const jsUri = URI.file(jsFilename).toString();

const auraFilename = path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'aura', 'todoApp', 'todoApp.app');
const auraUri = URI.file(auraFilename).toString();

const hoverFilename = path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'lwc', 'lightning_tree_example', 'lightning_tree_example.html');
const hoverUri = URI.file(hoverFilename).toString();

const createDocument = (filePath: string, languageId: string): TextDocument => {
    const docUri = URI.file(filePath).toString();
    const content = server.fileSystemProvider.getFileContent(filePath) ?? '';
    return TextDocument.create(docUri, languageId, 0, content);
};

// Async document creation functions
const getDocument = (): TextDocument => createDocument(filename, 'html');

// Pre-loaded documents for mocks
let document: TextDocument;
let jsDocument: TextDocument;
let auraDocument: TextDocument;
let hoverDocument: TextDocument;

// Setup function to load all documents once
const setupDocuments = async (): Promise<void> => {
    document = createDocument(filename, 'html');
    jsDocument = createDocument(jsFilename, 'javascript');
    auraDocument = createDocument(auraFilename, 'html');
    hoverDocument = createDocument(hoverFilename, 'html');
};

const server: Server = new Server();
// Use the pre-populated file system provider from testUtils
server.fileSystemProvider = sfdxFileSystemProvider as any;

let mockTypeScriptSupportConfig = false;

// Helper function to create a fresh server instance with TypeScript support enabled
const createServerWithTsSupport = async (initializeParams: InitializeParams): Promise<Server> => {
    mockTypeScriptSupportConfig = true;
    const testServer = new Server();
    await testServer.onInitialize(initializeParams);
    await testServer.onInitialized();
    return testServer;
};

jest.mock('vscode-languageserver', () => {
    const actual = jest.requireActual('vscode-languageserver');
    return {
        ...actual,
        createConnection: jest.fn().mockImplementation(() => ({
            onInitialize: (): boolean => true,
            onInitialized: (): boolean => true,
            onCompletion: (): boolean => true,
            onCompletionResolve: (): boolean => true,
            onDidChangeWatchedFiles: (): boolean => true,
            onHover: (): boolean => true,
            onShutdown: (): boolean => true,
            onDefinition: (): boolean => true,
            onRequest: jest.fn(),
            onNotification: jest.fn(),
            workspace: {
                getConfiguration: (): boolean => mockTypeScriptSupportConfig,
            },
        })),
        TextDocuments: jest.fn().mockImplementation(() => ({
            listen: (): boolean => true,
            onDidChangeContent: (): boolean => true,
            get: (name: string): TextDocument => {
                const docs = new Map([
                    [uri, document],
                    [jsUri, jsDocument],
                    [auraUri, auraDocument],
                    [hoverUri, hoverDocument],
                ]);
                return docs.get(name)!;
            },
            onDidSave: (): boolean => true,
            syncKind: 'html',
        })),
    };
});

describe('lwcServer', () => {
    // Initialize documents before running tests
    beforeAll(async () => {
        await setupDocuments();
    });

    describe('new', () => {
        it('creates a new instance', () => {
            expect(server.connection);
            expect(server.documents);
        });
    });

    describe('handlers', () => {
        const initializeParams: InitializeParams = {
            processId: 0,
            rootUri: '',
            capabilities: {},
            workspaceFolders: [
                {
                    uri: URI.file(SFDX_WORKSPACE_ROOT).toString(),
                    name: SFDX_WORKSPACE_ROOT,
                },
            ],
        };

        describe('#onCompletion', () => {
            it('should return a list of available completion items in a javascript file', async () => {
                const params: CompletionParams = {
                    textDocument: { uri: jsUri },
                    position: {
                        line: 0,
                        character: 0,
                    },
                    context: {
                        triggerCharacter: '.',
                        triggerKind: CompletionTriggerKind.TriggerCharacter,
                    },
                };

                await server.onInitialize(initializeParams);

                const completions = await server.onCompletion(params);
                const labels = completions?.items.map((item) => item.label) ?? [];
                expect(labels).toBeArrayOfSize(5);
                expect(labels).toInclude('c/todo_util');
                expect(labels).toInclude('c/todo_item');
            });

            it('should not return a list of completion items in a javascript file for open curly brace', async () => {
                const params: CompletionParams = {
                    textDocument: { uri: jsUri },
                    position: {
                        line: 0,
                        character: 0,
                    },
                    context: {
                        triggerCharacter: '{',
                        triggerKind: CompletionTriggerKind.TriggerCharacter,
                    },
                };

                await server.onInitialize(initializeParams);
                const completions = await server.onCompletion(params);
                expect(completions).toBeUndefined();
            });

            it('returns a list of available tag completion items in a LWC template', async () => {
                const params: CompletionParams = {
                    textDocument: { uri },
                    position: {
                        line: 16,
                        character: 30,
                    },
                };

                await server.onInitialize(initializeParams);
                const completions = await server.onCompletion(params);
                const labels = completions?.items.map((item) => item.label) ?? [];
                expect(labels).toInclude('c-todo_item');
                expect(labels).toInclude('c-todo');
                expect(labels).toInclude('lightning-icon');
                expect(labels).not.toInclude('div');
                expect(labels).not.toInclude('lightning:icon'); // this is handled by the aura Lang. server
            });

            it('should return a list of available attribute completion items in a LWC template', async () => {
                const params: CompletionParams = {
                    textDocument: { uri },
                    position: {
                        line: 0,
                        character: 0,
                    },
                    context: {
                        triggerCharacter: '{',
                        triggerKind: CompletionTriggerKind.TriggerCharacter,
                    },
                };

                await server.onInitialize(initializeParams);
                const completions = await server.onCompletion(params);
                const labels = completions?.items.map((item) => item.label) ?? [];
                expect(labels).toBeArrayOfSize(21);
                expect(labels).toInclude('handleToggleAll');
                expect(labels).toInclude('handleClearCompleted');
            });

            it('should still return a list of completion items inside the curly brace without the trigger character in a LWC template', async () => {
                const params: CompletionParams = {
                    textDocument: { uri },
                    position: {
                        line: 44,
                        character: 22,
                    },
                };

                await server.onInitialize(initializeParams);
                const completions = await server.onCompletion(params);
                const labels = completions?.items.map((item) => item.label) ?? [];
                expect(labels).toInclude('handleToggleAll');
                expect(labels).toInclude('handleClearCompleted');
                expect(labels).toInclude('has5Todos_today');
                expect(labels).toInclude('$has5Todos_today');
            });

            it('returns a list of available completion items in a Aura template', async () => {
                const params: CompletionParams = {
                    textDocument: { uri: auraUri },
                    position: {
                        line: 2,
                        character: 9,
                    },
                };

                await server.onInitialize(initializeParams);
                const completions = await server.onCompletion(params);
                const labels = completions?.items.map((item) => item.label) ?? [];
                expect(labels).toInclude('c:todoItem');
                expect(labels).toInclude('c:todo');
                expect(labels).not.toInclude('div');
            });
        });

        describe('onHover', () => {
            it('returns the docs for that hovered item', async () => {
                const params: TextDocumentPositionParams = {
                    textDocument: { uri },
                    position: {
                        line: 16,
                        character: 29,
                    },
                };

                await server.onInitialize(initializeParams);
                await server.componentIndexer.init();
                const hover: Hover | null = await server.onHover(params);
                expect(hover).not.toBeNull();
                const contents = hover!.contents as MarkupContent;

                expect(contents.value).toContain('**todo**');
            });

            it('returns the docs for that hovered custom component in an aura template', async () => {
                const params: TextDocumentPositionParams = {
                    textDocument: { uri: auraUri },
                    position: {
                        line: 3,
                        character: 9,
                    },
                };

                await server.onInitialize(initializeParams);
                await server.componentIndexer.init();
                const hover: Hover | null = await server.onHover(params);
                expect(hover).not.toBeNull();
                const contents = hover!.contents as MarkupContent;
                expect(contents.value).toContain('**info**');
                expect(contents.value).toContain('**icon-name**');
            });

            it('should return the component library link for a standard component', async () => {
                const params: TextDocumentPositionParams = {
                    textDocument: { uri: hoverUri },
                    position: {
                        line: 1,
                        character: 11,
                    },
                };

                await server.onInitialize(initializeParams);
                await server.componentIndexer.init();
                const hover: Hover | null = await server.onHover(params);
                expect(hover).not.toBeNull();
                const contents = hover!.contents as MarkupContent;
                expect(contents.value).toContain('https://developer.salesforce.com/docs/component-library/bundle/lightning-tree');
            });
        });

        describe('#onDefinition', () => {
            it('returns the Location of the html tags corresponding .js file', async () => {
                const params: TextDocumentPositionParams = {
                    textDocument: { uri },
                    position: {
                        line: 16,
                        character: 30,
                    },
                };

                await server.onInitialize(initializeParams);
                await server.componentIndexer.init();
                const locations: Location[] = server.onDefinition(params);
                const uris = locations.map((item) => item.uri);
                expect(locations.length).toEqual(2);
                expect(uris[0]).toContain('todo_item/todo_item.js');
                expect(uris[1]).toContain('todo_item/todo_item.html');
            });

            it('returns the Location of the property in the elements content', async () => {
                const params: TextDocumentPositionParams = {
                    textDocument: { uri },
                    position: {
                        line: 19,
                        character: 40,
                    },
                };

                await server.onInitialize(initializeParams);
                await server.componentIndexer.init();
                const [location] = server.onDefinition(params);
                expect(location.uri).toContain('todo/todo.js');
                expect(location.range.start.line).toEqual(105);
                expect(location.range.start.character).toEqual(4);
            });

            it('returns the Location of an (`@api`) classMember from the html attribute', async () => {
                const params: TextDocumentPositionParams = {
                    textDocument: { uri },
                    position: {
                        line: 18,
                        character: 27,
                    },
                };

                await server.onInitialize(initializeParams);
                await server.componentIndexer.init();
                const [location]: Location[] = server.onDefinition(params);
                expect(location.range.start.line).toEqual(14);
                expect(location.range.start.character).toEqual(4);
            });

            it('returns the Location of a parent iterator node with an iterator attribute', async () => {
                const params: TextDocumentPositionParams = {
                    textDocument: { uri },
                    position: {
                        line: 18,
                        character: 32,
                    },
                };

                await server.onInitialize(initializeParams);
                await server.componentIndexer.init();
                const [location]: Location[] = server.onDefinition(params);
                expect(location.uri).toContain('todo/todo.html');
                expect(location.range.start.line).toEqual(15);
                expect(location.range.start.character).toEqual(60);
            });
        });

        describe('onInitialized()', () => {
            const baseTsconfigPath = path.join(SFDX_WORKSPACE_ROOT, '.sfdx', 'tsconfig.sfdx.json');
            const getTsConfigPaths = (): string[] => {
                // Check the mock file system for tsconfig.json files in LWC directories
                const lwcDirs = [
                    path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'lwc'),
                    path.join(SFDX_WORKSPACE_ROOT, 'utils', 'meta', 'lwc'),
                    path.join(SFDX_WORKSPACE_ROOT, 'registered-empty-folder', 'meta', 'lwc'),
                ];

                const tsconfigPaths: string[] = [];
                for (const lwcDir of lwcDirs) {
                    const tsconfigPath = path.join(lwcDir, 'tsconfig.json');
                    if (server.fileSystemProvider.fileExists(tsconfigPath)) {
                        tsconfigPaths.push(tsconfigPath);
                    }
                }
                return tsconfigPaths;
            };

            beforeEach(async () => {
                // Clean up before each test run
                try {
                    server.fileSystemProvider.updateFileStat(baseTsconfigPath, {
                        type: 'file',
                        exists: false,
                        ctime: 0,
                        mtime: 0,
                        size: 0,
                    });
                } catch {
                    /* ignore if doesn't exist */
                }
                const tsconfigPaths = getTsConfigPaths();
                for (const tsconfigPath of tsconfigPaths) {
                    try {
                        server.fileSystemProvider.updateFileStat(tsconfigPath, {
                            type: 'file',
                            exists: false,
                            ctime: 0,
                            mtime: 0,
                            size: 0,
                        });
                    } catch {
                        /* ignore if doesn't exist */
                    }
                }
                mockTypeScriptSupportConfig = false;
            });

            afterEach(async () => {
                // Clean up after each test run
                try {
                    await vscode.workspace.fs.delete(vscode.Uri.file(baseTsconfigPath));
                } catch {
                    /* ignore if doesn't exist */
                }
                const tsconfigPaths = getTsConfigPaths();
                for (const tsconfigPath of tsconfigPaths) {
                    try {
                        await vscode.workspace.fs.delete(vscode.Uri.file(tsconfigPath));
                    } catch {
                        /* ignore if doesn't exist */
                    }
                }
                mockTypeScriptSupportConfig = false;
            });

            it('skip tsconfig initialization when salesforcedx-vscode-lwc.preview.typeScriptSupport = false', async () => {
                await server.onInitialize(initializeParams);
                await server.onInitialized();

                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(baseTsconfigPath));
                    expect(true).toBe(false); // Should not reach here
                } catch {
                    expect(true).toBe(true); // File doesn't exist, which is expected
                }
                const tsconfigPaths = getTsConfigPaths();
                expect(tsconfigPaths.length).toBe(0);
            });

            it('initializes tsconfig when salesforcedx-vscode-lwc.preview.typeScriptSupport = true', async () => {
                // Create a new server instance to avoid state issues
                const testServer = new Server();
                // Use the pre-populated file system provider from testUtils
                testServer.fileSystemProvider = sfdxFileSystemProvider as any;

                // Enable feature flag
                mockTypeScriptSupportConfig = true;
                await testServer.onInitialize(initializeParams);
                await testServer.onInitialized();

                expect(testServer.fileSystemProvider.fileExists(baseTsconfigPath)).toBe(true);
                const tsconfigPaths = getTsConfigPaths();

                // There are currently 3 LWC directories under SFDX_WORKSPACE_ROOT
                // (force-app/main/default/lwc, utils/meta/lwc, and registered-empty-folder/meta/lwc)
                expect(tsconfigPaths.length).toBe(3);
            });

            it('updates tsconfig.sfdx.json path mapping', async () => {
                // Enable feature flag
                mockTypeScriptSupportConfig = true;
                await server.onInitialize(initializeParams);
                await server.onInitialized();

                const sfdxTsConfigContent = server.fileSystemProvider.getFileContent(baseTsconfigPath);
                expect(sfdxTsConfigContent).not.toBeUndefined();
                const sfdxTsConfig = JSON.parse(sfdxTsConfigContent!);
                const pathMapping = Object.keys(sfdxTsConfig.compilerOptions.paths);
                expect(pathMapping.length).toEqual(11);
            });
        });

        describe('onDidChangeWatchedFiles', () => {
            const baseTsconfigPath = path.join(SFDX_WORKSPACE_ROOT, '.sfdx', 'tsconfig.sfdx.json');
            const watchedFileDir = path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'lwc', 'newlyAddedFile');

            const getPathMappingKeys = (): string[] => {
                try {
                    const sfdxTsConfigContent = server.fileSystemProvider.getFileContent(baseTsconfigPath);
                    if (!sfdxTsConfigContent) {
                        // If tsconfig doesn't exist, return empty array for tests
                        return [];
                    }
                    const sfdxTsConfig = JSON.parse(sfdxTsConfigContent);
                    return Object.keys(sfdxTsConfig.compilerOptions.paths ?? {});
                } catch (error) {
                    console.error(`Failed to read tsconfig: ${error.message}`);
                    return [];
                }
            };

            beforeEach(() => {
                mockTypeScriptSupportConfig = true;
            });

            afterEach(async () => {
                // Clean up after each test run
                try {
                    await vscode.workspace.fs.delete(vscode.Uri.file(baseTsconfigPath));
                } catch {
                    /* ignore if doesn't exist */
                }
                const tsconfigPaths = sync(path.join(SFDX_WORKSPACE_ROOT, '**', 'lwc', 'tsconfig.json'));
                for (const tsconfigPath of tsconfigPaths) {
                    try {
                        await vscode.workspace.fs.delete(vscode.Uri.file(tsconfigPath));
                    } catch {
                        /* ignore if doesn't exist */
                    }
                }
                try {
                    await vscode.workspace.fs.delete(vscode.Uri.file(watchedFileDir), { recursive: true });
                } catch {
                    /* ignore if doesn't exist */
                }
                mockTypeScriptSupportConfig = false;
            });

            ['.js', '.ts'].forEach((ext) => {
                it(`updates tsconfig.sfdx.json path mapping when ${ext} file created`, async () => {
                    // Create fresh server instance with TypeScript support
                    const testServer = await createServerWithTsSupport(initializeParams);

                    const initializedPathMapping = await getPathMappingKeys();
                    expect(initializedPathMapping.length).toEqual(11);

                    // Create files after initialized
                    const watchedFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(watchedFilePath)));
                    await vscode.workspace.fs.writeFile(vscode.Uri.file(watchedFilePath), new TextEncoder().encode(''));

                    const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                        changes: [
                            {
                                uri: watchedFilePath,
                                type: FileChangeType.Created,
                            },
                        ],
                    };

                    await testServer.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                    const pathMapping = await getPathMappingKeys();
                    // Path mapping updated
                    expect(pathMapping.length).toEqual(11);
                });

                it(`removes tsconfig.sfdx.json path mapping when ${ext} files deleted`, async () => {
                    // Create files before initialized
                    const watchedFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(watchedFilePath)));
                    await vscode.workspace.fs.writeFile(vscode.Uri.file(watchedFilePath), new TextEncoder().encode(''));

                    // Create fresh server instance with TypeScript support
                    const testServer = await createServerWithTsSupport(initializeParams);

                    const initializedPathMapping = await getPathMappingKeys();
                    expect(initializedPathMapping.length).toEqual(11);

                    await vscode.workspace.fs.delete(vscode.Uri.file(watchedFilePath));

                    const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                        changes: [
                            {
                                uri: watchedFilePath,
                                type: FileChangeType.Deleted,
                            },
                        ],
                    };

                    await testServer.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                    const updatedPathMapping = await getPathMappingKeys();
                    expect(updatedPathMapping.length).toEqual(11);
                });

                it(`no updates to tsconfig.sfdx.json path mapping when ${ext} files changed`, async () => {
                    // Create files before initialized
                    const watchedFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(watchedFilePath)));
                    await vscode.workspace.fs.writeFile(vscode.Uri.file(watchedFilePath), new TextEncoder().encode(''));

                    await server.onInitialize(initializeParams);
                    await server.onInitialized();

                    const initializedPathMapping = await getPathMappingKeys();
                    expect(initializedPathMapping.length).toEqual(12);

                    await server.fileSystemProvider.updateFileStat(watchedFilePath, {
                        type: 'file',
                        exists: true,
                        ctime: 0,
                        mtime: 0,
                        size: 0,
                    });
                    await server.fileSystemProvider.updateFileContent(watchedFilePath, '');

                    const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                        changes: [
                            {
                                uri: watchedFilePath,
                                type: FileChangeType.Changed,
                            },
                        ],
                    };

                    await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                    const updatedPathMapping = await getPathMappingKeys();
                    expect(updatedPathMapping.length).toEqual(12);
                });

                it("doesn't update path mapping when parent directory is not lwc", async () => {
                    await server.onInitialize(initializeParams);
                    await server.onInitialized();

                    const initializedPathMapping = await getPathMappingKeys();
                    expect(initializedPathMapping.length).toEqual(11);

                    const watchedFilePath = path.resolve(watchedFileDir, '__tests__', 'newlyAddedFile', `newlyAddedFile${ext}`);
                    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(watchedFilePath)));
                    await vscode.workspace.fs.writeFile(vscode.Uri.file(watchedFilePath), new TextEncoder().encode(''));

                    const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                        changes: [
                            {
                                uri: watchedFilePath,
                                type: FileChangeType.Created,
                            },
                        ],
                    };

                    await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                    const updatedPathMapping = await getPathMappingKeys();
                    expect(updatedPathMapping.length).toEqual(11);
                });
            });

            ['.html', '.css', '.js-meta.xml', '.txt'].forEach((ext) => {
                [FileChangeType.Created, FileChangeType.Changed, FileChangeType.Deleted].forEach((type) => {
                    it(`no path mapping updates made for ${ext} on ${type} event`, async () => {
                        const lwcComponentPath = path.resolve(watchedFileDir, 'newlyAddedFile.ts');
                        const nonJsOrTsFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                        server.fileSystemProvider.updateFileStat(path.dirname(lwcComponentPath), {
                            type: 'directory',
                            exists: true,
                            ctime: 0,
                            mtime: 0,
                            size: 0,
                        });
                        server.fileSystemProvider.updateFileContent(lwcComponentPath, '');
                        server.fileSystemProvider.updateFileStat(path.dirname(nonJsOrTsFilePath), {
                            type: 'directory',
                            exists: true,
                            ctime: 0,
                            mtime: 0,
                            size: 0,
                        });
                        server.fileSystemProvider.updateFileContent(nonJsOrTsFilePath, '');

                        await server.onInitialize(initializeParams);
                        await server.onInitialized();

                        const initializedPathMapping = await getPathMappingKeys();
                        expect(initializedPathMapping.length).toEqual(11);

                        server.fileSystemProvider.updateFileStat(nonJsOrTsFilePath, {
                            type: 'file',
                            exists: false,
                            ctime: 0,
                            mtime: 0,
                            size: 0,
                        });

                        const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                            changes: [
                                {
                                    uri: nonJsOrTsFilePath,
                                    type: type as FileChangeType,
                                },
                            ],
                        };

                        await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                        const updatedPathMapping = await getPathMappingKeys();
                        expect(updatedPathMapping.length).toEqual(11);
                    });
                });
            });
        });
    });

    describe('#capabilities', () => {
        it('returns what the server can do', () => {
            expect(server.capabilities).toEqual({
                capabilities: {
                    textDocumentSync: {
                        change: TextDocumentSyncKind.Full,
                        openClose: true,
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
            });
        });
    });

    describe('#cursorInfo', () => {
        server.languageService = getLanguageService();

        it('knows when Im in a start tag', async () => {
            const doc = await getDocument();
            const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 16, character: 23 } }, doc);
            expect(cursorInfo).not.toBeNull();
            expect(cursorInfo).toEqual({ type: 'tag', name: 'c-todo_item', tag: 'c-todo_item' });
        });

        it('knows when Im on an attribute name', async () => {
            const doc = await getDocument();
            const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 17, character: 26 } }, doc);
            expect(cursorInfo).toEqual({ type: 'attributeKey', name: 'key', tag: 'c-todo_item' });
        });

        it('knows when Im on a dynamic attribute value (inside "{}")', async () => {
            const doc = await getDocument();
            const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 18, character: 33 } }, doc);
            expect(cursorInfo).not.toBeNull();
            expect(cursorInfo!.type).toEqual('dynamicAttributeValue');
            expect(cursorInfo!.name).toEqual('todo');
            expect(cursorInfo!.tag).toEqual('c-todo_item');
            expect(cursorInfo!.range).toEqual({
                start: {
                    character: 60,
                    line: 15,
                },
                end: {
                    character: 66,
                    line: 15,
                },
            });
        });

        it('knows when Im on an attribute value', async () => {
            const doc = await getDocument();
            const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 7, character: 35 } }, doc);
            expect(cursorInfo).toEqual({ type: 'attributeValue', name: '"off"', tag: 'input' });
        });

        it('knows when Im in content', async () => {
            const doc = await getDocument();
            const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 37, character: 24 } }, doc);
            expect(cursorInfo).not.toBeNull();
            expect(cursorInfo!.type).toEqual('content');
            expect(cursorInfo!.tag).toEqual('button');
        });

        it('knows when Im in dynamic content', async () => {
            const doc = await getDocument();
            const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 27, character: 68 } }, doc);
            expect(cursorInfo).not.toBeNull();
            expect(cursorInfo!.type).toEqual('dynamicContent');
            expect(cursorInfo!.tag).toEqual('strong');
        });

        it('knows when Im not dynamic content', async () => {
            const doc = await getDocument();
            const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 27, character: 76 } }, doc);
            expect(cursorInfo).not.toBeNull();
            expect(cursorInfo!.type).toEqual('content');
            expect(cursorInfo!.tag).toEqual('strong');
        });
    });

    describe('findDynamicContent', () => {
        const text = '{foobar}, {foo.bar} so\nmething {baz.bux}';

        it('returns the dynamic match at the given offset if it exists', () => {
            expect(findDynamicContent(text, 5)).toEqual('foobar');
        });

        it('returns the match if its not the only one in the string', () => {
            expect(findDynamicContent(text, 12)).toEqual('foo');
        });

        it('returns null when not on dynamic content', () => {
            expect(findDynamicContent(text, 25)).toBeNull();
        });
    });

    describe('Core All Workspace', () => {
        const workspaceRoot = path.join(__dirname, '..', '..', '..', '..', 'test-workspaces', 'core-like-workspace', 'app', 'main', 'core');
        const name = path.join(__dirname, '..', '..', '..', '..', 'test-workspaces', 'sfdx-workspace');
        const initializeParams: InitializeParams = {
            processId: 0,
            rootUri: '',
            capabilities: {},
            workspaceFolders: [
                {
                    uri: URI.file(workspaceRoot).toString(),
                    name,
                },
            ],
        };

        it('Should not throw during intialization', async () => {
            await server.onInitialize(initializeParams);
        });
    });

    describe('Core Partial Workspace', () => {
        const initializeParams: InitializeParams = {
            processId: 0,
            rootUri: '',
            capabilities: {},
            workspaceFolders: [
                {
                    uri: URI.file(
                        path.join(__dirname, '..', '..', '..', '..', 'test-workspaces', 'core-like-workspace', 'app', 'main', 'core', 'ui-global-components'),
                    ).toString(),
                    name: path.join(__dirname, '..', '..', '..', '..', 'test-workspaces', 'sfdx-workspace'),
                },
            ],
        };

        it('Should not throw during intialization', async () => {
            await server.onInitialize(initializeParams);
        });
    });
});
