/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection, StateAggregator } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import {
  ConnectionService,
  InactiveOrgOperationError,
  MetadataDescribeService,
  OrgId,
  OrgMetadataCatalogChangePubSub,
  type DescribeSObjectResult,
  type OrgMetadataCatalogInternalEntry
} from '@salesforce/vscode-services-v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as HashMap from 'effect/HashMap';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as TestClock from 'effect/testing/TestClock';
import type * as FsPromises from 'node:fs/promises';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ChannelServiceLayer } from '../../src/channelService.js';
import { ConnectionHost } from '../../src/connectionHost.js';
import { ConnectionServiceLayer } from '../../src/connectionService.js';
import { foundationalLayers } from '../../src/foundationalLayers.js';
import { MetadataDescribeServiceLayer } from '../../src/metadataDescribeService.js';
import { OrgMetadataCatalogChangePubSubLayer } from '../../src/metadataChangeNotificationService.js';
import { MetadataRegistryServiceLayer } from '../../src/metadataRegistryService.js';
import { OrgCatalogState, OrgCatalogStateLayer } from '../../src/orgCatalog/orgCatalogState.js';
import type { ListedMetadataComponent } from '../../src/orgCatalog/orgCatalogInternalTypes.js';
import {
  OrgMetadataCatalogRecorder,
  OrgMetadataCatalogRecorderLayer
} from '../../src/orgCatalog/orgMetadataCatalogRecorder.js';
import { OrgMetadataCatalogStoreLayer } from '../../src/orgCatalog/orgMetadataCatalogStore.js';
import { OrgChanges } from '../../src/targetOrgRef.js';
import { TransmogrifierServiceLayer } from '../../src/transmogrifierService.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';
import { installVscodeFs } from '../support/vscodeFs.js';

const originalFs = coreFs.fs;
const sdkCreateConnection = Connection.create.bind(Connection);
const orgId = Schema.decodeUnknownSync(OrgId)('00D000000000001');
const host = Layer.succeed(ConnectionHost, {
  globalState: { get: vi.fn(), update: () => Promise.resolve(undefined), keys: () => [], setKeysForSync: vi.fn() },
  messages: {
    expired: 'expired',
    expiredDetail: 'expired',
    login: 'login',
    refreshFailed: 'failed',
    orgChanged: id => `Org changed: ${id}`
  }
});
const base = Layer.mergeAll(foundationalLayers, ChannelServiceLayer).pipe(
  Layer.provideMerge(Layer.merge(host, Layer.succeed(WebFileSystemProvider, { get: () => undefined })))
);
const connectionGraph = ConnectionServiceLayer.pipe(Layer.provideMerge(base));
const stateGraph = OrgCatalogStateLayer.pipe(Layer.provideMerge(OrgMetadataCatalogStoreLayer));
const recorderGraph = OrgMetadataCatalogRecorderLayer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      stateGraph,
      MetadataRegistryServiceLayer,
      TransmogrifierServiceLayer,
      OrgMetadataCatalogChangePubSubLayer
    )
  )
);
const graph = MetadataDescribeServiceLayer.pipe(
  Layer.provideMerge(recorderGraph),
  Layer.provideMerge(connectionGraph),
  Layer.provideMerge(TestClock.layer())
);
const raw = (name = 'Account'): DescribeSObjectResult =>
  ({
    name,
    label: name,
    custom: false,
    queryable: true,
    fields: [],
    childRelationships: []
  }) as unknown as DescribeSObjectResult;
const jsonResponse = <T>(promise: Promise<T>) =>
  Object.assign(promise, {
    stream: () => {
      throw new Error('JSON fixture only');
    }
  });
