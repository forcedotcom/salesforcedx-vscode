/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { sync } from 'fast-glob';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLanguageService } from 'vscode-html-languageservice';
import {
    TextDocument,
    InitializeParams,
    TextDocumentPositionParams,
    Location,
    MarkupContent,
    Hover,
    CompletionParams,
    CompletionTriggerKind,
    DidChangeWatchedFilesParams,
    FileChangeType,
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import Server, { findDynamicContent } from '../lwc-server';

const SFDX_WORKSPACE_ROOT = path.join(__dirname, '..', '..', '..', '..', 'test-workspaces', 'sfdx-workspace');
const filename = path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'lwc', 'todo', 'todo.html');
const uri = URI.file(filename).toString();
const document: TextDocument = TextDocument.create(uri, 'html', 0, fs.readFileSync(filename).toString());

const jsFilename = path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'lwc', 'todo', 'todo.js');
const jsUri = URI.file(jsFilename).toString();
const jsDocument: TextDocument = TextDocument.create(uri, 'javascript', 0, fs.readFileSync(jsFilename).toString());

const auraFilename = path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'aura', 'todoApp', 'todoApp.app');
const auraUri = URI.file(auraFilename).toString();
const auraDocument: TextDocument = TextDocument.create(auraFilename, 'html', 0, fs.readFileSync(auraFilename).toString());

const hoverFilename = path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'lwc', 'lightning_tree_example', 'lightning_tree_example.html');
const hoverUri = URI.file(hoverFilename).toString();
const hoverDocument: TextDocument = TextDocument.create(hoverFilename, 'html', 0, fs.readFileSync(hoverFilename).toString());

const server: Server = new Server();

