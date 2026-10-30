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
import { URI, Utils } from 'vscode-uri';
import { FsServiceLayer } from '../../src/fsService.js';
import {
  OrgMetadataShadowStore,
  OrgMetadataShadowStoreLayer,
  isOrgMetadataShadowUri
} from '../../src/orgCatalog/orgMetadataShadowStore.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';
import { WorkspaceServiceLayer } from '../../src/workspaceService.js';
import { installVscodeFs } from '../support/vscodeFs.js';

const originalFs = coreFs.fs;
const directories: string[] = [];
const orgId = Schema.decodeUnknownSync(OrgId)('00D000000000001');
const reference = { xmlName: 'ApexClass', fullName: 'Example' };
const graph = OrgMetadataShadowStoreLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(FsServiceLayer, WorkspaceServiceLayer)),
  Layer.provide(Layer.succeed(WebFileSystemProvider, { get: () => undefined }))
);
const setup = async (backend: 'node' | 'memfs') => {
  vi.stubEnv('FORCE_MEMFS', backend === 'memfs' ? 'true' : 'false');
  vi.stubEnv('ESBUILD_PLATFORM', backend === 'memfs' ? 'web' : 'node');
  coreFs.setFs(coreFs.getVirtualFs());
  installVscodeFs(coreFs.fs.promises as typeof FsPromises);
  const directory =
    backend === 'node' ? await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'sf-v4-shadow-')) : '/v4-shadow';
  if (backend === 'node') directories.push(directory);
  else await coreFs.fs.promises.mkdir(directory, { recursive: true });
  const uri = backend === 'node' ? URI.file(directory) : URI.parse(`memfs:${directory}`);
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri, name: 'shadow', index: 0 }]
  });
  Object.defineProperty(vscode.workspace, 'textDocuments', { configurable: true, value: [] });
  return { runtime: ManagedRuntime.make(graph), uri };
};
const stage = async (store: OrgMetadataShadowStore['Service'], revision: string, content = revision) => {
  const prepared = await Effect.runPromise(store.prepare(orgId, reference, revision));
  const primaryUri = Utils.joinPath(prepared.stagingUri, 'classes', 'Example.cls');
  await vscode.workspace.fs.createDirectory(Utils.dirname(primaryUri));
  await vscode.workspace.fs.writeFile(primaryUri, new TextEncoder().encode(content));
  return {
    orgId,
    reference,
    stagingUri: prepared.stagingUri,
    primaryUri,
    fileUris: [primaryUri],
    remoteLastModifiedDate: revision
  };
};
afterEach(async () => {
  vi.restoreAllMocks();
  coreFs.setFs(originalFs);
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

it.each(['node', 'memfs'] as const)(
  'publishes actual %s files out of SDR-compatible staging, with isolated concurrent staging paths',
  async backend => {
    const { runtime, uri } = await setup(backend);
    try {
      const store = await runtime.runPromise(OrgMetadataShadowStore);
      const [first, second] = await Promise.all([stage(store, '1'), stage(store, '1')]);
      expect(first.stagingUri.toString()).not.toBe(second.stagingUri.toString());
      expect(isOrgMetadataShadowUri(uri, first.stagingUri)).toBe(true);
      const published = await runtime.runPromise(store.publish(first));
      expect(published?.primaryUri.path).toContain(
        '/metadata-shadow/ApexClass/Example/revisions/1/classes/Example.cls'
      );
      const restored = await runtime.runPromise(store.get(orgId, reference, '1'));
      expect(restored?.rootUri.toString()).toBe(published?.rootUri.toString());
      expect(restored?.primaryUri.toString()).toBe(published?.primaryUri.toString());
      expect(restored?.fileUris.map(file => file.toString())).toEqual(published?.fileUris.map(file => file.toString()));
      expect(restored?.materializedAt).toBe(published?.materializedAt);
      expect(await runtime.runPromise(store.get(orgId, reference, '2'))).toBeUndefined();
      expect(
        await runtime.runPromise(store.get(Schema.decodeUnknownSync(OrgId)('00D000000000002'), reference, '1'))
      ).toBeUndefined();
      expect(new TextDecoder().decode(await vscode.workspace.fs.readFile(published!.primaryUri))).toBe('1');
      await expect(vscode.workspace.fs.stat(first.stagingUri)).rejects.toBeDefined();
    } finally {
      await runtime.dispose();
    }
  }
);

it('retains three newest revisions plus any revision with an open document', async () => {
  const { runtime } = await setup('memfs');
  try {
    const store = await runtime.runPromise(OrgMetadataShadowStore);
    const first = await runtime.runPromise(store.publish(await stage(store, '1')));
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      configurable: true,
      value: [{ uri: first!.primaryUri }]
    });
    for (const revision of ['2', '3', '4', '5']) await runtime.runPromise(store.publish(await stage(store, revision)));
    expect(await runtime.runPromise(store.get(orgId, reference, '1'))).toBeDefined();
    expect(await runtime.runPromise(store.get(orgId, reference, '2'))).toBeUndefined();
    expect(await runtime.runPromise(store.get(orgId, reference, '3'))).toBeDefined();
    Object.defineProperty(vscode.workspace, 'textDocuments', { configurable: true, value: [] });
    await runtime.runPromise(store.publish(await stage(store, '6')));
    expect(await runtime.runPromise(store.get(orgId, reference, '1'))).toBeUndefined();
    expect(await runtime.runPromise(store.get(orgId, reference, '3'))).toBeUndefined();
  } finally {
    await runtime.dispose();
  }
});

