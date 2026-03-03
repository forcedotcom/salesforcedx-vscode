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
import { LspFileSystemAccessor } from '../providers/lspFileSystemAccessor';
import * as utils from '../utils';
import { NormalizedPath } from '../utils';
import { WorkspaceContext } from './workspaceContext';

describe('utils', () => {
  it('isLWCRootDirectoryChange', async () => {
    const noLwcFolderCreated: FileEvent = {
      type: FileChangeType.Created,
      uri: 'file:///Users/user/test/dir'
    };
    const noLwcFolderDeleted: FileEvent = {
      type: FileChangeType.Deleted,
      uri: 'file:///Users/user/test/dir'
    };
    const lwcFolderCreated: FileEvent = {
      type: FileChangeType.Created,
      uri: 'file:///Users/user/test/dir/lwc'
    };
    const lwcFolderDeleted: FileEvent = {
      type: FileChangeType.Deleted,
      uri: 'file:///Users/user/test/dir/lwc'
    };
    const ctxt = new WorkspaceContext('' as NormalizedPath, new LspFileSystemAccessor());
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
    const expected = join('tmp', 'a');
    // Normalize paths for cross-platform compatibility
    const normalizedCanonical = utils.normalizePath(canonical);
    const normalizedExpected = utils.normalizePath(expected);
    expect(normalizedCanonical.endsWith(normalizedExpected)).toBe(true);
  });

  describe('readJsonSync()', () => {
    let fileSystemAccessor: LspFileSystemAccessor;
    const contentMap = new Map<string, string>();

    beforeEach(() => {
      fileSystemAccessor = new LspFileSystemAccessor();
      contentMap.clear();
      jest.spyOn(fileSystemAccessor, 'getFileContent').mockImplementation(async (uri: string) => contentMap.get(utils.normalizePath(uri)));
      jest.spyOn(fileSystemAccessor, 'updateFileContent').mockImplementation(async (uri: string, content: string) => {
        contentMap.set(utils.normalizePath(uri), content);
      });
    });

    it('should read json files', async () => {
      const testFile = join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.json`);
      void fileSystemAccessor.updateFileContent(
        `${testFile}`,
        JSON.stringify({ compilerOptions: { paths: { foo: ['bar'] } } })
      );
      const settings = await utils.readJsonSync(testFile, fileSystemAccessor);

      expect(settings).toHaveProperty('compilerOptions.paths.foo');
      expect(settings?.compilerOptions?.paths?.foo).toEqual(['bar']);
    });

    it('should read json files with comments', async () => {
      const testFile = join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.json`);
      void fileSystemAccessor.updateFileContent(
        `${testFile}`,
        JSON.stringify({ compilerOptions: { paths: { foo: ['bar'] } } })
      );

      const jsonWithComments = {
        compilerOptions: {
          paths: {
            // this is a comment
            foo: ['bar']
          }
        }
      };
      void fileSystemAccessor.updateFileContent(`${testFile}`, JSON.stringify(jsonWithComments));

      const settings = await utils.readJsonSync(testFile, fileSystemAccessor);

      expect(settings).toHaveProperty('compilerOptions.paths.foo');
      expect(settings?.compilerOptions?.paths?.foo).toEqual(['bar']);
    });

    it('should return empty object for non-existing files', async () => {
      const nonExistentFile = join(os.tmpdir(), `non-existent-${Date.now()}.json`);

      const settings = await utils.readJsonSync(nonExistentFile, fileSystemAccessor);

      expect(Object.keys(settings).length).toEqual(0);
    });
  });
});
