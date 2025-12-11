/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'node:os';
import { join, resolve } from 'node:path';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FileSystemDataProvider } from '../providers/fileSystemDataProvider';
import * as utils from '../utils';
import { WorkspaceContext } from './workspaceContext';

describe('utils', () => {
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
        const ctxt = new WorkspaceContext('', new FileSystemDataProvider());
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

    describe('readJsonSync()', () => {
        let fileSystemProvider: FileSystemDataProvider;

        beforeEach(() => {
            fileSystemProvider = new FileSystemDataProvider();
        });

        afterEach(async () => {
            fileSystemProvider.clear();
        });

        it('should read json files', async () => {
            const testFile = join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.json`);
            fileSystemProvider.updateFileContent(`${testFile}`, JSON.stringify({ compilerOptions: { paths: { foo: ['bar'] } } }));
            const settings = await utils.readJsonSync(testFile, fileSystemProvider);

            expect(settings).toHaveProperty('compilerOptions.paths.foo');
            expect(settings?.compilerOptions?.paths?.foo).toEqual(['bar']);
        });

        it('should read json files with comments', async () => {
            const testFile = join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.json`);
            fileSystemProvider.updateFileContent(`${testFile}`, JSON.stringify({ compilerOptions: { paths: { foo: ['bar'] } } }));

            const jsonWithComments = {
                compilerOptions: {
                    paths: {
                        // this is a comment
                        foo: ['bar'],
                    },
                },
            };
            fileSystemProvider.updateFileContent(`${testFile}`, JSON.stringify(jsonWithComments));

            const settings = await utils.readJsonSync(testFile, fileSystemProvider);

            expect(settings).toHaveProperty('compilerOptions.paths.foo');
            expect(settings?.compilerOptions?.paths?.foo).toEqual(['bar']);
        });

        it('should return empty object for non-existing files', async () => {
            const nonExistentFile = join(os.tmpdir(), `non-existent-${Date.now()}.json`);

            const settings = await utils.readJsonSync(nonExistentFile, fileSystemProvider);

            expect(Object.keys(settings).length).toEqual(0);
        });
    });
});
