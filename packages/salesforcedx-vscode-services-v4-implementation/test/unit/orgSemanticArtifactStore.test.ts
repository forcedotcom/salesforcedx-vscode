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
  OrgSemanticArtifactPersistence,
  OrgSemanticArtifactPersistenceLayer
} from '../../src/orgCatalog/orgSemanticArtifactPersistence.js';
import {
  OrgSemanticArtifactStore,
  OrgSemanticArtifactStoreLayer,
  type SemanticArtifactStoreKey
} from '../../src/orgCatalog/orgSemanticArtifactStore.js';
import { TransmogrifierServiceLayer } from '../../src/transmogrifierService.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';
import { WorkspaceServiceLayer } from '../../src/workspaceService.js';
import { installVscodeFs } from '../support/vscodeFs.js';

const originalFs = coreFs.fs;
const directories: string[] = [];
const a = Schema.decodeUnknownSync(OrgId)('00D000000000001');
const b = Schema.decodeUnknownSync(OrgId)('00D000000000002');
const key: SemanticArtifactStoreKey = {
  orgId: a,
  identity: { kind: 'sobject', namespace: null, name: 'Account' },
  provider: 'rest-api',
  projection: { kind: 'semantic-model', model: 'sobject' },
  capabilityVersion: '68.0',
  revision: null
};
const graph = OrgSemanticArtifactPersistenceLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(OrgSemanticArtifactStoreLayer, TransmogrifierServiceLayer)),
  Layer.provideMerge(Layer.mergeAll(FsServiceLayer, WorkspaceServiceLayer)),
  Layer.provide(Layer.succeed(WebFileSystemProvider, { get: () => undefined }))
);
const setup = async (backend: 'node' | 'memfs') => {
  vi.stubEnv('FORCE_MEMFS', backend === 'memfs' ? 'true' : 'false');
  vi.stubEnv('ESBUILD_PLATFORM', backend === 'memfs' ? 'web' : 'node');
  coreFs.setFs(coreFs.getVirtualFs());
  installVscodeFs(coreFs.fs.promises as typeof FsPromises);
  const directory =
    backend === 'node' ? await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'sf-v4-semantic-')) : '/v4-semantic';
  if (backend === 'node') directories.push(directory);
  else await coreFs.fs.promises.mkdir(directory, { recursive: true });
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [
      {
        uri: backend === 'node' ? URI.file(directory) : URI.parse(`memfs:${directory}`),
        name: 'semantic',
        index: 0
      }
    ]
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
  'isolates real %s artifacts by org, namespace, capability, revision; casing shares identity',
  async backend => {
    const runtime = await setup(backend);
    try {
      const store = await runtime.runPromise(OrgSemanticArtifactStore);
      expect(await runtime.runPromise(store.load(key))).toBeUndefined();
      const stored = await runtime.runPromise(store.save(key, { fact: 'global' }));
      const canonicalized = { ...key, identity: { ...key.identity, name: 'ACCOUNT' } };
      expect((await runtime.runPromise(store.load(canonicalized)))?.value).toEqual({ fact: 'global' });
      const otherKeys = [
        { ...key, orgId: b },
        { ...key, identity: { ...key.identity, namespace: 'pkg' } },
        { ...key, capabilityVersion: '69.0' },
        { ...key, revision: 'revision/1' }
      ];
      for (const other of otherKeys) {
        expect(await runtime.runPromise(store.load(other))).toBeUndefined();
        await runtime.runPromise(store.save(other, { fact: 'other' }));
      }
      expect((await runtime.runPromise(store.load(key)))?.value).toEqual({ fact: 'global' });
      await vscode.workspace.fs.writeFile(
        stored.uri,
        new TextEncoder().encode(
          JSON.stringify({ version: 1, key: { ...key, orgId: b }, writtenAt: stored.writtenAt, value: {} })
        )
      );
      expect(await runtime.runPromise(store.load(key).pipe(Effect.flip))).toMatchObject({
        _tag: 'SemanticArtifactStoreKeyMismatchError'
      });
    } finally {
      await runtime.dispose();
    }
  }
);

it('keeps three revisions; failed replacement retains old bytes and cleans staging; serialization is typed', async () => {
  const runtime = await setup('memfs');
  try {
    const store = await runtime.runPromise(OrgSemanticArtifactStore);
    for (const revision of ['1', '2', '3', '4']) await runtime.runPromise(store.save({ ...key, revision }, revision));
    expect(await runtime.runPromise(store.load({ ...key, revision: '1' }))).toBeUndefined();
    expect((await runtime.runPromise(store.load({ ...key, revision: '2' })))?.value).toBe('2');
    const uri = (await runtime.runPromise(store.save(key, 'before'))).uri;
    vi.mocked(vscode.workspace.fs.rename).mockRejectedValueOnce(new Error('rename blocked'));
    expect(await runtime.runPromise(store.save(key, 'after').pipe(Effect.flip))).toMatchObject({
      _tag: 'FsServiceError'
    });
    expect((await runtime.runPromise(store.load(key)))?.value).toBe('before');
    await expect(vscode.workspace.fs.stat(URI.parse(`${uri.toString()}.__staging__`))).rejects.toBeDefined();
    expect(await runtime.runPromise(store.save(key, { big: 1n }).pipe(Effect.flip))).toMatchObject({
      _tag: 'SemanticArtifactSerializationError'
    });
  } finally {
    await runtime.dispose();
  }
});