const start = async () => {
  const runtime = ManagedRuntime.make(graph);
  const connection = await runtime.runPromise(ConnectionService.use(service => service.getConnection()));
  expect(connection).toBeInstanceOf(Connection);
  return { runtime, connection, service: await runtime.runPromise(MetadataDescribeService) };
};
beforeEach(async () => {
  vi.stubEnv('FORCE_MEMFS', 'true');
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  vi.stubEnv('SF_USE_GENERIC_UNIX_KEYCHAIN', 'true');
  coreFs.setFs(coreFs.getVirtualFs());
  installVscodeFs(coreFs.fs.promises as typeof FsPromises);
  await StateAggregator.clearInstanceAsync();
  await coreFs.fs.promises.mkdir('/v4-describe', { recursive: true });
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri: URI.parse('memfs:/v4-describe'), name: 'describe', index: 0 }]
  });
  const settings: Record<string, unknown> = {
    instanceUrl: 'https://fixture.example',
    accessToken: 'fixture-secret',
    apiVersion: '67.0',
    sessionContext: {
      username: 'describe@example.com',
      orgId,
      userId: '005000000000001',
      namespacePrefix: '',
      isDevHub: false,
      isScratch: false,
      isSandbox: false
    }
  };
  vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
    get: (key: string) => settings[key],
    update: vi.fn()
  } as unknown as vscode.WorkspaceConfiguration);
  vi.spyOn(Connection, 'create').mockImplementation(options =>
    sdkCreateConnection({ ...options, connectionOptions: { version: '67.0' } })
  );
  vi.spyOn(Connection.prototype, 'request').mockImplementation(function (this: Connection) {
    return jsonResponse(
      Promise.resolve({ totalSize: 1, done: true, records: [{ Id: '005000000000001', Username: this.getUsername() }] })
    );
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  coreFs.setFs(originalFs);
  vi.unstubAllEnvs();
});

it('coalesces structural type/folder keys; cache peeks never load; TTL, retry, static standard value sets, and invalidation work', async () => {
  const { runtime, connection, service } = await start();
  const list = vi.spyOn(connection.metadata, 'list').mockResolvedValue([
    { type: 'ApexClass', fullName: 'Zed' },
    { type: 'ApexClass', fullName: 'Alpha' },
    { type: 'ApexClass', fullName: 'Alpha' }
  ] as Awaited<ReturnType<typeof connection.metadata.list>>);
  try {
    expect(Option.isNone(await runtime.runPromise(service.listMetadataCached('ApexClass')))).toBe(true);
    expect(list).not.toHaveBeenCalled();
    const values = await runtime.runPromise(
      Effect.all([service.listMetadata('ApexClass'), service.listMetadata('ApexClass')], { concurrency: 'unbounded' })
    );
    expect(values.map(value => value.map(row => row.fullName))).toEqual([
      ['Alpha', 'Zed'],
      ['Alpha', 'Zed']
    ]);
    expect(list).toHaveBeenCalledTimes(1);
    expect(Option.isSome(await runtime.runPromise(service.listMetadataCached('ApexClass')))).toBe(true);
    const state = await runtime.runPromise(OrgCatalogState);
    expect(
      (await runtime.runPromise(state.getMetadataListing(orgId, 'ApexClass')))?.components.map(value => value.fullName)
    ).toEqual(['Alpha', 'Zed']);
    await runtime.runPromise(service.listMetadata('ApexClass', 'folder'));
    expect(list).toHaveBeenCalledTimes(2);
    await runtime.runPromise(TestClock.adjust(Duration.minutes(5)));
    expect(Option.isNone(await runtime.runPromise(service.listMetadataCached('ApexClass')))).toBe(true);
    list.mockRejectedValueOnce(new Error('transient'));
    expect(await runtime.runPromise(service.listMetadata('ApexClass').pipe(Effect.flip))).toMatchObject({
      _tag: 'ListMetadataError'
    });
    await runtime.runPromise(service.listMetadata('ApexClass'));
    expect(list).toHaveBeenCalledTimes(4);
    await runtime.runPromise(service.invalidateListMetadata('ApexClass'));
    expect(Option.isNone(await runtime.runPromise(service.listMetadataCached('ApexClass')))).toBe(true);
    expect((await runtime.runPromise(service.listMetadata('StandardValueSet'))).length).toBeGreaterThan(10);
    expect(list).toHaveBeenCalledTimes(4);
  } finally {
    await runtime.dispose();
  }
});

