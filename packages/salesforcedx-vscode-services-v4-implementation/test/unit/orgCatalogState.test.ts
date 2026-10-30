/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import coreFs from '@salesforce/core/fs';
import { FsServiceError, OrgId } from '@salesforce/vscode-services-v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import * as TestClock from 'effect/testing/TestClock';
import type * as FsPromises from 'node:fs/promises';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { FsServiceLayer } from '../../src/fsService.js';
import type { MetadataTypeObservation } from '../../src/orgCatalog/orgCatalogInternalTypes.js';
import { componentIdentity } from '../../src/orgCatalog/orgCatalogKeys.js';
import { OrgCatalogState, OrgCatalogStateLayer } from '../../src/orgCatalog/orgCatalogState.js';
import { OrgMetadataCatalogStore, OrgMetadataCatalogStoreLayer } from '../../src/orgCatalog/orgMetadataCatalogStore.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';
import { WorkspaceServiceLayer } from '../../src/workspaceService.js';
import { installVscodeFs } from '../support/vscodeFs.js';

const originalFs = coreFs.fs;
const orgId = Schema.decodeUnknownSync(OrgId)('00D000000000001');
const otherOrgId = Schema.decodeUnknownSync(OrgId)('00D000000000002');
const observation = (xmlName: string): MetadataTypeObservation => ({
  xmlName,
  directoryName: xmlName.toLowerCase(),
  inFolder: false,
  metaFile: true,
  childXmlNames: [],
  observedAt: '2026-10-30T00:00:00.000Z'
});
const storeGraph = OrgMetadataCatalogStoreLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(FsServiceLayer, WorkspaceServiceLayer)),
  Layer.provide(Layer.succeed(WebFileSystemProvider, { get: () => undefined }))
);
const graph = OrgCatalogStateLayer.pipe(Layer.provideMerge(storeGraph), Layer.provideMerge(TestClock.layer()));
beforeEach(async () => {
  vi.stubEnv('FORCE_MEMFS', 'true');
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  coreFs.setFs(coreFs.getVirtualFs());
  installVscodeFs(coreFs.fs.promises as typeof FsPromises);
  await coreFs.fs.promises.mkdir('/v4-state', { recursive: true });
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri: URI.parse('memfs:/v4-state'), name: 'state', index: 0 }]
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  coreFs.setFs(originalFs);
  vi.unstubAllEnvs();
});