let mockTypeScriptSupportConfig = false;

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
                return docs.get(name);
            },
            onDidSave: (): boolean => true,
            syncKind: 'html',
        })),
    };
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

    // Helper function to initialize server and get completion labels
    const getCompletionLabels = async (params: CompletionParams): Promise<string[]> => {
        await server.onInitialize(initializeParams);
        const completions = await server.onCompletion(params);
        return completions.items.map((item) => item.label);
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

            const labels = await getCompletionLabels(params);
            expect(labels).toBeArrayOfSize(8);
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

            const labels = await getCompletionLabels(params);
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

            const labels = await getCompletionLabels(params);
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

            const labels = await getCompletionLabels(params);
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

            const labels = await getCompletionLabels(params);
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
            const hover: Hover = await server.onHover(params);
            const contents = hover.contents as MarkupContent;

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
            const hover: Hover = await server.onHover(params);
            const contents = hover.contents as MarkupContent;
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
            const hover: Hover = await server.onHover(params);
            const contents = hover.contents as MarkupContent;
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
            // Use posix-style path separators for glob patterns to ensure cross-platform compatibility
            const pattern = path.posix.join(SFDX_WORKSPACE_ROOT.replace(/\\/g, '/'), '**', 'lwc', 'tsconfig.json');
            return sync(pattern);
        };

        beforeEach(async () => {
            // Clean up before each test run
            fs.rmSync(baseTsconfigPath, { recursive: true, force: true });
            const tsconfigPaths = getTsConfigPaths();
            tsconfigPaths.forEach((tsconfigPath) => fs.rmSync(tsconfigPath, { recursive: true, force: true }));
            mockTypeScriptSupportConfig = false;
        });

        afterEach(async () => {
            // Clean up after each test run
            fs.rmSync(baseTsconfigPath, { recursive: true, force: true });
            const tsconfigPaths = getTsConfigPaths();
            tsconfigPaths.forEach((tsconfigPath) => fs.rmSync(tsconfigPath, { recursive: true, force: true }));
            mockTypeScriptSupportConfig = false;
        });

        it('skip tsconfig initialization when salesforcedx-vscode-lwc.preview.typeScriptSupport = false', async () => {
            await server.onInitialize(initializeParams);
            await server.onInitialized();

            expect(fs.existsSync(baseTsconfigPath)).toBe(false);
            const tsconfigPaths = getTsConfigPaths();
            expect(tsconfigPaths.length).toBe(0);
        });

        it('initializes tsconfig when salesforcedx-vscode-lwc.preview.typeScriptSupport = true', async () => {
            // Create a new server instance to avoid state issues
            const testServer = new Server();

            // Enable feature flag
            mockTypeScriptSupportConfig = true;
            await testServer.onInitialize(initializeParams);
            await testServer.onInitialized();

            expect(fs.existsSync(baseTsconfigPath)).toBe(true);
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

            const sfdxTsConfig = JSON.parse(fs.readFileSync(baseTsconfigPath, 'utf8'));
            const pathMapping = Object.keys(sfdxTsConfig.compilerOptions.paths);
            expect(pathMapping.length).toEqual(11);
        });
    });

    describe('onDidChangeWatchedFiles', () => {
        const baseTsconfigPath = path.join(SFDX_WORKSPACE_ROOT, '.sfdx', 'tsconfig.sfdx.json');
        const watchedFileDir = path.join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default', 'lwc', 'newlyAddedFile');

        const getPathMappingKeys = (): string[] => {
            const sfdxTsConfig = JSON.parse(fs.readFileSync(baseTsconfigPath, 'utf8'));
            return Object.keys(sfdxTsConfig.compilerOptions.paths);
        };

        beforeEach(() => {
            mockTypeScriptSupportConfig = true;
        });

        afterEach(() => {
            // Clean up after each test run
            fs.rmSync(baseTsconfigPath, { recursive: true, force: true });
            const tsconfigPaths = sync(path.join(SFDX_WORKSPACE_ROOT, '**', 'lwc', 'tsconfig.json'));
            tsconfigPaths.forEach((tsconfigPath) => fs.rmSync(tsconfigPath, { recursive: true, force: true }));
            fs.rmSync(watchedFileDir, { recursive: true, force: true });
            mockTypeScriptSupportConfig = false;
        });

        ['.js', '.ts'].forEach((ext) => {
            it(`updates tsconfig.sfdx.json path mapping when ${ext} file created`, async () => {
                // Enable feature flag
                mockTypeScriptSupportConfig = true;
                await server.onInitialize(initializeParams);
                await server.onInitialized();

                const initializedPathMapping = getPathMappingKeys();
                expect(initializedPathMapping.length).toEqual(11);

                // Create files after initialized
                const watchedFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                fs.mkdirSync(path.dirname(watchedFilePath), { recursive: true });
                fs.writeFileSync(watchedFilePath, '');

                const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                    changes: [
                        {
                            uri: watchedFilePath,
                            type: FileChangeType.Created,
                        },
                    ],
                };

                await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                const pathMapping = getPathMappingKeys();
                // Path mapping updated
                expect(pathMapping.length).toEqual(12);
            });

            it(`removes tsconfig.sfdx.json path mapping when ${ext} files deleted`, async () => {
                // Create files before initialized
                const watchedFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                fs.mkdirSync(path.dirname(watchedFilePath), { recursive: true });
                fs.writeFileSync(watchedFilePath, '');

                await server.onInitialize(initializeParams);
                await server.onInitialized();

                const initializedPathMapping = getPathMappingKeys();
                expect(initializedPathMapping.length).toEqual(12);

                fs.rmSync(watchedFilePath, { recursive: true, force: true });

                const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                    changes: [
                        {
                            uri: watchedFilePath,
                            type: FileChangeType.Deleted,
                        },
                    ],
                };

                await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                const updatedPathMapping = getPathMappingKeys();
                expect(updatedPathMapping.length).toEqual(11);
            });

            it(`no updates to tsconfig.sfdx.json path mapping when ${ext} files changed`, async () => {
                // Create files before initialized
                const watchedFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                fs.mkdirSync(path.dirname(watchedFilePath), { recursive: true });
                fs.writeFileSync(watchedFilePath, '');

                await server.onInitialize(initializeParams);
                await server.onInitialized();

                const initializedPathMapping = getPathMappingKeys();
                expect(initializedPathMapping.length).toEqual(12);

                fs.rmSync(watchedFilePath, { recursive: true, force: true });

                const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                    changes: [
                        {
                            uri: watchedFilePath,
                            type: FileChangeType.Changed,
                        },
                    ],
                };

                await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                const updatedPathMapping = getPathMappingKeys();
                expect(updatedPathMapping.length).toEqual(12);
            });

            it('doesn\'t update path mapping when parent directory is not lwc', async () => {
                await server.onInitialize(initializeParams);
                await server.onInitialized();

                const initializedPathMapping = getPathMappingKeys();
                expect(initializedPathMapping.length).toEqual(11);

                const watchedFilePath = path.resolve(watchedFileDir, '__tests__', 'newlyAddedFile', `newlyAddedFile${ext}`);
                fs.mkdirSync(path.dirname(watchedFilePath), { recursive: true });
                fs.writeFileSync(watchedFilePath, '');

                const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                    changes: [
                        {
                            uri: watchedFilePath,
                            type: FileChangeType.Created,
                        },
                    ],
                };

                await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                const updatedPathMapping = getPathMappingKeys();
                expect(updatedPathMapping.length).toEqual(11);
            });
        });

        ['.html', '.css', '.js-meta.xml', '.txt'].forEach((ext) => {
            [FileChangeType.Created, FileChangeType.Changed, FileChangeType.Deleted].forEach((type) => {
                it(`no path mapping updates made for ${ext} on ${type} event`, async () => {
                    const lwcComponentPath = path.resolve(watchedFileDir, 'newlyAddedFile.ts');
                    const nonJsOrTsFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                    fs.mkdirSync(path.dirname(lwcComponentPath), { recursive: true });
                    fs.writeFileSync(lwcComponentPath, '');
                    fs.mkdirSync(path.dirname(nonJsOrTsFilePath), { recursive: true });
                    fs.writeFileSync(nonJsOrTsFilePath, '');

                    await server.onInitialize(initializeParams);
                    await server.onInitialized();

                    const initializedPathMapping = getPathMappingKeys();
                    expect(initializedPathMapping.length).toEqual(12);

                    fs.rmSync(nonJsOrTsFilePath, { recursive: true, force: true });

                    const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                        changes: [
                            {
                                uri: nonJsOrTsFilePath,
                                type: type as FileChangeType,
                            },
                        ],
                    };

                    await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                    const updatedPathMapping = getPathMappingKeys();
                    expect(updatedPathMapping.length).toEqual(12);
                });
            });
        });
    });
});