it('records real reader observations and respects metadata/global/SObject cache TTLs and targeted invalidation', async () => {
  const { runtime, connection, service } = await start();
  const describe = vi.spyOn(connection.metadata, 'describe').mockResolvedValue({
    metadataObjects: [
      {
        xmlName: 'ApexClass',
        directoryName: 'classes',
        suffix: 'cls',
        inFolder: false,
        metaFile: true,
        childXmlNames: []
      },
      { xmlName: 'Profile', directoryName: 'profiles', inFolder: false, metaFile: true, childXmlNames: [] }
    ],
    organizationNamespace: '',
    partialSaveAllowed: true,
    testRequired: false
  });
  const global = vi.spyOn(connection, 'describeGlobal').mockResolvedValue({
    sobjects: [{ name: 'Account', custom: false, queryable: true, triggerable: true }]
  } as Awaited<ReturnType<typeof connection.describeGlobal>>);
  const object = vi.spyOn(connection, 'describe').mockResolvedValue(raw());
  try {
    expect((await runtime.runPromise(service.describe())).map(value => value.xmlName)).toEqual(['ApexClass']);
    await runtime.runPromise(service.describe());
    await runtime.runPromise(service.listSObjects());
    await runtime.runPromise(service.listSObjects());
    await runtime.runPromise(service.describeCustomObject('Account'));
    await runtime.runPromise(service.describeCustomObject('Account'));
    const state = await runtime.runPromise(OrgCatalogState);
    expect((await runtime.runPromise(state.getSObjectDescription(orgId, 'Account')))?.name).toBe('Account');
    expect(describe).toHaveBeenCalledTimes(1);
    expect(global).toHaveBeenCalledTimes(1);
    expect(object).toHaveBeenCalledTimes(1);
    await runtime.runPromise(
      service.invalidateForMetadataChanges(orgId, [{ xmlName: 'CustomField', fullName: 'Account.Name' }])
    );
    await runtime.runPromise(service.describeCustomObject('Account'));
    await runtime.runPromise(service.listSObjects());
    expect(object).toHaveBeenCalledTimes(2);
    expect(global).toHaveBeenCalledTimes(2);
    await runtime.runPromise(TestClock.adjust(Duration.minutes(15)));
    await runtime.runPromise(service.describeCustomObject('Account'));
    await runtime.runPromise(service.listSObjects());
    await runtime.runPromise(service.describe());
    expect(object).toHaveBeenCalledTimes(3);
    expect(global).toHaveBeenCalledTimes(3);
    expect(describe).toHaveBeenCalledTimes(1);
    await runtime.runPromise(TestClock.adjust(Duration.minutes(15)));
    await runtime.runPromise(service.describe());
    expect(describe).toHaveBeenCalledTimes(2);
  } finally {
    await runtime.dispose();
  }
});

it('rejects a delayed previous epoch before catalog recording and never revives it after clear/reselect', async () => {
  const { runtime, connection, service } = await start();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<DescribeSObjectResult>();
  const object = vi
    .spyOn(connection, 'describe')
    .mockImplementationOnce(() => {
      entered.resolve();
      return release.promise;
    })
    .mockResolvedValue(raw());
  try {
    const reading = runtime.runPromise(service.describeCustomObject('Account').pipe(Effect.exit));
    await entered.promise;
    await runtime.runPromise(OrgChanges.use(changes => changes.clear));
    await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    release.resolve(raw('Stale'));
    const exit = await reading;
    expect(
      Exit.isFailure(exit) &&
        exit.cause.reasons.some(reason => reason._tag === 'Fail' && Schema.is(InactiveOrgOperationError)(reason.error))
    ).toBe(true);
    const state = await runtime.runPromise(OrgCatalogState);
    expect(await runtime.runPromise(state.getSObjectDescription(orgId, 'Stale'))).toBeUndefined();
    expect((await runtime.runPromise(service.describeCustomObject('Account'))).name).toBe('Account');
    expect(object).toHaveBeenCalledTimes(2);
  } finally {
    release.resolve(raw());
    await runtime.dispose();
  }
});

it('does not record a delayed same-org listing after invalidation and a newer read', async () => {
  const { runtime, connection, service } = await start();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<Awaited<ReturnType<typeof connection.metadata.list>>>();
  vi.spyOn(connection.metadata, 'list')
    .mockImplementationOnce(() => {
      entered.resolve();
      return release.promise;
    })
    .mockResolvedValue([{ type: 'ApexClass', fullName: 'Fresh' }] as Awaited<
      ReturnType<typeof connection.metadata.list>
    >);
  try {
    const previous = runtime.runPromise(service.listMetadata('ApexClass').pipe(Effect.exit));
    await entered.promise;
    await runtime.runPromise(service.invalidateListMetadata('ApexClass'));
    expect((await runtime.runPromise(service.listMetadata('ApexClass'))).map(row => row.fullName)).toEqual(['Fresh']);
    release.resolve([{ type: 'ApexClass', fullName: 'Stale' }] as Awaited<ReturnType<typeof connection.metadata.list>>);
    const exit = await previous;
    expect(
      Exit.isFailure(exit) &&
        exit.cause.reasons.some(reason => reason._tag === 'Fail' && reason.error._tag === 'ListMetadataError')
    ).toBe(true);
    const state = await runtime.runPromise(OrgCatalogState);
    expect(
      (await runtime.runPromise(state.getMetadataListing(orgId, 'ApexClass')))?.components.map(row => row.fullName)
    ).toEqual(['Fresh']);
  } finally {
    release.resolve([]);
    await runtime.dispose();
  }
});