it('flushes one change at the existing debounce deadline without needing a second queue message', async () => {
  const runtime = ManagedRuntime.make(graph);
  const saved = Promise.withResolvers<void>();
  const fs = coreFs.fs.promises as typeof FsPromises;
  vi.mocked(vscode.workspace.fs.rename).mockImplementation(async (source, target) => {
    await fs.rename(source.path, target.path);
    saved.resolve();
  });
  try {
    const state = await runtime.runPromise(OrgCatalogState);
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    await runtime.runPromise(state.setMetadataTypes(orgId, [observation('ApexClass')]));
    await runtime.runPromise(state.queuePersist(orgId));
    await runtime.runPromise(TestClock.adjust(Duration.millis(249)));
    expect(vscode.workspace.fs.rename).not.toHaveBeenCalled();
    await runtime.runPromise(TestClock.adjust(Duration.millis(1)));
    await saved.promise;
    expect((await runtime.runPromise(store.load(orgId)))?.metadataTypes[0]?.xmlName).toBe('ApexClass');
    await runtime.dispose();
    expect(vscode.workspace.fs.rename).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it('settles an in-flight save then flushes newer dirty changes before disposal returns', async () => {
  const runtime = ManagedRuntime.make(graph);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const fs = coreFs.fs.promises as typeof FsPromises;
  vi.mocked(vscode.workspace.fs.rename).mockImplementationOnce(async (source, target) => {
    entered.resolve();
    await release.promise;
    await fs.rename(source.path, target.path);
  });
  try {
    const state = await runtime.runPromise(OrgCatalogState);
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    const uri = await runtime.runPromise(store.getSnapshotUri(orgId));
    await runtime.runPromise(state.setMetadataTypes(orgId, [observation('ApexClass')]));
    await runtime.runPromise(state.queuePersist(orgId));
    await runtime.runPromise(TestClock.adjust(Duration.millis(250)));
    await entered.promise;
    await runtime.runPromise(state.setMetadataTypes(orgId, [observation('ApexTrigger')]));
    await runtime.runPromise(state.queuePersist(orgId));
    const closed = vi.fn<() => void>();
    const disposing = runtime.dispose().then(closed);
    await Promise.resolve();
    expect(closed).not.toHaveBeenCalled();
    release.resolve();
    await disposing;
    const saved: unknown = JSON.parse(String(await coreFs.fs.promises.readFile(uri.path, 'utf8')));
    expect(saved).toMatchObject({ metadataTypes: [{ xmlName: 'ApexTrigger' }] });
    expect(vscode.workspace.fs.rename).toHaveBeenCalledTimes(2);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('retains failed dirty work for retry rather than claiming it permanently before persistence', async () => {
  const runtime = ManagedRuntime.make(graph);
  const failed = Promise.withResolvers<void>();
  vi.mocked(vscode.workspace.fs.rename).mockImplementationOnce(() => {
    failed.resolve();
    return Promise.reject(new Error('locked'));
  });
  try {
    const state = await runtime.runPromise(OrgCatalogState);
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    await runtime.runPromise(state.setMetadataTypes(orgId, [observation('ApexClass')]));
    await runtime.runPromise(state.queuePersist(orgId));
    await runtime.runPromise(TestClock.adjust(Duration.millis(250)));
    await failed.promise;
    expect(await runtime.runPromise(state.flushOrg(orgId))).toBe(true);
    expect((await runtime.runPromise(store.load(orgId)))?.metadataTypes[0]?.xmlName).toBe('ApexClass');
  } finally {
    await runtime.dispose();
  }
});

it('reports a final flush failure with the original native cause instead of silently losing dirty state', async () => {
  const runtime = ManagedRuntime.make(graph);
  const defect = new Error('disk full');
  vi.mocked(vscode.workspace.fs.rename).mockRejectedValue(defect);
  const state = await runtime.runPromise(OrgCatalogState);
  await runtime.runPromise(state.setMetadataTypes(orgId, [observation('ApexClass')]));
  await runtime.runPromise(state.queuePersist(orgId));
  const exit = await Effect.runPromise(runtime.disposeEffect.pipe(Effect.exit));
  expect(
    Exit.isFailure(exit) &&
      exit.cause.reasons.some(
        reason => reason._tag === 'Die' && Schema.is(FsServiceError)(reason.defect) && reason.defect.cause === defect
      )
  ).toBe(true);
});

it('hydrates separate org partitions and survives closing dirty volatile state without a workspace', async () => {
  const runtime = ManagedRuntime.make(graph);
  try {
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    const state = await runtime.runPromise(OrgCatalogState);
    for (const [id, xmlName] of [
      [orgId, 'ApexClass'],
      [otherOrgId, 'ApexTrigger']
    ] as const) {
      await runtime.runPromise(
        store.save({
          version: 2,
          orgId: id,
          writtenAt: '',
          generation: 1,
          inventory: [],
          sobjects: { descriptions: [] },
          tracking: [],
          metadataTypes: [observation(xmlName)],
          metadataListings: []
        })
      );
      await runtime.runPromise(state.ensureHydrated(id));
    }
    expect((await runtime.runPromise(state.getMetadataTypes(orgId)))?.[0]?.xmlName).toBe('ApexClass');
    expect((await runtime.runPromise(state.getMetadataTypes(otherOrgId)))?.[0]?.xmlName).toBe('ApexTrigger');
    Object.defineProperty(vscode.workspace, 'workspaceFolders', { configurable: true, value: [] });
    await runtime.runPromise(state.queuePersist(orgId));
  } finally {
    await runtime.dispose();
  }
});

it('drains a clean-state external persistence call and rejects retained state mutations after close', async () => {
  const runtime = ManagedRuntime.make(graph);
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
    const state = await runtime.runPromise(OrgCatalogState);
    await runtime.runPromise(state.setMetadataTypes(orgId, [observation('ApexClass')]));
    // No queued dirty worker work: only shared admission can make disposal await this caller-owned fiber.
    const saving = Effect.runPromiseExit(state.persistOrg(orgId));
    await entered.promise;
    const closed = vi.fn<() => void>();
    const disposing = runtime.dispose().then(closed);
    await Promise.resolve();
    expect(closed).not.toHaveBeenCalled();
    release.resolve();
    await disposing;
    await saving;
    const writes = writeFile.mock.calls.length;
    expect(
      Exit.isFailure(await Effect.runPromiseExit(state.setMetadataTypes(orgId, [observation('ApexTrigger')])))
    ).toBe(true);
    expect(Exit.isFailure(await Effect.runPromiseExit(state.persistOrg(orgId)))).toBe(true);
    expect(Exit.isFailure(await Effect.runPromiseExit(state.queuePersist(orgId)))).toBe(true);
    expect(writeFile).toHaveBeenCalledTimes(writes);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('retries hydration after mounting a workspace without replacing newer volatile observations', async () => {
  const runtime = ManagedRuntime.make(graph);
  try {
    const state = await runtime.runPromise(OrgCatalogState);
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    await runtime.runPromise(
      store.save({
        version: 2,
        orgId,
        writtenAt: '',
        generation: 10,
        inventory: [],
        sobjects: { descriptions: [] },
        tracking: [],
        metadataTypes: [observation('ApexClass')],
        metadataListings: [
          {
            xmlName: 'CustomObject',
            observedAt: '',
            components: [{ fullName: 'Account' }]
          }
        ]
      })
    );
    Object.defineProperty(vscode.workspace, 'workspaceFolders', { configurable: true, value: [] });
    await runtime.runPromise(state.ensureHydrated(orgId));
    await runtime.runPromise(state.setMetadataTypes(orgId, [observation('ApexTrigger')]));
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      configurable: true,
      value: [{ uri: URI.parse('memfs:/v4-state'), name: 'state', index: 0 }]
    });
    await runtime.runPromise(state.ensureHydrated(orgId));
    expect((await runtime.runPromise(state.getMetadataListing(orgId, 'CustomObject')))?.components[0]?.fullName).toBe(
      'Account'
    );
    expect((await runtime.runPromise(state.getMetadataTypes(orgId)))?.[0]?.xmlName).toBe('ApexTrigger');
  } finally {
    await runtime.dispose();
  }
});

it('hydrates untouched disk observations before a shutdown-only persistence after mounting', async () => {
  const runtime = ManagedRuntime.make(graph);
  const state = await runtime.runPromise(OrgCatalogState);
  const store = await runtime.runPromise(OrgMetadataCatalogStore);
  const uri = await runtime.runPromise(
    store.save({
      version: 2,
      orgId,
      writtenAt: '',
      generation: 10,
      inventory: [{ xmlName: 'ApexClass', observedAt: '', components: [{ fullName: 'Existing' }], folders: [] }],
      sobjects: { descriptions: [] },
      tracking: [],
      metadataTypes: [observation('ApexClass')],
      metadataListings: [{ xmlName: 'ApexClass', observedAt: '', components: [{ fullName: 'Existing' }] }]
    })
  );
  Object.defineProperty(vscode.workspace, 'workspaceFolders', { configurable: true, value: [] });
  await runtime.runPromise(state.ensureHydrated(orgId));
  await runtime.runPromise(state.setMetadataTypes(orgId, [observation('ApexTrigger')]));
  await runtime.runPromise(state.queuePersist(orgId));
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri: URI.parse('memfs:/v4-state'), name: 'state', index: 0 }]
  });
  await runtime.dispose();
  const saved: unknown = JSON.parse(String(await coreFs.fs.promises.readFile(uri.path, 'utf8')));
  expect(saved).toMatchObject({
    generation: 11,
    inventory: [{ components: [{ fullName: 'Existing' }] }],
    metadataListings: [{ components: [{ fullName: 'Existing' }] }],
    metadataTypes: [{ xmlName: 'ApexTrigger' }]
  });
});

it('does not resurrect inventory, SObject, or tracking removals during late hydration', async () => {
  const runtime = ManagedRuntime.make(graph);
  try {
    const state = await runtime.runPromise(OrgCatalogState);
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    await runtime.runPromise(
      store.save({
        version: 2,
        orgId,
        writtenAt: '',
        generation: 10,
        inventory: ['ApexClass', 'ApexTrigger'].map(xmlName => ({
          xmlName,
          observedAt: '',
          components: [{ fullName: 'Old' }],
          folders: []
        })),
        sobjects: {
          list: [{ orgId, observedAt: '', provenance: 'rest-api', name: 'Account', custom: false, queryable: true }],
          descriptions: ['Account', 'Contact'].map(name => ({
            orgId,
            observedAt: '',
            provenance: 'rest-api',
            name,
            label: name,
            custom: false,
            queryable: true,
            fields: [],
            childRelationships: []
          }))
        },
        tracking: [{ xmlName: 'ApexClass', fullName: 'Old', signature: 'old' }],
        metadataTypes: [],
        metadataListings: []
      })
    );
    Object.defineProperty(vscode.workspace, 'workspaceFolders', { configurable: true, value: [] });
    await runtime.runPromise(state.ensureHydrated(orgId));
    await runtime.runPromise(state.invalidateTypes(orgId, new Set(['ApexClass'])));
    await runtime.runPromise(state.invalidateSObjects(orgId, new Set(['Account'])));
    await runtime.runPromise(
      state.removeTracking(orgId, new Set([componentIdentity({ xmlName: 'ApexClass', fullName: 'Old' })]))
    );
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      configurable: true,
      value: [{ uri: URI.parse('memfs:/v4-state'), name: 'state', index: 0 }]
    });
    await runtime.runPromise(state.ensureHydrated(orgId));
    expect(await runtime.runPromise(state.getPersistedInventory(orgId, 'ApexClass'))).toBeUndefined();
    expect(await runtime.runPromise(state.getPersistedInventory(orgId, 'ApexTrigger'))).toBeDefined();
    expect(await runtime.runPromise(state.getSObjectList(orgId))).toBeUndefined();
    expect(await runtime.runPromise(state.getSObjectDescription(orgId, 'Account'))).toBeUndefined();
    expect(await runtime.runPromise(state.getSObjectDescription(orgId, 'Contact'))).toBeDefined();
    expect((await runtime.runPromise(state.getTracking(orgId))).identityOrder).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});

it('retries transient native stat failures and never treats unreadable disk observations as absent', async () => {
  const runtime = ManagedRuntime.make(graph);
  const state = await runtime.runPromise(OrgCatalogState);
  const store = await runtime.runPromise(OrgMetadataCatalogStore);
  const uri = await runtime.runPromise(
    store.save({
      version: 2,
      orgId,
      writtenAt: '',
      generation: 10,
      inventory: [],
      sobjects: { descriptions: [] },
      tracking: [],
      metadataTypes: [observation('ApexClass')],
      metadataListings: [
        {
          xmlName: 'ApexClass',
          observedAt: '',
          components: [{ fullName: 'Existing' }]
        }
      ]
    })
  );
  vi.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(
    Object.assign(new Error('temporarily unavailable'), { code: 'EACCES' })
  );
  await runtime.runPromise(state.ensureHydrated(orgId));
  expect(await runtime.runPromise(state.getMetadataTypes(orgId))).toBeUndefined();
  await runtime.runPromise(state.setMetadataTypes(orgId, [observation('ApexTrigger')]));
  await runtime.runPromise(state.queuePersist(orgId));
  // Finalizer, not another ordinary reader, must retry the unavailable partition.
  await runtime.dispose();
  const saved: unknown = JSON.parse(String(await coreFs.fs.promises.readFile(uri.path, 'utf8')));
  expect(saved).toMatchObject({
    generation: 11,
    metadataListings: [{ components: [{ fullName: 'Existing' }] }],
    metadataTypes: [{ xmlName: 'ApexTrigger' }]
  });
});