describe('#capabilities', () => {
    it('returns what the server can do', () => {
        expect(server.capabilities).toEqual({
            capabilities: {
                textDocumentSync: 'html',
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

    it('knows when Im in a start tag', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 16, character: 23 } }, document);
        expect(cursorInfo).toEqual({ type: 'tag', name: 'c-todo_item', tag: 'c-todo_item' });
    });

    it('knows when Im on an attribute name', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 17, character: 26 } }, document);
        expect(cursorInfo).toEqual({ type: 'attributeKey', name: 'key', tag: 'c-todo_item' });
    });

    it('knows when Im on a dynamic attribute value (inside "{}")', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 18, character: 33 } }, document);
        expect(cursorInfo.type).toEqual('dynamicAttributeValue');
        expect(cursorInfo.name).toEqual('todo');
        expect(cursorInfo.tag).toEqual('c-todo_item');
        expect(cursorInfo.range).toEqual({
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

    it('knows when Im on an attribute value', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 7, character: 35 } }, document);
        expect(cursorInfo).toEqual({ type: 'attributeValue', name: '"off"', tag: 'input' });
    });

    it('knows when Im in content', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 37, character: 24 } }, document);
        expect(cursorInfo.type).toEqual('content');
        expect(cursorInfo.tag).toEqual('button');
    });

    it('knows when Im in dynamic content', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 27, character: 68 } }, document);
        expect(cursorInfo.type).toEqual('dynamicContent');
        expect(cursorInfo.tag).toEqual('strong');
    });

    it('knows when Im not dynamic content', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 27, character: 76 } }, document);
        expect(cursorInfo.type).toEqual('content');
        expect(cursorInfo.tag).toEqual('strong');
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
    const initializeParams: InitializeParams = {
        processId: 0,
        rootUri: '',
        capabilities: {},
        workspaceFolders: [
            {
                uri: URI.file(path.resolve('../../test-workspaces/core-like-workspace/app/main/core')).toString(),
                name: path.resolve('../../test-workspaces/sfdx-workspace/'),
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
                uri: URI.file(path.resolve('../../test-workspaces/core-like-workspace/app/main/core/ui-global-components')).toString(),
                name: path.resolve('../../test-workspaces/sfdx-workspace/'),
            },
        ],
    };

    it('Should not throw during intialization', async () => {
        await server.onInitialize(initializeParams);
    });
});