it('hydrates canonical semantic payloads and rejects semantic identity not matching its manifest', async () => {
  const runtime = await setup('memfs');
  try {
    const store = await runtime.runPromise(OrgSemanticArtifactStore);
    const persistence = await runtime.runPromise(OrgSemanticArtifactPersistence);
    await runtime.runPromise(
      store.save(key, { kind: 'sobject', value: { identity: key.identity, fields: [], custom: false } })
    );
    expect((await runtime.runPromise(persistence.hydrate(key)))?.value.identity).toEqual(key.identity);
    await runtime.runPromise(
      store.save(key, { kind: 'sobject', value: { identity: { ...key.identity, namespace: 'pkg' }, fields: [] } })
    );
    expect(await runtime.runPromise(persistence.hydrate(key).pipe(Effect.flip))).toMatchObject({
      _tag: 'TransmogrifierError'
    });
  } finally {
    await runtime.dispose();
  }
});

it('awaits external native publication on disposal and rejects retained store calls', async () => {
  const runtime = await setup('memfs');
  const writeFile = vi.spyOn(vscode.workspace.fs, 'writeFile');
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    const store = await runtime.runPromise(OrgSemanticArtifactStore);
    const fs = coreFs.fs.promises as typeof FsPromises;
    vi.mocked(vscode.workspace.fs.rename).mockImplementationOnce(async (source, target) => {
      entered.resolve();
      await release.promise;
      await fs.rename(source.path, target.path);
    });
    const saving = Effect.runPromiseExit(store.save(key, 'accepted'));
    await entered.promise;
    const closed = vi.fn<() => void>();
    const disposing = runtime.dispose().then(closed);
    await Promise.resolve();
    expect(closed).not.toHaveBeenCalled();
    release.resolve();
    await disposing;
    await saving;
    const writes = writeFile.mock.calls.length;
    expect(Exit.isFailure(await Effect.runPromiseExit(store.save(key, 'late')))).toBe(true);
    expect(Exit.isFailure(await Effect.runPromiseExit(store.load(key)))).toBe(true);
    expect(writeFile).toHaveBeenCalledTimes(writes);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('keeps dot-segment namespace/name keys in separate durable partitions', async () => {
  const runtime = await setup('memfs');
  try {
    const store = await runtime.runPromise(OrgSemanticArtifactStore);
    const first = { ...key, identity: { ...key.identity, namespace: 'pkg', name: '..' } };
    const second = { ...key, identity: { ...key.identity, namespace: '.', name: '.' } };
    expect((await runtime.runPromise(store.save(first, 'first'))).uri.toString()).not.toBe(
      (await runtime.runPromise(store.save(second, 'second'))).uri.toString()
    );
    expect((await runtime.runPromise(store.load(first)))?.value).toBe('first');
    expect((await runtime.runPromise(store.load(second)))?.value).toBe('second');
  } finally {
    await runtime.dispose();
  }
});

it.each(['cancel', 'dispose'] as const)(
  'settles native pruning before %s releases publication ownership',
  async action => {
    const runtime = await setup('memfs');
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    try {
      const store = await runtime.runPromise(OrgSemanticArtifactStore);
      for (const revision of ['1', '2', '3']) await runtime.runPromise(store.save({ ...key, revision }, revision));
      const fs = coreFs.fs.promises as typeof FsPromises;
      vi.spyOn(vscode.workspace.fs, 'delete').mockImplementation(async (uri, options) => {
        if (uri.path.endsWith('revision-1.json')) {
          entered.resolve();
          await release.promise;
        }
        await fs.rm(uri.path, { recursive: options?.recursive ?? false });
      });
      const publishing = Effect.runFork(store.save({ ...key, revision: '4' }, 'fourth'));
      await entered.promise;
      const stopped = vi.fn<() => void>();
      const stopping = (action === 'cancel' ? Effect.runPromise(Fiber.interrupt(publishing)) : runtime.dispose()).then(
        stopped
      );
      await Effect.runPromise(Effect.yieldNow);
      expect(stopped).not.toHaveBeenCalled();
      const replaced = vi.fn<() => void>();
      const replacing =
        action === 'cancel'
          ? Effect.runPromise(store.save({ ...key, revision: '1' }, 'replacement')).then(replaced)
          : undefined;
      await Effect.runPromise(Effect.yieldNow);
      expect(replaced).not.toHaveBeenCalled();
      release.resolve();
      await stopping;
      await replacing;
      if (action === 'cancel')
        expect((await runtime.runPromise(store.load({ ...key, revision: '1' })))?.value).toBe('replacement');
    } finally {
      release.resolve();
      await runtime.dispose();
    }
  }
);
