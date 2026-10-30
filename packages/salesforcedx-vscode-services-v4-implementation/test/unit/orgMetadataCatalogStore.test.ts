/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import coreFs from '@salesforce/core/fs';
import { OrgId } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import type * as FsPromises from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { FsServiceLayer } from '../../src/fsService.js';
import {
  OrgMetadataCatalogStore,
  OrgMetadataCatalogStoreLayer,
  type OrgMetadataCatalogSnapshot
} from '../../src/orgCatalog/orgMetadataCatalogStore.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';
import { WorkspaceServiceLayer } from '../../src/workspaceService.js';
import { installVscodeFs } from '../support/vscodeFs.js';

const originalFs = coreFs.fs;
const directories: string[] = [];
const a = Schema.decodeUnknownSync(OrgId)('00D000000000001');
const b = Schema.decodeUnknownSync(OrgId)('00D000000000002');
const snapshot = (orgId = a, generation = 1): OrgMetadataCatalogSnapshot => ({
  version: 2,
  orgId,
  writtenAt: '2026-10-30T00:00:00.000Z',
  generation,
  inventory: [],
  sobjects: { descriptions: [] },
  tracking: [],
  metadataTypes: [],
  metadataListings: []
});
const graph = OrgMetadataCatalogStoreLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(FsServiceLayer, WorkspaceServiceLayer)),
  Layer.provide(Layer.succeed(WebFileSystemProvider, { get: () => undefined }))
);
const setup = async (backend: 'node' | 'memfs') => {
  vi.stubEnv('FORCE_MEMFS', backend === 'memfs' ? 'true' : 'false');
  vi.stubEnv('ESBUILD_PLATFORM', backend === 'memfs' ? 'web' : 'node');
  coreFs.setFs(coreFs.getVirtualFs());
  // SDK VirtualFs erases the common Node/memfs promise signatures; these actual operations support both.
  installVscodeFs(coreFs.fs.promises as typeof FsPromises);
  const directory =
    backend === 'node'
      ? await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'sf-v4-catalog-'))
      : '/v4-catalog-memory';
  if (backend === 'node') directories.push(directory);
  else await coreFs.fs.promises.mkdir(directory, { recursive: true });
  const uri = backend === 'node' ? URI.file(directory) : URI.parse(`memfs:${directory}`);
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri, name: 'catalog', index: 0 }]
  });
  return ManagedRuntime.make(graph);
};
afterEach(async () => {
  vi.restoreAllMocks();
  coreFs.setFs(originalFs);
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

it.each(['node', 'memfs'] as const)(
  'round-trips actual %s snapshots and rejects another org in the requested partition',
  async backend => {
    const runtime = await setup(backend);
    try {
      const store = await runtime.runPromise(OrgMetadataCatalogStore);
      expect(await runtime.runPromise(store.load(a))).toBeUndefined();
      const uri = await runtime.runPromise(store.save(snapshot()));
      expect(await runtime.runPromise(store.load(a))).toEqual(snapshot());
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(snapshot(b))));
      expect(await runtime.runPromise(store.load(a).pipe(Effect.flip))).toMatchObject({
        _tag: 'OrgMetadataCatalogSnapshotOrgMismatchError'
      });
    } finally {
      await runtime.dispose();
    }
  }
);

it('migrates version1 snapshots without fabricating metadata type/listing observations', async () => {
  const runtime = await setup('memfs');
  try {
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    const uri = await runtime.runPromise(store.save(snapshot()));
    const { metadataTypes: _types, metadataListings: _listings, ...v1 } = snapshot();
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify({ ...v1, version: 1 })));
    expect(await runtime.runPromise(store.load(a))).toEqual(snapshot());
  } finally {
    await runtime.dispose();
  }
});

it('leaves the previous snapshot intact when atomic replacement fails and removes staging output', async () => {
  const runtime = await setup('memfs');
  try {
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    const uri = await runtime.runPromise(store.save(snapshot()));
    vi.mocked(vscode.workspace.fs.rename).mockRejectedValueOnce(new Error('rename blocked'));
    expect(await runtime.runPromise(store.save(snapshot(a, 2)).pipe(Effect.flip))).toMatchObject({
      _tag: 'FsServiceError'
    });
    expect((await runtime.runPromise(store.load(a)))?.generation).toBe(1);
    await expect(vscode.workspace.fs.stat(URI.parse(`${uri.toString()}.__staging__`))).rejects.toBeDefined();
  } finally {
    await runtime.dispose();
  }
});

it('settles an already-started native write/rename before cancellation releases it', async () => {
  const runtime = await setup('memfs');
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    await runtime.runPromise(store.save(snapshot()));
    const fs = coreFs.fs.promises as typeof FsPromises;
    vi.mocked(vscode.workspace.fs.rename).mockImplementationOnce(async (source, target) => {
      entered.resolve();
      await release.promise;
      await fs.rename(source.path, target.path);
    });
    const saving = Effect.runFork(store.save(snapshot(a, 2)));
    await entered.promise;
    const finished = vi.fn<() => void>();
    const cancelled = Effect.runPromise(Fiber.interrupt(saving)).then(finished);
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    release.resolve();
    await cancelled;
    expect((await runtime.runPromise(store.load(a)))?.generation).toBe(2);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('drains an external ordinary save before owner disposal and rejects retained store calls afterward', async () => {
  const runtime = await setup('memfs');
  const writeFile = vi.spyOn(vscode.workspace.fs, 'writeFile');
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const fs = coreFs.fs.promises as typeof FsPromises;
  vi.mocked(vscode.workspace.fs.rename).mockImplementationOnce(async (source, target) => {
    entered.resolve();
    await release.promise;
    await fs.rename(source.path, target.path);
  });
  try {
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    const saving = Effect.runPromiseExit(store.save(snapshot()));
    await entered.promise;
    const closed = vi.fn<() => void>();
    const disposing = runtime.dispose().then(closed);
    await Promise.resolve();
    expect(closed).not.toHaveBeenCalled();
    release.resolve();
    await disposing;
    await saving;
    const writes = writeFile.mock.calls.length;
    expect(Exit.isFailure(await Effect.runPromiseExit(store.save(snapshot(a, 2))))).toBe(true);
    expect(Exit.isFailure(await Effect.runPromiseExit(store.load(a)))).toBe(true);
    expect(writeFile).toHaveBeenCalledTimes(writes);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});
