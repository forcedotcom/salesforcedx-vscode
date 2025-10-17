/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'node:os';
import { join, resolve } from 'node:path';
import * as vscode from 'vscode';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as utils from '../utils';
import { SfdxTsConfig } from '../utils';
import { WorkspaceContext } from './workspaceContext';

describe('utils', () => {
    it('includesWatchedDirectory', async () => {
        const directoryDeletedEvent: FileEvent = {
            type: FileChangeType.Deleted,
            uri: 'file:///Users/user/test/dir',
        };
        const jsFileDeletedEvent: FileEvent = {
            type: FileChangeType.Deleted,
            uri: 'file:///Users/user/test/dir/file.js',
        };
        const htmlFileDeletedEvent: FileEvent = {
            type: FileChangeType.Deleted,
            uri: 'file:///Users/user/test/dir/file.html',
        };
        const ctxt = new WorkspaceContext('');
        ctxt.type = 'SFDX';
        // Mock the isFileInsideModulesRoots method to return true for the test directory
        ctxt.isFileInsideModulesRoots = jest.fn().mockResolvedValue(true);
        expect(await utils.includesDeletedLwcWatchedDirectory(ctxt, [jsFileDeletedEvent, directoryDeletedEvent])).toBeTruthy();
        expect(await utils.includesDeletedLwcWatchedDirectory(ctxt, [jsFileDeletedEvent])).toBeFalsy();
        expect(await utils.includesDeletedLwcWatchedDirectory(ctxt, [htmlFileDeletedEvent])).toBeFalsy();
    });

    it('isLWCRootDirectoryChange', async () => {
        const noLwcFolderCreated: FileEvent = {
            type: FileChangeType.Created,
            uri: 'file:///Users/user/test/dir',
        };
        const noLwcFolderDeleted: FileEvent = {
            type: FileChangeType.Deleted,
            uri: 'file:///Users/user/test/dir',
        };
        const lwcFolderCreated: FileEvent = {
            type: FileChangeType.Created,
            uri: 'file:///Users/user/test/dir/lwc',
        };
        const lwcFolderDeleted: FileEvent = {
            type: FileChangeType.Deleted,
            uri: 'file:///Users/user/test/dir/lwc',
        };
        const ctxt = new WorkspaceContext('');
        ctxt.type = 'SFDX';
        expect(utils.isLWCRootDirectoryCreated(ctxt, [noLwcFolderCreated, noLwcFolderDeleted])).toBeFalsy();
        expect(utils.isLWCRootDirectoryCreated(ctxt, [noLwcFolderCreated])).toBeFalsy();
        expect(utils.isLWCRootDirectoryCreated(ctxt, [noLwcFolderCreated, lwcFolderCreated])).toBeTruthy();
        expect(utils.isLWCRootDirectoryCreated(ctxt, [lwcFolderCreated, lwcFolderDeleted])).toBeTruthy();
    });

    it('getExtension()', () => {
        const jsDocument = TextDocument.create('file:///hello_world.js', 'javascript', 0, '');
        expect(utils.getExtension(jsDocument)).toBe('.js');
    });

    it('should return file name', () => {
        const htmlDocument = TextDocument.create('file:///hello_world.html', 'html', 0, '');
        expect(utils.getBasename(htmlDocument)).toBe('hello_world');
    });

    it('test canonicalizing in nodejs', () => {
        const canonical = resolve(join('tmp', '.', 'a', 'b', '..'));
        expect(canonical.endsWith(join('tmp', 'a'))).toBe(true);
    });

    it('deepMerge()', () => {
        // simplest
        let to: any = { a: 1 };
        let from: any = { b: 2 };
        expect(utils.deepMerge(to, from)).toBeTruthy();
        expect(to).toEqual({ a: 1, b: 2 });
        expect(utils.deepMerge({ a: 1 }, { a: 1 })).toBeFalsy();

        // do not overwrite scalar
        to = { a: 1 };
        from = { a: 2 };
        expect(utils.deepMerge(to, from)).toBeFalsy();
        expect(to).toEqual({ a: 1 });

        // nested object gets copied
        to = { a: 1 };
        from = { o: { n: 1 } };
        expect(utils.deepMerge(to, from)).toBeTruthy();
        expect(to).toEqual({ a: 1, o: { n: 1 } });
        expect(utils.deepMerge({ o: { n: 1 } }, { o: { n: 1 } })).toBeFalsy();

        // nested object gets merged if in both
        to = { a: 1, o: { x: 2 } };
        from = { o: { n: 1 } };
        expect(utils.deepMerge(to, from)).toBeTruthy();
        expect(to).toEqual({ a: 1, o: { x: 2, n: 1 } });

        // array elements get merged
        to = { a: [1, 2] };
        from = { a: [3, 4] };
        expect(utils.deepMerge(to, from)).toBeTruthy();
        expect(to).toEqual({ a: [1, 2, 3, 4] });
        expect(utils.deepMerge({ a: [1, 2] }, { a: [1, 2] })).toBeFalsy();

        // if from has array but to has scalar then also results in array
        to = { a: 0 };
        from = { a: [3, 4] };
        expect(utils.deepMerge(to, from)).toBeTruthy();
        expect(to).toEqual({ a: [0, 3, 4] });

        // if to has array but from has scalar then also results in array
        to = { a: [1, 2] };
        from = { a: 3 };
        expect(utils.deepMerge(to, from)).toBeTruthy();
        expect(to).toEqual({ a: [1, 2, 3] });

        // object array elements
        to = { a: [{ x: 1 }] };
        from = { a: [{ y: 2 }] };
        expect(utils.deepMerge(to, from)).toBeTruthy();
        expect(to).toEqual({ a: [{ x: 1 }, { y: 2 }] });
        expect(utils.deepMerge({ a: [{ y: 2 }] }, { a: [{ y: 2 }] })).toBeFalsy();

        // don't add scalar to array if already in array
        to = { a: [1, 2] };
        from = { a: 2 };
        expect(utils.deepMerge(to, from)).toBeFalsy();
        expect(to).toEqual({ a: [1, 2] });
        to = { a: 2 };
        from = { a: [1, 2] };
        expect(utils.deepMerge(to, from)).toBeTruthy();
        expect(to).toEqual({ a: [2, 1] });
    });

    describe('readJsonSync()', () => {
        let testFilePaths: string[] = [];

        afterEach(async () => {
            // Clean up test files
            for (const filePath of testFilePaths) {
                try {
                    await vscode.workspace.fs.delete(vscode.Uri.file(filePath));
                } catch {
                    // Ignore cleanup errors
                }
            }
            testFilePaths = [];
        });

        it('should read json files', async () => {
            const testFile = join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`);
            testFilePaths.push(testFile);

            const jsonContent: SfdxTsConfig = { compilerOptions: { paths: { foo: ['bar'] } } };
            await vscode.workspace.fs.writeFile(vscode.Uri.file(testFile), new TextEncoder().encode(JSON.stringify(jsonContent)));

            const settings = await utils.readJsonSync(testFile);

            expect(settings).toHaveProperty('compilerOptions.paths.foo');
            expect(settings?.compilerOptions?.paths?.foo).toEqual(['bar']);
        });

        it('should read json files with comments', async () => {
            const testFile = join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`);
            testFilePaths.push(testFile);

            const jsonWithComments = {
                compilerOptions: {
                    paths: {
                        // this is a comment
                        foo: ['bar'],
                    },
                },
            };
            await vscode.workspace.fs.writeFile(vscode.Uri.file(testFile), new TextEncoder().encode(JSON.stringify(jsonWithComments)));

            const settings = await utils.readJsonSync(testFile);

            expect(settings).toHaveProperty('compilerOptions.paths.foo');
            expect(settings?.compilerOptions?.paths?.foo).toEqual(['bar']);
        });

        it('should return empty object for non-existing files', async () => {
            const nonExistentFile = join(os.tmpdir(), `non-existent-${Date.now()}.json`);

            const settings = await utils.readJsonSync(nonExistentFile);

            expect(Object.keys(settings).length).toEqual(0);
        });
    });
});
