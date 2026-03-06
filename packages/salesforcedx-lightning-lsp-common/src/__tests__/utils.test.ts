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
import { PackageJson } from '../types/packageJson';
import * as utils from '../utils';
import { NormalizedPath } from '../utils';
import { WorkspaceContext } from './workspaceContext';

describe('utils', () => {
  it('isLWCRootDirectoryChange', () => {
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
    const setContent = (path: string, content: string): void => {
      contentMap.set(utils.normalizePath(path), content);
    };

    beforeEach(() => {
      fileSystemAccessor = new LspFileSystemAccessor();
      contentMap.clear();
      jest
        .spyOn(fileSystemAccessor, 'getFileContent')
        .mockImplementation((uri: string) => Promise.resolve(contentMap.get(utils.normalizePath(uri))));
    });

    it('should read json files', async () => {
      const testFile = join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.json`);
      setContent(testFile, JSON.stringify({ compilerOptions: { paths: { foo: ['bar'] } } }));
      const settings = await utils.readJsonSync(testFile, fileSystemAccessor);

      expect(settings).toHaveProperty('compilerOptions.paths.foo');
      expect(settings?.compilerOptions?.paths?.foo).toEqual(['bar']);
    });

    it('should read json files with comments', async () => {
      const testFile = join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.json`);
      const jsonWithComments = {
        compilerOptions: {
          paths: {
            // this is a comment
            foo: ['bar']
          }
        }
      };
      setContent(testFile, JSON.stringify(jsonWithComments));

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

  describe('readPackageJson()', () => {
    let fileSystemProvider: LspFileSystemAccessor;
    const root = join(os.tmpdir(), `pjson-test-${Date.now()}`);
    const packageJsonPath = join(root, 'package.json');
    const contentMap = new Map<string, string>();
    const setContent = (path: string, content: string): void => {
      contentMap.set(utils.normalizePath(path), content);
    };
    const seedPackageJson = (pkg: PackageJson): void => setContent(packageJsonPath, JSON.stringify(pkg));

    beforeEach(() => {
      fileSystemProvider = new LspFileSystemAccessor();
      contentMap.clear();
      jest
        .spyOn(fileSystemProvider, 'getFileContent')
        .mockImplementation((uri: string) => Promise.resolve(contentMap.get(utils.normalizePath(uri))));
    });

    it('returns undefined when package.json does not exist', async () => {
      expect(await utils.readPackageJson(root, fileSystemProvider)).toBeUndefined();
    });

    it('returns undefined when package.json content is not valid JSON', async () => {
      setContent(packageJsonPath, '{ not valid json }');
      expect(await utils.readPackageJson(root, fileSystemProvider)).toBeUndefined();
    });

    it('returns undefined when package.json is not an object', async () => {
      setContent(packageJsonPath, '"just a string"');
      expect(await utils.readPackageJson(root, fileSystemProvider)).toBeUndefined();
    });

    it('returns undefined when dependencies values are not strings', async () => {
      setContent(packageJsonPath, JSON.stringify({ dependencies: { foo: 42 } }));
      expect(await utils.readPackageJson(root, fileSystemProvider)).toBeUndefined();
    });

    it('parses name', async () => {
      seedPackageJson({ name: 'my-package' });
      expect((await utils.readPackageJson(root, fileSystemProvider))?.name).toBe('my-package');
    });

    it('parses dependencies and devDependencies', async () => {
      seedPackageJson({
        dependencies: { '@lwc/engine-dom': '8.0.0' },
        devDependencies: { typescript: '5.0.0' }
      });
      const result = await utils.readPackageJson(root, fileSystemProvider);
      expect(result?.dependencies).toEqual({ '@lwc/engine-dom': '8.0.0' });
      expect(result?.devDependencies).toEqual({ typescript: '5.0.0' });
    });

    it('parses lwc field', async () => {
      seedPackageJson({ lwc: { modules: [{ dir: 'src/modules' }] } });
      expect((await utils.readPackageJson(root, fileSystemProvider))?.lwc).toBeTruthy();
    });

    it('parses workspaces field', async () => {
      seedPackageJson({ workspaces: ['packages/*'] });
      expect((await utils.readPackageJson(root, fileSystemProvider))?.workspaces).toBeTruthy();
    });

    it('returns empty object fields as undefined when not present', async () => {
      seedPackageJson({});
      const result = await utils.readPackageJson(root, fileSystemProvider);
      expect(result?.dependencies).toBeUndefined();
      expect(result?.devDependencies).toBeUndefined();
      expect(result?.lwc).toBeUndefined();
      expect(result?.workspaces).toBeUndefined();
    });
  });
});
