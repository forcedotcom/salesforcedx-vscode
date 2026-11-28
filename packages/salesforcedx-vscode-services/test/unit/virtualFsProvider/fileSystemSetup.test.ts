/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fs, resetFs, setFs } from '@salesforce/core/fs';
import { ChannelService, MetadataRegistryService, GetRegistryAccessError } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { createFsFromVolume, Volume } from 'memfs';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { MetadataRegistryServiceLayer } from '../../../src/services/metadataRegistryService';
import { SettingsServiceLayer } from '../../../src/services/settingsService';
import { WorkspaceServiceLayer } from '../../../src/services/workspaceService';
import { WebFileSystemProvider } from '../../../src/services/webFileSystemProvider';
import { isServicesRuntimeReady } from '../../../src/servicesRuntime';
import { fileSystemSetup } from '../../../src/virtualFsProvider/fileSystemSetup';
import { fsProviderRef } from '../../../src/virtualFsProvider/fsProviderRef';
import { IndexedDBStorageService } from '../../../src/virtualFsProvider/indexedDbStorage';
import { VirtualFsProviderError } from '../../../src/virtualFsProvider/virtualFsProviderError';
import type * as MemfsWatcher from '../../../src/virtualFsProvider/memfsWatcher';
import { setImmediate } from 'node:timers/promises';
import assert from 'node:assert/strict';
import * as projectInit from '../../../src/virtualFsProvider/projectInit';

const events: string[] = [];
let folders: readonly vscode.WorkspaceFolder[] | undefined;
let protectedOrg = false;
const loadState = vi.fn<IndexedDBStorageService['Service']['loadState']>();
vi.mock('../../../src/virtualFsProvider/memfsWatcher', async importOriginal => ({
  ...(await importOriginal<typeof MemfsWatcher>()),
  startWatch: () =>
    Effect.sync(() => {
      events.push('watch');
    }).pipe(
      Effect.andThen(
        Effect.addFinalizer(() =>
          Effect.sync(() => {
            events.push('stop-watch');
          })
        )
      )
    )
}));

beforeEach(() => {
  events.length = 0;
  folders = undefined;
  protectedOrg = false;
  setFs(
    createFsFromVolume(
      Volume.fromJSON({
        '/dx-project': null,
        '/host-project/sfdx-project.json': '{"packageDirectories":[{"path":"force-app"}]}',
        '/host-project/Existing.cls': 'public class Existing {}'
      })
    ) as unknown as typeof fs
  );
  Object.defineProperty(vscode.workspace, 'workspaceFolders', { configurable: true, get: () => folders });
  vi.mocked(vscode.workspace.registerFileSystemProvider).mockImplementation(() => {
    events.push('register');
    return {
      dispose: () => {
        events.push('unregister');
      }
    };
  });
  vi.mocked(vscode.workspace.updateWorkspaceFolders).mockImplementation((_start, _deleteCount, ...next) => {
    events.push('folder');
    folders = next.map(({ uri }, index) => ({ uri, index, name: 'project' }));
    return true;
  });
  vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
    get: (key: string) => (key === 'protectedOrg' ? protectedOrg : undefined)
  } as vscode.WorkspaceConfiguration);
  loadState.mockImplementation(() =>
    Effect.sync(() => {
      events.push('load');
      return [];
    })
  );
});
afterEach(() => {
  resetFs();
  vi.restoreAllMocks();
});

const makeLayer = (getRegistryAccess?: MetadataRegistryService['Service']['getRegistryAccess']) => {
  const registry = (
    getRegistryAccess ? Layer.mock(MetadataRegistryService, { getRegistryAccess }) : MetadataRegistryServiceLayer
  ).pipe(Layer.provideMerge(WorkspaceServiceLayer));
  return Layer.effect(
    WebFileSystemProvider,
    fileSystemSetup().pipe(Effect.map(provider => ({ get: () => provider })))
  ).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        registry,
        SettingsServiceLayer,
        Layer.mock(ChannelService, {}),
        Layer.mock(IndexedDBStorageService, { loadState })
      )
    )
  );
};
const makeRuntime = (...args: Parameters<typeof makeLayer>) => ManagedRuntime.make(makeLayer(...args));

it.each([false, true])('loads before registration and preserves existing workspace selection: %s', async existing => {
  if (existing) folders = [{ uri: URI.parse('memfs:/host-project'), name: 'host-project', index: 0 }];
  const runtime = makeRuntime();
  try {
    const provider = await runtime.runPromise(WebFileSystemProvider);
    expect(provider.get()).toBe(fsProviderRef.current);
    expect(events).toEqual(existing ? ['load', 'register', 'watch'] : ['load', 'register', 'folder', 'watch']);
    expect(vscode.workspace.updateWorkspaceFolders).toHaveBeenCalledTimes(existing ? 0 : 1);
    expect(folders?.[0]?.uri.toString()).toBe(existing ? 'memfs:/host-project' : 'memfs:/dx-project');
    expect(isServicesRuntimeReady()).toBe(false);
    await runtime.dispose();
    expect(events.slice(-2)).toEqual(['stop-watch', 'unregister']);
    expect(fsProviderRef.current).toBeUndefined();
  } finally {
    await runtime.dispose();
  }
});

