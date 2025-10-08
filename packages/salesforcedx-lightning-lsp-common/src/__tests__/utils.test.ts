/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import mockFs from 'mock-fs';
import { join, resolve } from 'node:path';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import { TextDocument, FileEvent, FileChangeType } from 'vscode-languageserver';
import * as utils from '../utils';
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

    it('appendLineIfMissing()', async () => {
        const file = tmp.tmpNameSync();
        tmp.setGracefulCleanup();

        // creates with line if file doesn't exist
        expect(fs.existsSync(file)).toBeFalsy();
        await utils.appendLineIfMissing(file, 'line 1');
        expect(fs.readFileSync(file, 'utf8')).toBe('line 1\n');

        // add second line
        await utils.appendLineIfMissing(file, 'line 2');
        expect(fs.readFileSync(file, 'utf8')).toBe('line 1\n\nline 2\n');

        // doesn't add line if already there
        await utils.appendLineIfMissing(file, 'line 1');
        expect(fs.readFileSync(file, 'utf8')).toBe('line 1\n\nline 2\n');
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
        afterEach(() => {
            mockFs.restore();
        });

        it('should read json files', () => {
            mockFs({
                '/path/to/settings.json': '{"foo": "bar"}',
            });

            const settings = utils.readJsonSync('/path/to/settings.json');

            expect(settings).toHaveProperty('foo');
            expect(settings.foo).toEqual('bar');
        });

        it('should read json files with comments', () => {
            mockFs({
                '/path/to/settings.json': `{
                // this is a comment
                "foo": "bar"
            }`,
            });

            const settings = utils.readJsonSync('/path/to/settings.json');

            expect(settings).toHaveProperty('foo');
            expect(settings.foo).toEqual('bar');
        });

        it('should return empty object for non-existing files', () => {
            const settings = utils.readJsonSync('/path/to/settings.json');

            expect(Object.keys(settings).length).toEqual(0);
        });
    });
});
