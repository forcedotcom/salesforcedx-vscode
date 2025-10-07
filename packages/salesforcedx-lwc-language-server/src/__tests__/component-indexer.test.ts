/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Entry } from 'fast-glob';
import { Stats, Dirent } from 'node:fs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import ComponentIndexer, { unIndexedFiles } from '../component-indexer';
import { Tag, createTag, getTagName } from '../tag';

const workspaceRoot: string = path.resolve('../../test-workspaces/sfdx-workspace');
const componentIndexer: ComponentIndexer = new ComponentIndexer({
    workspaceRoot,
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
            const expectedPath: string = path.resolve('../../test-workspaces/sfdx-workspace');
            expect(componentIndexer.workspaceRoot).toEqual(expectedPath);
            expect(componentIndexer.workspaceType).toEqual('SFDX');
        });
    });

    describe('instance methods', () => {
        describe('#init', () => {
            it('adds a Tag to `tags` for each custom component', async () => {
                expect(componentIndexer.tags.size).toEqual(8);
                expect(componentIndexer.tags.get('c-hello_world'));
            });
        });

        describe('#customComponents', () => {
            it('returns a list of files where the .js filename is the same as its parent directory name', () => {
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

                const paths = componentIndexer.componentEntries.map((entry) => path.resolve(entry.path)).sort();

                expect(paths).toEqual(expectedComponents.sort());
                expect(paths).not.toContain(path.join('force-app', 'main', 'default', 'lwc', 'import_relative', 'messages.js'));
                expect(paths).not.toContain(path.join('force-app', 'main', 'default', 'lwc', 'todo', 'store.js'));
            });
        });

        describe('findTagByName', () => {
            it('finds tag with an exact match', async () => {
                expect(getTagName(componentIndexer.findTagByName('hello_world'))).toEqual('hello_world');
                expect(componentIndexer.findTagByName('foo')).toBeNull();
            });

            it('finds tag with lwc prefix', async () => {
                expect(getTagName(componentIndexer.findTagByName('c-hello_world'))).toEqual('hello_world');
                expect(componentIndexer.findTagByName('c-hello-world')).toBeNull();
                expect(componentIndexer.findTagByName('c-helloWorld')).toBeNull();
                expect(componentIndexer.findTagByName('c-todo-foo')).toBeNull();
            });

            it('finds tag with aura prefix', async () => {
                expect(componentIndexer.findTagByName('c:hello_world')).toBeNull();
                expect(componentIndexer.findTagByName('c:hello-world')).toBeNull();
                expect(getTagName(componentIndexer.findTagByName('c:helloWorld'))).toEqual('hello_world');
                expect(getTagName(componentIndexer.findTagByName('c:todo'))).toEqual('todo');
                expect(getTagName(componentIndexer.findTagByName('c:todoItem'))).toEqual('todo_item');
                expect(componentIndexer.findTagByName('c:todo-foo')).toBeNull();
            });

            it('should return null when query provided cannot be mapped', () => {
                expect(componentIndexer.findTagByName('response.data.length')).toBeNull();
            });
        });

        describe('#findTagByURI', () => {
            it('finds a Tag by matching the URI', async () => {
                const query = URI.file(path.resolve('../../test-workspaces/sfdx-workspace/force-app/main/default/lwc/hello_world/hello_world.js')).toString();
                expect(componentIndexer.findTagByURI(query)).not.toBeNull();
                expect(componentIndexer.findTagByURI(path.join('lwc', 'hello_world', 'hello_world.js'))).toBeNull();
                expect(componentIndexer.findTagByURI('hello_world.js')).toBeNull();
                expect(componentIndexer.findTagByURI(path.join('foo', 'bar', 'baz'))).toBeNull();
            });

            it('finds a Tag by its matching html file', async () => {
                const query = URI.file(path.resolve('../../test-workspaces/sfdx-workspace/force-app/main/default/lwc/hello_world/hello_world.html')).toString();
                expect(componentIndexer.findTagByURI(query)).not.toBeNull();
                expect(componentIndexer.findTagByURI('lwc/hello_world/hello_world.html')).toBeNull();
                expect(componentIndexer.findTagByURI('hello_world.html')).toBeNull();
                expect(componentIndexer.findTagByURI(path.join('foo', 'bar', 'baz'))).toBeNull();
            });
        });

        describe('#unIndexedFiles', () => {
            it('returns a list of files not yet indexed', () => {
                componentIndexer.tags.clear();
                const unIndexed = componentIndexer.unIndexedFiles;
                expect(unIndexed.length).toBe(10);
            });
        });

        describe('#staleTags', () => {
            it('returns a list of tags that are stale and should be removed', () => {
                const stale = componentIndexer.staleTags;
                expect(stale.length).toBe(0);
            });
        });

        describe('#generateIndex()', () => {
            it('creates Tag objects for all the component JS files', async () => {
                expect(componentIndexer.tags.size).toBe(8);
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
                it('returns a map of files inside an lwc watched directory where the .js or .ts files match the directory name', () => {
                    const tsConfigPathMapping = componentIndexer.tsConfigPathMapping;
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
                                'c/*': [] as string[],
                            },
                        },
                    };
                    const sfdxPath = path.resolve('../../test-workspaces/sfdx-workspace/.sfdx/tsconfig.sfdx.json');
                    fs.writeFileSync(sfdxPath, JSON.stringify(tsconfigTemplate, null, 4));

                    componentIndexer.updateSfdxTsConfigPath();

                    const tsconfig = JSON.parse(fs.readFileSync(sfdxPath, 'utf8'));
                    const tsconfigPathMapping = tsconfig.compilerOptions.paths;
                    expect(tsconfigPathMapping).toEqual(expectedComponents);

                    // Clean-up test files
                    fs.rmSync(sfdxPath, { recursive: true, force: true });
                });
            });
        });
    });

    describe('helper functions', () => {
        describe('unIndexedFiles', () => {
            it('it returns entries 0 entries when they match', () => {
                const stats = new Stats();
                stats.mtime = new Date('2020-01-01');
                const dirent = new Dirent();
                const tags: Tag[] = [createTag({ file: '/foo', updatedAt: new Date('2020-01-01') })];
                const entries: Entry[] = [{ path: '/foo', stats, dirent, name: 'foo' }];

                expect(unIndexedFiles(entries, tags).length).toEqual(0);
            });

            it('it returns entries 1 entries when the entries date is different', () => {
                const stats = new Stats();
                stats.mtime = new Date('2020-02-01');
                const dirent = new Dirent();
                const tags: Tag[] = [createTag({ file: '/foo', updatedAt: new Date('2020-01-01') })];
                const entries: Entry[] = [{ path: '/foo', stats, dirent, name: 'foo' }];

                expect(unIndexedFiles(entries, tags).length).toEqual(1);
            });

            it('it returns entries 1 entries when there is no matching tag', () => {
                const stats = new Stats();
                stats.mtime = new Date('2020-02-01');
                const dirent = new Dirent();
                const tags: Tag[] = [];
                const entries: Entry[] = [{ path: '/foo', stats, dirent, name: 'foo' }];

                expect(unIndexedFiles(entries, tags).length).toEqual(1);
            });
        });
    });
});