it('resolves a refreshed native connection on cache misses without changing the committed org epoch', async () => {
  const { runtime, connection, service } = await start();
  const first = vi.spyOn(connection, 'describe').mockResolvedValue(raw('Before'));
  try {
    await runtime.runPromise(service.describeCustomObject('Account'));
    const before = await runtime.runPromise(OrgChanges.use(changes => changes.snapshot));
    await runtime.runPromise(ConnectionService.use(connections => connections.invalidateCachedConnections()));
    const refreshed = await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    expect(refreshed).not.toBe(connection);
    expect((await runtime.runPromise(OrgChanges.use(changes => changes.snapshot))).orgGeneration).toBe(
      before.orgGeneration
    );
    const second = vi.spyOn(refreshed, 'describe').mockResolvedValue(raw('After'));
    await runtime.runPromise(service.invalidateSObjectDescribe('Account'));
    expect((await runtime.runPromise(service.describeCustomObject('Account'))).name).toBe('After');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it('does not cache malformed single or composite descriptions as successful reads', async () => {
  const { runtime, connection, service } = await start();
  const object = vi
    .spyOn(connection, 'describe')
    .mockResolvedValueOnce({ name: 'Account' } as DescribeSObjectResult)
    .mockResolvedValue(raw());
  try {
    expect(await runtime.runPromise(service.describeCustomObject('Account').pipe(Effect.flip))).toMatchObject({
      _tag: 'SchemaError'
    });
    expect((await runtime.runPromise(service.describeCustomObject('Account'))).name).toBe('Account');
    expect(object).toHaveBeenCalledTimes(2);
    const batches: string[] = [];
    vi.spyOn(connection, 'request').mockImplementation(function (this: Connection, options) {
      const url = typeof options === 'string' ? options : options.url;
      if (!url.includes('/composite/batch'))
        return jsonResponse(
          Promise.resolve({
            totalSize: 1,
            done: true,
            records: [{ Id: '005000000000001', Username: this.getUsername() }]
          })
        );
      batches.push(url);
      return jsonResponse(
        Promise.resolve({
          hasErrors: false,
          results: [{ statusCode: 200, result: batches.length === 1 ? { name: 'Contact' } : raw('Contact') }]
        })
      );
    });
    const malformed = await runtime.runPromise(service.describeCustomObjects(['Contact']));
    expect(Exit.isFailure(await Effect.runPromiseExit(Stream.runCollect(malformed)))).toBe(true);
    const retried = await runtime.runPromise(service.describeCustomObjects(['Contact']));
    expect((await Effect.runPromise(Stream.runCollect(retried))).map(row => row.name)).toEqual(['Contact']);
    expect(batches).toHaveLength(2);
  } finally {
    await runtime.dispose();
  }
});

it('rejects stale recorder operations before invalidating fresh inventory, SObject, or tracking observations', async () => {
  const { runtime, connection, service } = await start();
  vi.spyOn(connection, 'describe').mockResolvedValue(raw());
  try {
    const recorder = await runtime.runPromise(OrgMetadataCatalogRecorder);
    const state = await runtime.runPromise(OrgCatalogState);
    const previous = (await runtime.runPromise(OrgChanges.use(changes => changes.snapshot))).orgGeneration;
    const rows = [{ origin: 'remote', type: 'CustomObject', fullName: 'Account', state: 'changed' }];
    const oldTracking = await runtime.runPromise(recorder.prepareTrackingStatus(orgId, rows, []));
    await runtime.runPromise(OrgChanges.use(changes => changes.clear));
    await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    await runtime.runPromise(service.describeCustomObject('Account'));
    const before = await runtime.runPromise(state.getSObjectDescription(orgId, 'Account'));
    const inventory = {
      observedAt: '',
      complete: true,
      components: HashMap.empty<string, OrgMetadataCatalogInternalEntry>(),
      componentIdentityOrder: [],
      folders: HashMap.empty<string, ListedMetadataComponent>(),
      folderFullNameOrder: []
    };
    await runtime.runPromise(state.setInventory(orgId, 'CustomObject', inventory));
    expect(
      await runtime.runPromise(
        recorder
          .recordOperation(
            {
              orgId,
              operation: 'retrieve',
              completedAt: '',
              changes: [
                {
                  metadataType: 'CustomObject',
                  fullName: 'Account',
                  changeType: 'changed',
                  fileUri: Option.none()
                }
              ]
            },
            previous
          )
          .pipe(Effect.flip)
      )
    ).toMatchObject({ _tag: 'InactiveOrgOperationError' });
    expect(await runtime.runPromise(state.getSObjectDescription(orgId, 'Account'))).toEqual(before);
    expect(await runtime.runPromise(state.getInventory(orgId, 'CustomObject'))).toBe(inventory);
    expect(
      await runtime.runPromise(recorder.commitTrackingStatus(orgId, previous, oldTracking).pipe(Effect.flip))
    ).toMatchObject({ _tag: 'InactiveOrgOperationError' });
    expect(await runtime.runPromise(state.getSObjectDescription(orgId, 'Account'))).toEqual(before);
    expect(await runtime.runPromise(state.getInventory(orgId, 'CustomObject'))).toBe(inventory);
  } finally {
    await runtime.dispose();
  }
});

it('streams composite batches lazily, warms single-object cache, and guards cached buffered records after disposal', async () => {
  const { runtime, connection, service } = await start();
  const batches: string[][] = [];
  vi.spyOn(connection, 'request').mockImplementation(function (this: Connection, options) {
    const body = typeof options === 'string' ? undefined : options.body;
    if (!body)
      return jsonResponse(
        Promise.resolve({
          totalSize: 1,
          done: true,
          records: [{ Id: '005000000000001', Username: this.getUsername() }]
        })
      );
    const parsed = Schema.decodeUnknownSync(
      Schema.Struct({ batchRequests: Schema.Array(Schema.Struct({ method: Schema.String, url: Schema.String })) })
    )(JSON.parse(String(body)));
    batches.push(parsed.batchRequests.map(value => value.url));
    return jsonResponse(
      Promise.resolve({
        hasErrors: false,
        results: parsed.batchRequests.map(value => ({ statusCode: 200, result: raw(value.url.split('/').at(-2)) }))
      })
    );
  });
  try {
    const names = Array.from({ length: 26 }, (_, index) => `Object${index}`);
    const stream = await runtime.runPromise(service.describeCustomObjects(names));
    expect(batches).toHaveLength(0);
    expect(await Effect.runPromise(Stream.runCollect(stream))).toHaveLength(26);
    expect(batches.map(batch => batch.length)).toEqual([25, 1]);
    const object = vi.spyOn(connection, 'describe').mockResolvedValue(raw());
    expect((await runtime.runPromise(service.describeCustomObject('Object0'))).name).toBe('Object0');
    expect(object).not.toHaveBeenCalled();
    const buffered = await runtime.runPromise(service.describeCustomObjects(names));
    await runtime.dispose();
    expect(Exit.isFailure(await Effect.runPromiseExit(Stream.runCollect(buffered)))).toBe(true);
    expect(batches).toHaveLength(2);
  } finally {
    await runtime.dispose();
  }
});

it('prepares tracking without advancing signatures; committed observations publish once', async () => {
  const { runtime } = await start();
  try {
    const recorder = await runtime.runPromise(OrgMetadataCatalogRecorder);
    const state = await runtime.runPromise(OrgCatalogState);
    const generation = (await runtime.runPromise(OrgChanges.use(changes => changes.snapshot))).orgGeneration;
    await runtime.runPromise(
      Effect.gen(function* () {
        const subscription = yield* OrgMetadataCatalogChangePubSub.pipe(Effect.flatMap(PubSub.subscribe));
        const rows = [{ origin: 'remote', type: 'ApexClass', fullName: 'Example', state: 'changed' }];
        const prepared = yield* recorder.prepareTrackingStatus(orgId, rows, []);
        expect((yield* state.getTracking(orgId)).identityOrder).toEqual([]);
        expect(yield* PubSub.remaining(subscription)).toBe(0);
        expect(prepared.references).toEqual([{ xmlName: 'ApexClass', fullName: 'Example' }]);
        yield* recorder.commitTrackingStatus(orgId, generation, prepared);
        expect(yield* PubSub.take(subscription)).toEqual({ kind: 'tracking', orgId, references: prepared.references });
        const unchanged = yield* recorder.prepareTrackingStatus(orgId, rows, []);
        expect(unchanged.references).toEqual([]);
        yield* recorder.commitTrackingStatus(orgId, generation, unchanged);
        expect(yield* PubSub.remaining(subscription)).toBe(0);
      }).pipe(Effect.scoped)
    );
  } finally {
    await runtime.dispose();
  }
});
