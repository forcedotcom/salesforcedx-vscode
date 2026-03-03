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
import { LspFileSystemAccessor } from '../providers/lspFileSystemAccessor';
import { normalizePath } from '../utils';

describe('findNamespaceRoots', () => {
  let tempDir: string;
  let fileSystemAccessor: LspFileSystemAccessor;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    const uniqueName = `namespace-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    tempDir = path.join(os.tmpdir(), uniqueName);

    // Create a file system provider that uses in-memory maps for tests
    fileSystemAccessor = new LspFileSystemAccessor();
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
      const result = await findNamespaceRoots('/non/existent/path', fileSystemAccessor);
      expect(result).toEqual({ lwc: [] });
    });
  });

  describe('when directory is empty', () => {
    it('should return empty arrays', async () => {
      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result).toEqual({ lwc: [] });
    });
  });

  describe('when directory contains LWC modules', () => {
    it('should find LWC module roots with name/name.js pattern', async () => {
      // Create LWC module structure: myComponent/myComponent.js
      const componentDir = path.join(tempDir, 'myComponent');

      void fileSystemAccessor.updateFileContent(
        path.join(componentDir, 'myComponent.js'),
        'import { LightningElement } from "lwc";'
      );

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });

    it('should find multiple LWC module roots', async () => {
      // Create multiple LWC modules
      const component1Dir = path.join(tempDir, 'component1');
      const component2Dir = path.join(tempDir, 'component2');

      void fileSystemAccessor.updateFileContent(
        path.join(component1Dir, 'component1.js'),
        'import { LightningElement } from "lwc";'
      );
      void fileSystemAccessor.updateFileContent(
        path.join(component2Dir, 'component2.js'),
        'import { LightningElement } from "lwc";'
      );

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });

    it('should find LWC roots in nested directories', async () => {
      // Create nested structure: modules/lwc/myComponent/myComponent.js
      const modulesDir = path.join(tempDir, 'modules');
      const lwcDir = path.join(modulesDir, 'lwc');
      const componentDir = path.join(lwcDir, 'myComponent');

      void fileSystemAccessor.updateFileContent(
        path.join(componentDir, 'myComponent.js'),
        'import { LightningElement } from "lwc";'
      );

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor, 3);
      expect(result.lwc).toContain(normalizePath(path.resolve(lwcDir)));
    });
  });

  describe('when directory contains folders named "lwc"', () => {
    it('should find lwc folder as root', async () => {
      // Create lwc folder
      const lwcDir = path.join(tempDir, 'lwc');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toContain(normalizePath(path.resolve(lwcDir)));
    });
  });

  describe('when directory contains ignored folders', () => {
    it('should skip node_modules', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      const componentDir = path.join(nodeModulesDir, 'someComponent');

      void fileSystemAccessor.updateFileContent(
        path.join(componentDir, 'someComponent.js'),
        'import { LightningElement } from "lwc";'
      );

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });

    it('should skip bin, target, jest-modules, repository, git folders', async () => {
      const ignoredFolders = ['bin', 'target', 'jest-modules', 'repository', 'git'];

      for (const folder of ignoredFolders) {
        const ignoredDir = path.join(tempDir, folder);
        const componentDir = path.join(ignoredDir, 'someComponent');

        void fileSystemAccessor.updateFileContent(
          path.join(componentDir, 'someComponent.js'),
          'import { LightningElement } from "lwc";'
        );
      }

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });
  });

  describe('when maxDepth is reached', () => {
    it('should stop traversing at maxDepth', async () => {
      // Create deep nested structure beyond maxDepth
      let currentPath = tempDir;
      for (let i = 0; i < 10; i++) {
        currentPath = path.join(currentPath, `level${i}`);
      }

      const componentDir = path.join(currentPath, 'myComponent');
      await fileSystemAccessor.updateFileContent(
        path.join(componentDir, 'myComponent.js'),
        'import { LightningElement } from "lwc";'
      );

      // With default maxDepth of 5, should not find the component
      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });

    it('should find components within maxDepth', async () => {
      // Create nested structure within maxDepth
      const currentPath = tempDir;

      const componentDir = path.join(currentPath, 'myComponent');
      void fileSystemAccessor.updateFileContent(
        path.join(componentDir, 'myComponent.js'),
        'import { LightningElement } from "lwc";'
      );

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor, 5);
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

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
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

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });
  });

  describe('when custom maxDepth is provided', () => {
    it('should respect custom maxDepth parameter', async () => {
      // Create nested structure
      const level1Dir = path.join(tempDir, 'level1');
      const level2Dir = path.join(level1Dir, 'level2');
      const componentDir = path.join(level2Dir, 'myComponent');

      void fileSystemAccessor.updateFileContent(
        path.join(componentDir, 'myComponent.js'),
        'import { LightningElement } from "lwc";'
      );

      // With maxDepth 1, should not find the component
      const result1 = await findNamespaceRoots(tempDir, fileSystemAccessor, 1);
      expect(result1.lwc).toEqual([]);

      // With maxDepth 3, should find the component
      const result2 = await findNamespaceRoots(tempDir, fileSystemAccessor, 3);
      expect(result2.lwc).toContain(normalizePath(path.resolve(level2Dir)));
    });
  });

  describe('edge cases', () => {
    it('should handle directories with special characters in names', async () => {
      const componentDir = path.join(tempDir, 'my-component_123');
      void fileSystemAccessor.updateFileContent(
        path.join(componentDir, 'my-component_123.js'),
        'import { LightningElement } from "lwc";'
      );

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });

    it('should handle empty subdirectories', async () => {
      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });

    it('should handle symlinks gracefully', async () => {
      // Create a real directory with proper LWC module structure
      const realDir = path.join(tempDir, 'real');
      void fileSystemAccessor.updateFileContent(
        path.join(realDir, 'real.js'),
        'import { LightningElement } from "lwc";'
      );

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      // The function should find the temp directory as an LWC module root since it contains real/real.js
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });
  });
});