it('restores an existing revision after failed replacement and rejects files outside staging', async () => {
  const { runtime } = await setup('memfs');
  try {
    const store = await runtime.runPromise(OrgMetadataShadowStore);
    const first = await runtime.runPromise(store.publish(await stage(store, '1', 'before')));
    const second = await stage(store, '1', 'after');
    const fs = coreFs.fs.promises as typeof FsPromises;
    vi.mocked(vscode.workspace.fs.rename)
      .mockImplementationOnce((source, target) => fs.rename(source.path, target.path))
      .mockRejectedValueOnce(new Error('blocked replacement'));
    expect(await runtime.runPromise(store.publish(second).pipe(Effect.flip))).toMatchObject({ _tag: 'FsServiceError' });
    expect(new TextDecoder().decode(await vscode.workspace.fs.readFile(first!.primaryUri))).toBe('before');
    expect(
      await runtime.runPromise(
        store.publish({ ...second, primaryUri: URI.parse('memfs:/outside.cls') }).pipe(Effect.flip)
      )
    ).toMatchObject({ _tag: 'OrgMetadataCatalogError' });
    expect(
      await runtime.runPromise(
        store
          .publish({ ...second, primaryUri: second.primaryUri.with({ scheme: 'https', authority: 'foreign.example' }) })
          .pipe(Effect.flip)
      )
    ).toMatchObject({ _tag: 'OrgMetadataCatalogError' });
    expect(
      await runtime.runPromise(
        store
          .publish({ ...second, fileUris: [second.primaryUri.with({ authority: 'foreign.example' })] })
          .pipe(Effect.flip)
      )
    ).toMatchObject({ _tag: 'OrgMetadataCatalogError' });
    const restored = await runtime.runPromise(store.get(orgId, reference, '1'));
    expect(restored?.primaryUri.toString()).toBe(first?.primaryUri.toString());
    expect(restored?.materializedAt).toBe(first?.materializedAt);
  } finally {
    await runtime.dispose();
  }
});

it('retains the previous complete revision when staged primary output is missing', async () => {
  const { runtime } = await setup('memfs');
  try {
    const store = await runtime.runPromise(OrgMetadataShadowStore);
    const before = await runtime.runPromise(store.publish(await stage(store, '1', 'before')));
    const incomplete = await stage(store, '1', 'incomplete');
    await vscode.workspace.fs.delete(incomplete.primaryUri);
    expect(await runtime.runPromise(store.publish(incomplete).pipe(Effect.flip))).toMatchObject({
      _tag: 'FsServiceError'
    });
    const restored = await runtime.runPromise(store.get(orgId, reference, '1'));
    expect(restored?.materializedAt).toBe(before?.materializedAt);
    expect(new TextDecoder().decode(await vscode.workspace.fs.readFile(restored!.primaryUri))).toBe('before');
  } finally {
    await runtime.dispose();
  }
});

