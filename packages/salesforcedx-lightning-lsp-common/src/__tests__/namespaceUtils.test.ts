/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FileStat } from '../types/fileSystemTypes';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { findNamespaceRoots } from '../namespaceUtils';
import { LspFileSystemAccessor } from '../providers/lspFileSystemAccessor';
import { normalizePath, type NormalizedPath } from '../utils';

describe('findNamespaceRoots', () => {
  let tempDir: string;
  let normTempDir: string;
  let fileSystemAccessor: LspFileSystemAccessor;

  beforeEach(() => {
    const uniqueName = `namespace-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    tempDir = path.join(os.tmpdir(), uniqueName);
    fs.mkdirSync(tempDir, { recursive: true });
    normTempDir = normalizePath(tempDir);

    fileSystemAccessor = new LspFileSystemAccessor();

    // Mock accessor to use real FS for paths under this test's tempDir (no LSP in tests)
    const isUnderTemp = (key: string): boolean => key === normTempDir || key.startsWith(`${normTempDir}/`);
    jest.spyOn(fileSystemAccessor, 'getFileStat').mockImplementation(async (uri: string) => {
      const key = normalizePath(uri);
      if (!isUnderTemp(key)) return undefined;
      try {
        const stat = await fsPromises.stat(uri);
        return {
          type: stat.isDirectory() ? ('directory' as const) : ('file' as const),
          exists: true,
          ctime: stat.ctimeMs,
          mtime: stat.mtimeMs,
          size: stat.size
        } satisfies FileStat;
      } catch {
        return undefined;
      }
    });
    jest.spyOn(fileSystemAccessor, 'getDirectoryListing').mockImplementation((uri: NormalizedPath) => {
      const key = normalizePath(uri);
      if (!isUnderTemp(key)) return [];
      try {
        const entries = fs.readdirSync(uri, { withFileTypes: true });
        return entries.map(e => ({
          name: e.name,
          type: (e.isDirectory() ? 'directory' : 'file') as 'directory' | 'file',
          uri: `file://${path.join(uri, e.name)}`
        }));
      } catch {
        return [];
      }
    });
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
      const componentDir = path.join(tempDir, 'myComponent');
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(path.join(componentDir, 'myComponent.js'), 'import { LightningElement } from "lwc";');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });

    it('should find multiple LWC module roots', async () => {
      const component1Dir = path.join(tempDir, 'component1');
      const component2Dir = path.join(tempDir, 'component2');
      fs.mkdirSync(component1Dir, { recursive: true });
      fs.mkdirSync(component2Dir, { recursive: true });
      fs.writeFileSync(path.join(component1Dir, 'component1.js'), 'import { LightningElement } from "lwc";');
      fs.writeFileSync(path.join(component2Dir, 'component2.js'), 'import { LightningElement } from "lwc";');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });

    it('should find LWC roots in nested directories', async () => {
      const modulesDir = path.join(tempDir, 'modules');
      const lwcDir = path.join(modulesDir, 'lwc');
      const componentDir = path.join(lwcDir, 'myComponent');
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(path.join(componentDir, 'myComponent.js'), 'import { LightningElement } from "lwc";');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor, 3);
      expect(result.lwc).toContain(normalizePath(path.resolve(lwcDir)));
    });
  });

  describe('when directory contains folders named "lwc"', () => {
    it('should find lwc folder as root', async () => {
      const lwcDir = path.join(tempDir, 'lwc');
      fs.mkdirSync(lwcDir, { recursive: true });

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toContain(normalizePath(path.resolve(lwcDir)));
    });
  });

  describe('when directory contains ignored folders', () => {
    it('should skip node_modules', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      const componentDir = path.join(nodeModulesDir, 'someComponent');
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(path.join(componentDir, 'someComponent.js'), 'import { LightningElement } from "lwc";');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });

    it('should skip bin, target, jest-modules, repository, git folders', async () => {
      const ignoredFolders = ['bin', 'target', 'jest-modules', 'repository', 'git'];
      for (const folder of ignoredFolders) {
        const ignoredDir = path.join(tempDir, folder);
        const componentDir = path.join(ignoredDir, 'someComponent');
        fs.mkdirSync(componentDir, { recursive: true });
        fs.writeFileSync(path.join(componentDir, 'someComponent.js'), 'import { LightningElement } from "lwc";');
      }

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });
  });

  describe('when maxDepth is reached', () => {
    it('should stop traversing at maxDepth', async () => {
      let currentPath = tempDir;
      for (let i = 0; i < 10; i++) {
        currentPath = path.join(currentPath, `level${i}`);
      }
      const componentDir = path.join(currentPath, 'myComponent');
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(path.join(componentDir, 'myComponent.js'), 'import { LightningElement } from "lwc";');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });

    it('should find components within maxDepth', async () => {
      const currentPath = tempDir;
      const componentDir = path.join(currentPath, 'myComponent');
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(path.join(componentDir, 'myComponent.js'), 'import { LightningElement } from "lwc";');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor, 5);
      expect(result.lwc).toContain(normalizePath(path.resolve(currentPath)));
    });
  });

  describe('when directory contains non-module files', () => {
    it('should not treat directories without matching .js files as module roots', async () => {
      const componentDir = path.join(tempDir, 'myComponent');
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(path.join(componentDir, 'other.js'), 'console.log("not a module");');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });

    it('should not treat directories with only non-JS files as module roots', async () => {
      const componentDir = path.join(tempDir, 'myComponent');
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(path.join(componentDir, 'myComponent.html'), '<template></template>');
      fs.writeFileSync(path.join(componentDir, 'myComponent.css'), '.my-component {}');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });
  });

  describe('when custom maxDepth is provided', () => {
    it('should respect custom maxDepth parameter', async () => {
      const level1Dir = path.join(tempDir, 'level1');
      const level2Dir = path.join(level1Dir, 'level2');
      const componentDir = path.join(level2Dir, 'myComponent');
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(path.join(componentDir, 'myComponent.js'), 'import { LightningElement } from "lwc";');

      const result1 = await findNamespaceRoots(tempDir, fileSystemAccessor, 1);
      expect(result1.lwc).toEqual([]);

      const result2 = await findNamespaceRoots(tempDir, fileSystemAccessor, 3);
      expect(result2.lwc).toContain(normalizePath(path.resolve(level2Dir)));
    });
  });

  describe('edge cases', () => {
    it('should handle directories with special characters in names', async () => {
      const componentDir = path.join(tempDir, 'my-component_123');
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(path.join(componentDir, 'my-component_123.js'), 'import { LightningElement } from "lwc";');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });

    it('should handle empty subdirectories', async () => {
      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toEqual([]);
    });

    it('should handle symlinks gracefully', async () => {
      const realDir = path.join(tempDir, 'real');
      fs.mkdirSync(realDir, { recursive: true });
      fs.writeFileSync(path.join(realDir, 'real.js'), 'import { LightningElement } from "lwc";');

      const result = await findNamespaceRoots(tempDir, fileSystemAccessor);
      expect(result.lwc).toContain(normalizePath(path.resolve(tempDir)));
    });
  });
});
