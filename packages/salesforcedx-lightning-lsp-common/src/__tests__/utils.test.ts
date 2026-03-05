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
    const ctxt = new WorkspaceContext('' as NormalizedPath, new FileSystemDataProvider());
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
    let fileSystemProvider: FileSystemDataProvider;

    beforeEach(() => {
      fileSystemProvider = new FileSystemDataProvider();
    });

    afterEach(() => {
      fileSystemProvider.clear();
    });

    it('should read json files', async () => {
      const testFile = join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.json`);
      void fileSystemProvider.updateFileContent(
        `${testFile}`,
        JSON.stringify({ compilerOptions: { paths: { foo: ['bar'] } } })
      );
      const settings = await utils.readJsonSync(testFile, fileSystemProvider);

      expect(settings).toHaveProperty('compilerOptions.paths.foo');
      expect(settings?.compilerOptions?.paths?.foo).toEqual(['bar']);
    });

    it('should read json files with comments', async () => {
      const testFile = join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.json`);
      void fileSystemProvider.updateFileContent(
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
      void fileSystemProvider.updateFileContent(`${testFile}`, JSON.stringify(jsonWithComments));

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

  describe('readPackageJson()', () => {
    let fileSystemProvider: FileSystemDataProvider;
    const root = join(os.tmpdir(), `pjson-test-${Date.now()}`);
    const packageJsonPath = join(root, 'package.json');

    beforeEach(() => {
      fileSystemProvider = new FileSystemDataProvider();
    });

    afterEach(() => {
      fileSystemProvider.clear();
    });

    const seedPackageJson = (pkg: PackageJson): void => {
      void fileSystemProvider.updateFileContent(packageJsonPath, JSON.stringify(pkg));
    };

    it('returns undefined when package.json does not exist', () => {
      expect(utils.readPackageJson(root, fileSystemProvider)).toBeUndefined();
    });

    it('returns undefined when package.json content is not valid JSON', () => {
      void fileSystemProvider.updateFileContent(packageJsonPath, '{ not valid json }');
      expect(utils.readPackageJson(root, fileSystemProvider)).toBeUndefined();
    });

    it('returns undefined when package.json is not an object', () => {
      void fileSystemProvider.updateFileContent(packageJsonPath, '"just a string"');
      expect(utils.readPackageJson(root, fileSystemProvider)).toBeUndefined();
    });

    it('returns undefined when dependencies values are not strings', () => {
      void fileSystemProvider.updateFileContent(
        packageJsonPath,
        JSON.stringify({ dependencies: { foo: 42 } })
      );
      expect(utils.readPackageJson(root, fileSystemProvider)).toBeUndefined();
    });

    it('parses name', () => {
      seedPackageJson({ name: 'my-package' });
      expect(utils.readPackageJson(root, fileSystemProvider)?.name).toBe('my-package');
    });

    it('parses dependencies and devDependencies', () => {
      seedPackageJson({
        dependencies: { '@lwc/engine-dom': '8.0.0' },
        devDependencies: { typescript: '5.0.0' }
      });
      const result = utils.readPackageJson(root, fileSystemProvider);
      expect(result?.dependencies).toEqual({ '@lwc/engine-dom': '8.0.0' });
      expect(result?.devDependencies).toEqual({ typescript: '5.0.0' });
    });

    it('parses lwc field', () => {
      seedPackageJson({ lwc: { modules: [{ dir: 'src/modules' }] } });
      expect(utils.readPackageJson(root, fileSystemProvider)?.lwc).toBeTruthy();
    });

    it('parses workspaces field', () => {
      seedPackageJson({ workspaces: ['packages/*'] });
      expect(utils.readPackageJson(root, fileSystemProvider)?.workspaces).toBeTruthy();
    });

    it('returns empty object fields as undefined when not present', () => {
      seedPackageJson({});
      const result = utils.readPackageJson(root, fileSystemProvider);
      expect(result?.dependencies).toBeUndefined();
      expect(result?.devDependencies).toBeUndefined();
      expect(result?.lwc).toBeUndefined();
      expect(result?.workspaces).toBeUndefined();
    });
  });
});
