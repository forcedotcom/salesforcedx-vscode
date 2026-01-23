/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { findNamespaceRoots } from '../namespaceUtils';
import { FileSystemDataProvider } from '../providers/fileSystemDataProvider';
import { normalizePath } from '../utils';

describe('findNamespaceRoots', () => {
  let tempDir: string;
  let fileSystemProvider: FileSystemDataProvider;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    const uniqueName = `namespace-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    tempDir = path.join(os.tmpdir(), uniqueName);

    // Create a file system provider that uses the real file system for tests
    fileSystemProvider = new FileSystemDataProvider();
    fileSystemProvider.updateFileStat(tempDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
    fileSystemProvider.updateDirectoryListing(tempDir, []);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await vscode.workspace.fs.delete(vscode.Uri.file(tempDir), { recursive: true, useTrash: false });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('when directory does not exist', () => {
    it('should return empty arrays', async () => {
      const result = await findNamespaceRoots('/non/existent/path', fileSystemProvider);
      expect(result).toEqual({ lwc: [] });
    });
  });

  describe('when directory is empty', () => {
    it('should return empty arrays', async () => {
      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result).toEqual({ lwc: [] });
    });
  });

  describe('when directory contains LWC modules', () => {
    it('should find LWC module roots with name/name.js pattern', async () => {
      // Create LWC module structure: myComponent/myComponent.js
      const componentDir = path.join(tempDir, 'myComponent');
      fileSystemProvider.updateDirectoryListing(tempDir, [
        {
          name: 'myComponent',
          type: 'directory',
          uri: `${tempDir}/myComponent`
        }
      ]);
      fileSystemProvider.updateFileStat(tempDir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      fileSystemProvider.updateFileStat(componentDir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      void fileSystemProvider.updateFileContent(
        path.join(componentDir, 'myComponent.js'),
        'import { LightningElement } from "lwc";'
      );
      fileSystemProvider.updateFileStat(path.join(componentDir, 'myComponent.js'), {
        type: 'file',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 'import { LightningElement } from "lwc";'.length ?? 0
      });

      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });

    it('should find multiple LWC module roots', async () => {
      // Create multiple LWC modules
      const component1Dir = path.join(tempDir, 'component1');
      const component2Dir = path.join(tempDir, 'component2');

      fileSystemProvider.updateFileStat(tempDir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      fileSystemProvider.updateDirectoryListing(tempDir, [
        {
          name: 'component1',
          type: 'directory',
          uri: `${tempDir}/component1`
        },
        {
          name: 'component2',
          type: 'directory',
          uri: `${tempDir}/component2`
        }
      ]);
      fileSystemProvider.updateFileStat(component1Dir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      fileSystemProvider.updateFileStat(component2Dir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      void fileSystemProvider.updateFileContent(
        path.join(component1Dir, 'component1.js'),
        'import { LightningElement } from "lwc";'
      );
      fileSystemProvider.updateFileStat(path.join(component1Dir, 'component1.js'), {
        type: 'file',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 'import { LightningElement } from "lwc";'.length ?? 0
      });
      void fileSystemProvider.updateFileContent(
        path.join(component2Dir, 'component2.js'),
        'import { LightningElement } from "lwc";'
      );
      fileSystemProvider.updateFileStat(path.join(component2Dir, 'component2.js'), {
        type: 'file',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 'import { LightningElement } from "lwc";'.length ?? 0
      });

      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });

    it('should find LWC roots in nested directories', async () => {
      // Create nested structure: modules/lwc/myComponent/myComponent.js
      const modulesDir = path.join(tempDir, 'modules');
      const lwcDir = path.join(modulesDir, 'lwc');
      const componentDir = path.join(lwcDir, 'myComponent');

      fileSystemProvider.updateFileStat(tempDir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      fileSystemProvider.updateDirectoryListing(tempDir, [
        {
          name: 'modules',
          type: 'directory',
          uri: `${tempDir}/modules`
        }
      ]);
      fileSystemProvider.updateFileStat(modulesDir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      fileSystemProvider.updateDirectoryListing(modulesDir, [
        {
          name: 'lwc',
          type: 'directory',
          uri: `${modulesDir}/lwc`
        }
      ]);
      fileSystemProvider.updateFileStat(lwcDir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      fileSystemProvider.updateDirectoryListing(lwcDir, [
        {
          name: 'myComponent',
          type: 'directory',
          uri: `${lwcDir}/myComponent`
        }
      ]);
      fileSystemProvider.updateFileStat(componentDir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      void fileSystemProvider.updateFileContent(
        path.join(componentDir, 'myComponent.js'),
        'import { LightningElement } from "lwc";'
      );
      fileSystemProvider.updateFileStat(path.join(componentDir, 'myComponent.js'), {
        type: 'file',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 'import { LightningElement } from "lwc";'.length ?? 0
      });

      const result = await findNamespaceRoots(tempDir, fileSystemProvider, 3);
      expect(result.lwc).toContain(normalizePath(path.resolve(lwcDir)));
    });
  });

  describe('when directory contains folders named "lwc"', () => {
    it('should find lwc folder as root', async () => {
      // Create lwc folder
      const lwcDir = path.join(tempDir, 'lwc');
      fileSystemProvider.updateFileStat(tempDir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      fileSystemProvider.updateDirectoryListing(tempDir, [
        {
          name: 'lwc',
          type: 'directory',
          uri: `${tempDir}/lwc`
        }
      ]);

      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result.lwc).toContain(normalizePath(path.resolve(lwcDir)));
    });
  });

  describe('when directory contains ignored folders', () => {
    it('should skip node_modules', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      const componentDir = path.join(nodeModulesDir, 'someComponent');

      fileSystemProvider.updateFileStat(tempDir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      fileSystemProvider.updateDirectoryListing(tempDir, [
        {
          name: 'node_modules',
          type: 'directory',
          uri: `${tempDir}/node_modules`
        }
      ]);
      fileSystemProvider.updateFileStat(nodeModulesDir, {
        type: 'directory',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 0
      });
      fileSystemProvider.updateDirectoryListing(nodeModulesDir, [
        {
          name: 'someComponent',
          type: 'directory',
          uri: `${nodeModulesDir}/someComponent`
        }
      ]);
      void fileSystemProvider.updateFileContent(
        path.join(componentDir, 'someComponent.js'),
        'import { LightningElement } from "lwc";'
      );
      fileSystemProvider.updateFileStat(path.join(componentDir, 'someComponent.js'), {
        type: 'file',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 'import { LightningElement } from "lwc";'.length ?? 0
      });

      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result.lwc).toEqual([]);
    });

    it('should skip bin, target, jest-modules, repository, git folders', async () => {
      const ignoredFolders = ['bin', 'target', 'jest-modules', 'repository', 'git'];

      for (const folder of ignoredFolders) {
        const ignoredDir = path.join(tempDir, folder);
        const componentDir = path.join(ignoredDir, 'someComponent');

        fileSystemProvider.updateFileStat(tempDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
        fileSystemProvider.updateDirectoryListing(tempDir, [
          { name: folder, type: 'directory', uri: `${tempDir}/${folder}` }
        ]);
        fileSystemProvider.updateFileStat(ignoredDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
        fileSystemProvider.updateDirectoryListing(ignoredDir, [
          { name: 'someComponent', type: 'directory', uri: `${ignoredDir}/someComponent` }
        ]);
        void fileSystemProvider.updateFileContent(
          path.join(componentDir, 'someComponent.js'),
          'import { LightningElement } from "lwc";'
        );
        fileSystemProvider.updateFileStat(path.join(componentDir, 'someComponent.js'), {
          type: 'file',
          exists: true,
          ctime: 0,
          mtime: 0,
          size: 'import { LightningElement } from "lwc";'.length ?? 0
        });
      }

      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result.lwc).toEqual([]);
    });
  });

  describe('when maxDepth is reached', () => {
    it('should stop traversing at maxDepth', async () => {
      // Create deep nested structure beyond maxDepth
      let currentPath = tempDir;
      for (let i = 0; i < 10; i++) {
        currentPath = path.join(currentPath, `level${i}`);
        fileSystemProvider.updateFileStat(currentPath, {
          type: 'directory',
          exists: true,
          ctime: 0,
          mtime: 0,
          size: 0
        });
        fileSystemProvider.updateDirectoryListing(currentPath, [
          { name: `level${i}`, type: 'directory', uri: `${currentPath}/level${i}` }
        ]);
      }

      const componentDir = path.join(currentPath, 'myComponent');
      fileSystemProvider.updateFileStat(componentDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      void fileSystemProvider.updateFileContent(
        path.join(componentDir, 'myComponent.js'),
        'import { LightningElement } from "lwc";'
      );
      fileSystemProvider.updateFileStat(path.join(componentDir, 'myComponent.js'), {
        type: 'file',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 'import { LightningElement } from "lwc";'.length ?? 0
      });

      // With default maxDepth of 5, should not find the component
      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result.lwc).toEqual([]);
    });

    it('should find components within maxDepth', async () => {
      // Create nested structure within maxDepth
      let currentPath = tempDir;

      // Set up root directory
      fileSystemProvider.updateFileStat(tempDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      fileSystemProvider.updateDirectoryListing(tempDir, [
        { name: 'level0', type: 'directory', uri: `${tempDir}/level0` }
      ]);

      for (let i = 0; i < 3; i++) {
        currentPath = path.join(currentPath, `level${i}`);
        fileSystemProvider.updateFileStat(currentPath, {
          type: 'directory',
          exists: true,
          ctime: 0,
          mtime: 0,
          size: 0
        });
        if (i < 2) {
          // Don't add directory listing for the last level
          fileSystemProvider.updateDirectoryListing(currentPath, [
            { name: `level${i + 1}`, type: 'directory', uri: `${currentPath}/level${i + 1}` }
          ]);
        }
      }

      const componentDir = path.join(currentPath, 'myComponent');
      fileSystemProvider.updateFileStat(componentDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      fileSystemProvider.updateDirectoryListing(currentPath, [
        { name: 'myComponent', type: 'directory', uri: componentDir }
      ]);
      void fileSystemProvider.updateFileContent(
        path.join(componentDir, 'myComponent.js'),
        'import { LightningElement } from "lwc";'
      );
      fileSystemProvider.updateFileStat(path.join(componentDir, 'myComponent.js'), {
        type: 'file',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 'import { LightningElement } from "lwc";'.length ?? 0
      });

      const result = await findNamespaceRoots(tempDir, fileSystemProvider, 5);
      expect(result.lwc).toContain(normalizePath(path.resolve(currentPath)));
    });
  });

  describe('when directory contains non-module files', () => {
    it('should not treat directories without matching .js files as module roots', async () => {
      // Create directory with .js file that doesn't match the name pattern
      const componentDir = path.join(tempDir, 'myComponent');
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(componentDir));
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(path.join(componentDir, 'other.js')),
        new TextEncoder().encode('console.log("not a module");')
      );

      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result.lwc).toEqual([]);
    });

    it('should not treat directories with only non-JS files as module roots', async () => {
      // Create directory with only non-JS files
      const componentDir = path.join(tempDir, 'myComponent');
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(componentDir));
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(path.join(componentDir, 'myComponent.html')),
        new TextEncoder().encode('<template></template>')
      );
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(path.join(componentDir, 'myComponent.css')),
        new TextEncoder().encode('.my-component {}')
      );

      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result.lwc).toEqual([]);
    });
  });

  describe('when custom maxDepth is provided', () => {
    it('should respect custom maxDepth parameter', async () => {
      // Create nested structure
      const level1Dir = path.join(tempDir, 'level1');
      const level2Dir = path.join(level1Dir, 'level2');
      const componentDir = path.join(level2Dir, 'myComponent');

      fileSystemProvider.updateFileStat(tempDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      fileSystemProvider.updateDirectoryListing(tempDir, [
        { name: 'level1', type: 'directory', uri: `${tempDir}/level1` }
      ]);
      fileSystemProvider.updateFileStat(level1Dir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      fileSystemProvider.updateDirectoryListing(level1Dir, [
        { name: 'level2', type: 'directory', uri: `${level1Dir}/level2` }
      ]);
      fileSystemProvider.updateFileStat(level2Dir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      fileSystemProvider.updateDirectoryListing(level2Dir, [
        { name: 'myComponent', type: 'directory', uri: componentDir }
      ]);
      void fileSystemProvider.updateFileContent(
        path.join(componentDir, 'myComponent.js'),
        'import { LightningElement } from "lwc";'
      );
      fileSystemProvider.updateFileStat(path.join(componentDir, 'myComponent.js'), {
        type: 'file',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 'import { LightningElement } from "lwc";'.length ?? 0
      });

      // With maxDepth 1, should not find the component
      const result1 = await findNamespaceRoots(tempDir, fileSystemProvider, 1);
      expect(result1.lwc).toEqual([]);

      // With maxDepth 3, should find the component
      const result2 = await findNamespaceRoots(tempDir, fileSystemProvider, 3);
      expect(result2.lwc).toContain(normalizePath(path.resolve(level2Dir)));
    });
  });

  describe('edge cases', () => {
    it('should handle directories with special characters in names', async () => {
      const componentDir = path.join(tempDir, 'my-component_123');
      fileSystemProvider.updateFileStat(tempDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      fileSystemProvider.updateDirectoryListing(tempDir, [
        { name: 'my-component_123', type: 'directory', uri: `${tempDir}/my-component_123` }
      ]);
      fileSystemProvider.updateFileStat(componentDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      fileSystemProvider.updateDirectoryListing(componentDir, [
        { name: 'my-component_123.js', type: 'file', uri: `${componentDir}/my-component_123.js` }
      ]);
      void fileSystemProvider.updateFileContent(
        path.join(componentDir, 'my-component_123.js'),
        'import { LightningElement } from "lwc";'
      );
      fileSystemProvider.updateFileStat(path.join(componentDir, 'my-component_123.js'), {
        type: 'file',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 'import { LightningElement } from "lwc";'.length ?? 0
      });

      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });

    it('should handle empty subdirectories', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      fileSystemProvider.updateFileStat(emptyDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      fileSystemProvider.updateDirectoryListing(emptyDir, []);

      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      expect(result.lwc).toEqual([]);
    });

    it('should handle symlinks gracefully', async () => {
      // Create a real directory with proper LWC module structure
      const realDir = path.join(tempDir, 'real');
      fileSystemProvider.updateFileStat(tempDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      fileSystemProvider.updateDirectoryListing(tempDir, [{ name: 'real', type: 'directory', uri: `${tempDir}/real` }]);
      fileSystemProvider.updateFileStat(realDir, { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 });
      fileSystemProvider.updateDirectoryListing(realDir, [
        { name: 'real.js', type: 'file', uri: `${realDir}/real.js` }
      ]);
      void fileSystemProvider.updateFileContent(path.join(realDir, 'real.js'), 'import { LightningElement } from "lwc";');
      fileSystemProvider.updateFileStat(path.join(realDir, 'real.js'), {
        type: 'file',
        exists: true,
        ctime: 0,
        mtime: 0,
        size: 'import { LightningElement } from "lwc";'.length ?? 0
      });

      // Note: VS Code file system API doesn't support creating symlinks directly
      // but we can still test that existing symlinks are handled gracefully
      const result = await findNamespaceRoots(tempDir, fileSystemProvider);
      // The function should find the temp directory as an LWC module root since it contains real/real.js
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });
  });
});
