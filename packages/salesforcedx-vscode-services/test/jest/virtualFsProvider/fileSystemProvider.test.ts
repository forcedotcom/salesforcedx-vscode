/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import type * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import * as servicesRuntime from '../../../src/servicesRuntime';
import { FsProvider, isItReadOnlyLayer } from '../../../src/virtualFsProvider/fileSystemProvider';

const vscode = require('vscode');

const registryAccess = new RegistryAccess();

describe('FsProvider read-only checks', () => {
  let workspaceDir: string;

  beforeAll(() => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fsp-'));
    fs.writeFileSync(path.join(workspaceDir, 'MyClass.cls'), 'public class MyClass {}');
    fs.writeFileSync(path.join(workspaceDir, 'foo.txt'), 'plain');
    vscode.workspace.workspaceFolders = [
      {
        uri: { scheme: 'file', fsPath: workspaceDir, toString: (): string => `file://${workspaceDir}` },
        name: 'ws',
        index: 0
      }
    ] as unknown as typeof vscode.workspace.workspaceFolders;
  });

  const clsUri = (): URI => URI.file(path.join(workspaceDir, 'MyClass.cls'));
  const txtUri = (): URI => URI.file(path.join(workspaceDir, 'foo.txt'));

  describe('runtime-ready (routed through shared runtime)', () => {
    let runtime: ManagedRuntime.ManagedRuntime<Layer.Layer.Success<typeof isItReadOnlyLayer>, never>;
    let getRuntimeSpy: jest.SpyInstance;

    beforeAll(() => {
      runtime = ManagedRuntime.make(isItReadOnlyLayer);
    });

    afterAll(async () => {
      await Effect.runPromise(runtime.disposeEffect);
    });

    // resetMocks wipes spies between tests, so re-arm each test. getRuntimeSpy proves the
    // runtime-ready branch actually consumed the shared runtime (mutating it away fails these).
    beforeEach(() => {
      jest.spyOn(servicesRuntime, 'isServicesRuntimeReady').mockReturnValue(true);
      getRuntimeSpy = jest
        .spyOn(servicesRuntime, 'getServicesRuntime')
        .mockReturnValue(Effect.succeed(runtime) as ReturnType<typeof servicesRuntime.getServicesRuntime>);
    });

    it('stat marks a read-only metadata type Readonly via the shared runtime', async () => {
      const provider = new FsProvider();
      provider.readOnly = [registryAccess.getTypeByName('ApexClass')];

      const stat = await provider.stat(clsUri());

      expect(stat.permissions).toBe(vscode.FilePermission.Readonly);
      expect(getRuntimeSpy).toHaveBeenCalled();
    });

    it('writeFile rejects a read-only metadata type via the shared runtime', async () => {
      const provider = new FsProvider();
      provider.readOnly = [registryAccess.getTypeByName('ApexClass')];

      await expect(
        provider.writeFile(clsUri(), new TextEncoder().encode('x'), { create: false, overwrite: true })
      ).rejects.toMatchObject({ code: 'NoPermissions' });
      expect(getRuntimeSpy).toHaveBeenCalled();
    });

    it('delete rejects a read-only metadata type via the shared runtime', async () => {
      const provider = new FsProvider();
      provider.readOnly = [registryAccess.getTypeByName('ApexClass')];

      await expect(provider.delete(clsUri(), { recursive: false })).rejects.toMatchObject({
        code: 'NoPermissions'
      });
      expect(getRuntimeSpy).toHaveBeenCalled();
    });

    it('rename rejects a read-only metadata type via the shared runtime', async () => {
      const provider = new FsProvider();
      provider.readOnly = [registryAccess.getTypeByName('ApexClass')];

      await expect(
        provider.rename(clsUri(), URI.file(path.join(workspaceDir, 'Renamed.cls')), { overwrite: true })
      ).rejects.toMatchObject({ code: 'NoPermissions' });
      expect(getRuntimeSpy).toHaveBeenCalled();
    });

    it('does not mark a non-metadata suffix Readonly', async () => {
      const provider = new FsProvider();
      provider.readOnly = [registryAccess.getTypeByName('ApexClass')];

      const stat = await provider.stat(txtUri());

      expect(stat.permissions).toBeUndefined();
    });

    it('does not mark anything Readonly when readOnly is empty (short-circuit)', async () => {
      const provider = new FsProvider();

      const stat = await provider.stat(clsUri());

      expect(stat.permissions).toBeUndefined();
      // empty readOnly short-circuits before the runtime is ever consulted
      expect(getRuntimeSpy).not.toHaveBeenCalled();
    });
  });

  describe('runtime not ready (fallback layer)', () => {
    // isServicesRuntimeReady() is false by default (no runtime published) → fallback branch
    it('still resolves read-only via the fallback layer', async () => {
      const provider = new FsProvider();
      provider.readOnly = [registryAccess.getTypeByName('ApexClass')];

      const stat = await provider.stat(clsUri());

      expect(stat.permissions).toBe(vscode.FilePermission.Readonly);
    });
  });
});
