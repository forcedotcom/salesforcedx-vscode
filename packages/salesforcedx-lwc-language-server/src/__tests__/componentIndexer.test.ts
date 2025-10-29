/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SFDX_WORKSPACE_ROOT, sfdxFileSystemProvider } from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import { Entry } from 'fast-glob';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import ComponentIndexer, { unIndexedFiles } from '../componentIndexer';
import { Tag, createTag, getTagName } from '../tag';

// Mock objects for testing
const createMockStats = (mtime: Date) => ({ mtime });
const createMockDirent = () => ({});

const workspaceRoot: string = SFDX_WORKSPACE_ROOT;

const componentIndexer: ComponentIndexer = new ComponentIndexer({
    workspaceRoot,
    fileSystemProvider: sfdxFileSystemProvider,
});

beforeEach(async () => {
    await componentIndexer.init();
});

afterEach(() => {
    componentIndexer.tags.clear();
});

describe('ComponentIndexer', () => {
    describe('new', () => {
        it('initializes with the root of a workspace', () => {
            const expectedPath: string = SFDX_WORKSPACE_ROOT;
            expect(componentIndexer.workspaceRoot).toEqual(expectedPath);
            expect(componentIndexer.workspaceType).toEqual('SFDX');
        });
    });

    describe('instance methods', () => {
        describe('#init', () => {
            it('adds a Tag to `tags` for each custom component', () => {
                expect(componentIndexer.tags.size).toEqual(5);
                expect(componentIndexer.tags.get('c-hello_world'));
            });
        });

        describe('#customComponents', () => {
            it('returns a list of files where the .js filename is the same as its parent directory name', async () => {
                const expectedComponents: string[] = [
                    'force-app/main/default/lwc/hello_world/hello_world.js',
                    'force-app/main/default/lwc/import_relative/import_relative.js',
                    'force-app/main/default/lwc/index/index.js',
                    'force-app/main/default/lwc/lightning_datatable_example/lightning_datatable_example.js',
                    'force-app/main/default/lwc/lightning_tree_example/lightning_tree_example.js',
                    'force-app/main/default/lwc/todo_item/todo_item.js',
                    'force-app/main/default/lwc/todo/todo.js',
                    'force-app/main/default/lwc/utils/utils.js',
                    'utils/meta/lwc/todo_util/todo_util.js',
                    'utils/meta/lwc/todo_utils/todo_utils.js',
                ].map((item) => path.join(componentIndexer.workspaceRoot, item));

                const componentEntries = await componentIndexer.getComponentEntries();
                const paths = componentEntries.map((entry) => path.resolve(entry.path)).sort();

                expect(paths).toEqual(expectedComponents.sort());
                expect(paths).not.toContain(path.join('force-app', 'main', 'default', 'lwc', 'import_relative', 'messages.js'));
                expect(paths).not.toContain(path.join('force-app', 'main', 'default', 'lwc', 'todo', 'store.js'));
            });
        });

        describe('findTagByName', () => {
            it('finds tag with an exact match', () => {
                expect(componentIndexer.findTagByName('hello_world')).not.toBeNull();
                expect(getTagName(componentIndexer.findTagByName('hello_world')!)).toEqual('hello_world');
                expect(componentIndexer.findTagByName('foo')).toBeNull();
            });

            it('finds tag with lwc prefix', () => {
                expect(getTagName(componentIndexer.findTagByName('c-hello_world')!)).toEqual('hello_world');
                expect(componentIndexer.findTagByName('c-hello-world')).toBeNull();
                expect(componentIndexer.findTagByName('c-helloWorld')).toBeNull();
                expect(componentIndexer.findTagByName('c-todo-foo')).toBeNull();
            });

            it('finds tag with aura prefix', () => {
                expect(componentIndexer.findTagByName('c:hello_world')).toBeNull();
                expect(componentIndexer.findTagByName('c:hello-world')).toBeNull();
                expect(getTagName(componentIndexer.findTagByName('c:helloWorld')!)).toEqual('hello_world');
                expect(getTagName(componentIndexer.findTagByName('c:todo')!)).toEqual('todo');
                expect(getTagName(componentIndexer.findTagByName('c:todoItem')!)).toEqual('todo_item');
                expect(componentIndexer.findTagByName('c:todo-foo')).toBeNull();
            });

            it('should return null when query provided cannot be mapped', () => {
                expect(componentIndexer.findTagByName('response.data.length')).toBeNull();
            });
        });

        describe('#findTagByURI', () => {
            it('finds a Tag by matching the URI', () => {
                const query = URI.file(path.resolve('../../test-workspaces/sfdx-workspace/force-app/main/default/lwc/hello_world/hello_world.js')).toString();
                expect(componentIndexer.findTagByURI(query)).not.toBeNull();
                expect(componentIndexer.findTagByURI(path.join('lwc', 'hello_world', 'hello_world.js'))).toBeNull();
                expect(componentIndexer.findTagByURI('hello_world.js')).toBeNull();
                expect(componentIndexer.findTagByURI(path.join('foo', 'bar', 'baz'))).toBeNull();
            });

            it('finds a Tag by its matching html file', () => {
                const query = URI.file(path.resolve('../../test-workspaces/sfdx-workspace/force-app/main/default/lwc/hello_world/hello_world.html')).toString();
                expect(componentIndexer.findTagByURI(query)).not.toBeNull();
                expect(componentIndexer.findTagByURI('lwc/hello_world/hello_world.html')).toBeNull();
                expect(componentIndexer.findTagByURI('hello_world.html')).toBeNull();
                expect(componentIndexer.findTagByURI(path.join('foo', 'bar', 'baz'))).toBeNull();
            });
        });

        describe('#unIndexedFiles', () => {
            it('returns a list of files not yet indexed', async () => {
                componentIndexer.tags.clear();
                const unIndexed = await componentIndexer.getUnIndexedFiles();
                expect(unIndexed.length).toBe(10);
            });
        });

        describe('#staleTags', () => {
            it('returns a list of tags that are stale and should be removed', async () => {
                const stale = await componentIndexer.getStaleTags();
                expect(stale.length).toBe(0);
            });
        });

        describe('#generateIndex()', () => {
            it('creates Tag objects for all the component JS files', () => {
                expect(componentIndexer.tags.size).toBe(5);
            });
        });

        describe('typescript path mapping', () => {
            const data = [
                ['c/hello_world', 'force-app/main/default/lwc/hello_world/hello_world'],
                ['c/import_relative', 'force-app/main/default/lwc/import_relative/import_relative'],
                ['c/index', 'force-app/main/default/lwc/index/index'],
                ['c/lightning_datatable_example', 'force-app/main/default/lwc/lightning_datatable_example/lightning_datatable_example'],
                ['c/lightning_tree_example', 'force-app/main/default/lwc/lightning_tree_example/lightning_tree_example'],
                ['c/todo_item', 'force-app/main/default/lwc/todo_item/todo_item'],
                ['c/todo', 'force-app/main/default/lwc/todo/todo'],
                ['c/typescript', 'force-app/main/default/lwc/typescript/typescript'],
                ['c/utils', 'force-app/main/default/lwc/utils/utils'],
                ['c/todo_util', 'utils/meta/lwc/todo_util/todo_util'],
                ['c/todo_utils', 'utils/meta/lwc/todo_utils/todo_utils'],
            ].map(([componentName, filePath]) => {
                const resolvedFilePath = [path.join(componentIndexer.workspaceRoot, filePath)];
                return [componentName, resolvedFilePath];
            });
            const expectedComponents = Object.fromEntries(data);

            describe('#tsConfigPathMapping', () => {
                it('returns a map of files inside an lwc watched directory where the .js or .ts files match the directory name', async () => {
                    const tsConfigPathMapping = await componentIndexer.getTsConfigPathMapping();
                    expect(tsConfigPathMapping).toEqual(expectedComponents);
                });
            });

            describe('updateSfdxTsConfigPath', () => {
                it('updates tsconfig.sfdx.json path mapping', async () => {
                    const tsconfigTemplate = {
                        compilerOptions: {
                            target: 'ESNext',
                            paths: {
                                // Provide an explicit type for the property to avoid implicit 'any[]' type error
                                'c/*': [] as const,
                            },
                        },
                    };
                    const sfdxPath = path.join(SFDX_WORKSPACE_ROOT, '.sfdx', 'tsconfig.sfdx.json');

                    // Create directory if it doesn't exist
                    const sfdxDir = path.dirname(sfdxPath);
                    sfdxFileSystemProvider.updateFileStat(sfdxDir, {
                        type: 'directory',
                        exists: true,
                        ctime: 0,
                        mtime: 0,
                        size: 0,
                    });

                    // Write the template tsconfig file
                    const tsconfigContent = JSON.stringify(tsconfigTemplate, null, 4);
                    sfdxFileSystemProvider.updateFileStat(sfdxPath, {
                        type: 'file',
                        exists: true,
                        ctime: Date.now(),
                        mtime: Date.now(),
                        size: tsconfigContent.length,
                    });
                    sfdxFileSystemProvider.updateFileContent(sfdxPath, tsconfigContent);

                    await componentIndexer.updateSfdxTsConfigPath();

                    // Read and parse the updated tsconfig
                    const updatedTsconfigContent = sfdxFileSystemProvider.getFileContent(sfdxPath);
                    expect(updatedTsconfigContent).not.toBeUndefined();
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const tsconfig = JSON.parse(updatedTsconfigContent!);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const tsconfigPathMapping = tsconfig.compilerOptions.paths;
                    expect(tsconfigPathMapping).toEqual(expectedComponents);

                    // Clean-up test files
                    sfdxFileSystemProvider.updateFileStat(sfdxPath, {
                        type: 'file',
                        exists: false,
                        ctime: 0,
                        mtime: 0,
                        size: 0,
                    });
                });
            });
        });
    });

    describe('helper functions', () => {
        describe('unIndexedFiles', () => {
            it('it returns entries 0 entries when they match', async () => {
                const stats = createMockStats(new Date('2020-01-01'));
                const dirent = createMockDirent();
                const tags: Tag[] = [await createTag({ file: '/foo', updatedAt: new Date('2020-01-01') })];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const entries: Entry[] = [{ path: '/foo', stats: stats as any, dirent: dirent as any, name: 'foo' }];

                expect(unIndexedFiles(entries, tags).length).toEqual(0);
            });

            it('it returns entries 1 entries when the entries date is different', async () => {
                const stats = createMockStats(new Date('2020-02-01'));
                const dirent = createMockDirent();
                const tags: Tag[] = [await createTag({ file: '/foo', updatedAt: new Date('2020-01-01') })];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const entries: Entry[] = [{ path: '/foo', stats: stats as any, dirent: dirent as any, name: 'foo' }];

                expect(unIndexedFiles(entries, tags).length).toEqual(1);
            });

            it('it returns entries 1 entries when there is no matching tag', async () => {
                const stats = createMockStats(new Date('2020-02-01'));
                const dirent = createMockDirent();
                const tags: Tag[] = [];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const entries: Entry[] = [{ path: '/foo', stats: stats as any, dirent: dirent as any, name: 'foo' }];

                expect(unIndexedFiles(entries, tags).length).toEqual(1);
            });
        });
    });
});