it('does not let an undeletable obsolete backup block subsequent complete replacements', async () => {
  const { runtime } = await setup('memfs');
  try {
    const store = await runtime.runPromise(OrgMetadataShadowStore);
    await runtime.runPromise(store.publish(await stage(store, '1', 'first')));
    const fs = coreFs.fs.promises as typeof FsPromises;
    let blockBackupDelete = true;
    vi.spyOn(vscode.workspace.fs, 'delete').mockImplementation(async (uri, options) => {
      if (uri.path.endsWith('.__backup__') && blockBackupDelete) throw new Error('temporary backup lock');
      await fs.rm(uri.path, { recursive: options?.recursive ?? false });
    });
    await runtime.runPromise(store.publish(await stage(store, '1', 'second')));
    blockBackupDelete = false;
    await runtime.runPromise(store.publish(await stage(store, '1', 'third')));
    const latest = await runtime.runPromise(store.get(orgId, reference, '1'));
    expect(new TextDecoder().decode(await vscode.workspace.fs.readFile(latest!.primaryUri))).toBe('third');
  } finally {
    await runtime.dispose();
  }
});

it('does not reuse abandoned component or batch staging directories after a new owner starts', async () => {
  const { runtime } = await setup('memfs');
  const store = await runtime.runPromise(OrgMetadataShadowStore);
  const oldComponent = await stage(store, '1', 'abandoned');
  const oldBatch = await runtime.runPromise(store.prepareBatch(orgId));
  await runtime.dispose();
  const next = ManagedRuntime.make(graph);
  try {
    const fresh = await next.runPromise(OrgMetadataShadowStore);
    expect((await next.runPromise(fresh.prepare(orgId, reference, '1'))).stagingUri.toString()).not.toBe(
      oldComponent.stagingUri.toString()
    );
    expect((await next.runPromise(fresh.prepareBatch(orgId))).toString()).not.toBe(oldBatch.toString());
    expect(new TextDecoder().decode(await vscode.workspace.fs.readFile(oldComponent.primaryUri))).toBe('abandoned');
  } finally {
    await next.dispose();
  }
});

it('drains an external publication through native rename and rejects retained calls after disposal', async () => {
  const { runtime } = await setup('memfs');
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    const store = await runtime.runPromise(OrgMetadataShadowStore);
    const prepared = await stage(store, '1');
    const fs = coreFs.fs.promises as typeof FsPromises;
    vi.mocked(vscode.workspace.fs.rename).mockImplementationOnce(async (source, target) => {
      entered.resolve();
      await release.promise;
      await fs.rename(source.path, target.path);
    });
    const publishing = Effect.runPromiseExit(store.publish(prepared));
    await entered.promise;
    const closed = vi.fn<() => void>();
    const disposing = runtime.dispose().then(closed);
    await Promise.resolve();
    expect(closed).not.toHaveBeenCalled();
    release.resolve();
    await disposing;
    await publishing;
    expect(Exit.isFailure(await Effect.runPromiseExit(store.get(orgId, reference, '1')))).toBe(true);
    expect(Exit.isFailure(await Effect.runPromiseExit(store.prepare(orgId, reference, '2')))).toBe(true);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it.each(['cancel', 'dispose'] as const)(
  'settles native revision pruning before %s releases publication ownership',
  async action => {
    const { runtime } = await setup('memfs');
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    try {
      const store = await runtime.runPromise(OrgMetadataShadowStore);
      for (const revision of ['1', '2', '3']) await runtime.runPromise(store.publish(await stage(store, revision)));
      const fs = coreFs.fs.promises as typeof FsPromises;
      vi.spyOn(vscode.workspace.fs, 'delete').mockImplementation(async (uri, options) => {
        if (uri.path.endsWith('/revisions/1')) {
          entered.resolve();
          await release.promise;
        }
        await fs.rm(uri.path, { recursive: options?.recursive ?? false });
      });
      const publishing = Effect.runFork(store.publish(await stage(store, '4')));
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
          ? Effect.runPromise(store.publish(await stage(store, '1', 'replacement'))).then(replaced)
          : undefined;
      await Effect.runPromise(Effect.yieldNow);
      expect(replaced).not.toHaveBeenCalled();
      release.resolve();
      await stopping;
      await replacing;
      if (action === 'cancel') {
        const latest = await runtime.runPromise(store.get(orgId, reference, '1'));
        expect(new TextDecoder().decode(await vscode.workspace.fs.readFile(latest!.primaryUri))).toBe('replacement');
      }
    } finally {
      release.resolve();
      await runtime.dispose();
    }
  }
);