it('enforces protected Apex through the exact registry acquired by bootstrap before runtime publication', async () => {
  folders = [{ uri: URI.parse('memfs:/host-project'), name: 'host-project', index: 0 }];
  protectedOrg = true;
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(WebFileSystemProvider);
    const registry = await runtime.runPromise(MetadataRegistryService.use(service => service.getRegistryAccess()));
    expect(fsProviderRef.current?.readOnly?.registry).toBe(registry);
    expect(isServicesRuntimeReady()).toBe(false);
    expect((await fsProviderRef.current?.stat(URI.parse('memfs:/host-project/Existing.cls')))?.permissions).toBe(
      vscode.FilePermission.Readonly
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:protectedOrg', true);
  } finally {
    await runtime.dispose();
  }
});

it('does not register a provider or watcher when persistence load fails', async () => {
  loadState.mockReturnValue(Effect.fail(new VirtualFsProviderError({ message: 'load failed' })));
  const runtime = makeRuntime();
  try {
    expect((await runtime.runPromiseExit(WebFileSystemProvider))._tag).toBe('Failure');
    expect(vscode.workspace.registerFileSystemProvider).not.toHaveBeenCalled();
    expect(events).not.toContain('watch');
    expect(fsProviderRef.current).toBeUndefined();
  } finally {
    await runtime.dispose();
  }
});

it('holds registered host writes until protection resolves, then rejects protected Apex writes', async () => {
  folders = [{ uri: URI.parse('memfs:/host-project'), name: 'host-project', index: 0 }];
  protectedOrg = true;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  vi.mocked(vscode.commands.executeCommand).mockImplementationOnce(() => {
    entered.resolve();
    return release.promise;
  });
  const runtime = makeRuntime();
  const initializing = runtime.runPromise(WebFileSystemProvider);
  await entered.promise;
  const provider = vi.mocked(vscode.workspace.registerFileSystemProvider).mock.calls[0]?.[1];
  assert(provider);
  let completed = false;
  const writing = Promise.resolve(
    provider.writeFile(URI.parse('memfs:/host-project/Existing.cls'), new TextEncoder().encode('replaced'), {
      create: false,
      overwrite: true
    })
  ).then(
    () => {
      completed = true;
      return undefined;
    },
    (error: unknown) => {
      completed = true;
      return error;
    }
  );
  await setImmediate();
  expect(completed).toBe(false);
  expect(String(fs.readFileSync('/host-project/Existing.cls'))).toBe('public class Existing {}');
  release.resolve();
  try {
    await initializing;
    expect(await writing).toMatchObject({ code: 'NoPermissions' });
    await runtime.dispose();
    await expect(
      Promise.resolve(
        provider.writeFile(URI.parse('memfs:/host-project/plain.txt'), new Uint8Array(), {
          create: true,
          overwrite: true
        })
      )
    ).rejects.toMatchObject({ code: 'Unavailable' });
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('unregisters the provider, stops persistence and rejects queued host writes after protection lookup fails', async () => {
  folders = [{ uri: URI.parse('memfs:/host-project'), name: 'host-project', index: 0 }];
  protectedOrg = true;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const layer = makeLayer(() =>
    Effect.promise(() => {
      entered.resolve();
      return release.promise;
    }).pipe(
      Effect.andThen(new GetRegistryAccessError({ message: 'registry failed', cause: new Error('registry failed') }))
    )
  );
  const initializing = Effect.runPromiseExit(Layer.build(layer).pipe(Effect.scoped));
  await entered.promise;
  const provider = vi.mocked(vscode.workspace.registerFileSystemProvider).mock.calls[0]?.[1];
  assert(provider);
  const writing = Promise.resolve(
    provider.writeFile(URI.parse('memfs:/host-project/Existing.cls'), new Uint8Array(), {
      create: false,
      overwrite: true
    })
  ).then(
    () => undefined,
    (error: unknown) => error
  );
  release.resolve();
  try {
    expect((await initializing)._tag).toBe('Failure');
    expect(await writing).toMatchObject({ code: 'Unavailable' });
    expect(events.slice(-2)).toEqual(['stop-watch', 'unregister']);
    expect(fsProviderRef.current).toBeUndefined();
  } finally {
    release.resolve();
  }
});

it('cleans up registration, persistence and provider reference when cancelled while waiting for workspace folders', async () => {
  vi.mocked(vscode.workspace.updateWorkspaceFolders).mockReturnValue(true);
  const initialized = Promise.withResolvers<void>();
  const originalProjectFiles = projectInit.projectFiles;
  vi.spyOn(projectInit, 'projectFiles').mockImplementationOnce(provider =>
    originalProjectFiles(provider).pipe(Effect.tap(() => Effect.sync(() => initialized.resolve())))
  );
  const controller = new AbortController();
  const starting = Effect.runPromiseExit(Layer.build(makeLayer()).pipe(Effect.scoped), { signal: controller.signal });
  await initialized.promise;
  await setImmediate();
  expect(folders).toBeUndefined();
  expect(events).toContain('register');
  expect(events).toContain('watch');
  controller.abort();
  try {
    const exit = await starting;
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') expect(exit.cause.reasons.some(reason => reason._tag === 'Interrupt')).toBe(true);
    expect(events.slice(-2)).toEqual(['stop-watch', 'unregister']);
    expect(fsProviderRef.current).toBeUndefined();
  } finally {
    controller.abort();
  }
});
