/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type fs, resetFs, setFs } from '@salesforce/core/fs';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { createFsFromVolume, Volume } from 'memfs';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { FsProvider } from '../../../src/virtualFsProvider/fileSystemProvider';

const registryAccess = new RegistryAccess();
const originalGetTypeBySuffix = registryAccess.getTypeBySuffix.bind(registryAccess);

// POSIX workspace path so uri.path is drive-less and identical across platforms.
// The provider addresses files by uri.path (memfs/web semantics), so on Windows a
// URI.file(os.tmpdir()) path like /c:/... would resolve against the current drive
// (D:\C:\...) and ENOENT. Back the provider with memfs (as the web build does).
const workspaceDir = '/dx-project';

describe('FsProvider read-only checks', () => {
  beforeAll(() => {
    setFs(
      createFsFromVolume(
        Volume.fromJSON({
          [`${workspaceDir}/MyClass.cls`]: 'public class MyClass {}',
          [`${workspaceDir}/foo.txt`]: 'plain'
        })
      ) as unknown as typeof fs
    );
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      configurable: true,
      value: [
        {
          uri: { scheme: 'file', fsPath: workspaceDir, toString: (): string => `file://${workspaceDir}` },
          name: 'ws',
          index: 0
        }
      ]
    });
  });

  afterAll(() => {
    resetFs();
  });

  const clsUri = (): URI => URI.file(`${workspaceDir}/MyClass.cls`);
  const txtUri = (): URI => URI.file(`${workspaceDir}/foo.txt`);

  describe('uses the bootstrap-acquired registry without requiring runtime publication', () => {
    beforeEach(() => {
      vi.spyOn(registryAccess, 'getTypeBySuffix').mockImplementation(originalGetTypeBySuffix);
    });
    afterEach(() => vi.restoreAllMocks());

    it('stat marks a read-only metadata type Readonly via the shared runtime', async () => {
      const provider = new FsProvider();
      provider.readOnly = { registry: registryAccess, types: [registryAccess.getTypeByName('ApexClass')] };

      const stat = await provider.stat(clsUri());

      expect(stat.permissions).toBe(vscode.FilePermission.Readonly);
      expect(registryAccess.getTypeBySuffix).toHaveBeenCalledTimes(1);
    });

    it('writeFile rejects a read-only metadata type via the shared runtime', async () => {
      const provider = new FsProvider();
      provider.readOnly = { registry: registryAccess, types: [registryAccess.getTypeByName('ApexClass')] };

      await expect(
        provider.writeFile(clsUri(), new TextEncoder().encode('x'), { create: false, overwrite: true })
      ).rejects.toMatchObject({ code: 'NoPermissions' });
      expect(registryAccess.getTypeBySuffix).toHaveBeenCalledTimes(1);
    });

    it('delete rejects a read-only metadata type via the shared runtime', async () => {
      const provider = new FsProvider();
      provider.readOnly = { registry: registryAccess, types: [registryAccess.getTypeByName('ApexClass')] };

      await expect(provider.delete(clsUri(), { recursive: false })).rejects.toMatchObject({
        code: 'NoPermissions'
      });
      expect(registryAccess.getTypeBySuffix).toHaveBeenCalledTimes(1);
    });

    it('rename rejects a read-only metadata type via the shared runtime', async () => {
      const provider = new FsProvider();
      provider.readOnly = { registry: registryAccess, types: [registryAccess.getTypeByName('ApexClass')] };

      await expect(
        provider.rename(clsUri(), URI.file(`${workspaceDir}/Renamed.cls`), { overwrite: true })
      ).rejects.toMatchObject({ code: 'NoPermissions' });
      expect(registryAccess.getTypeBySuffix).toHaveBeenCalledTimes(1);
    });

    it('does not mark a non-metadata suffix Readonly', async () => {
      const provider = new FsProvider();
      provider.readOnly = { registry: registryAccess, types: [registryAccess.getTypeByName('ApexClass')] };

      const stat = await provider.stat(txtUri());

      expect(stat.permissions).toBeUndefined();
    });

    it('does not mark anything Readonly when readOnly is empty (short-circuit)', async () => {
      const provider = new FsProvider();

      const stat = await provider.stat(clsUri());

      expect(stat.permissions).toBeUndefined();
      expect(registryAccess.getTypeBySuffix).not.toHaveBeenCalled();
    });
  });

  describe('runtime not published', () => {
    it('still enforces read-only using the captured registry', async () => {
      const provider = new FsProvider();
      provider.readOnly = { registry: registryAccess, types: [registryAccess.getTypeByName('ApexClass')] };

      const stat = await provider.stat(clsUri());

      expect(stat.permissions).toBe(vscode.FilePermission.Readonly);
    });
  });

  describe('file change events', () => {
    it('emits Created when writeFile creates a file', async () => {
      const provider = new FsProvider();
      const listener = vi.fn();
      provider.onDidChangeFile(listener);
      const uri = URI.file(`${workspaceDir}/created.txt`);

      await provider.writeFile(uri, new TextEncoder().encode('new'), { create: true, overwrite: true });

      expect(listener).toHaveBeenCalledWith([{ type: vscode.FileChangeType.Created, uri }]);
    });

    it('emits Changed when writeFile overwrites a file', async () => {
      const provider = new FsProvider();
      const listener = vi.fn();
      provider.onDidChangeFile(listener);
      const uri = txtUri();

      await provider.writeFile(uri, new TextEncoder().encode('updated'), { create: true, overwrite: true });

      expect(listener).toHaveBeenCalledWith([{ type: vscode.FileChangeType.Changed, uri }]);
    });
  });
});
