/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Global, SfProject, StateAggregator } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import {
  ActiveMetadataOperationRef,
  ComponentSetService,
  ConnectionService,
  FileChangePubSub,
  FsService,
  MetadataChangeNotificationService,
  MetadataDescribeService,
  MetadataRegistryService,
  OrgId,
  OrgMetadataCatalog,
  OrgMetadataCatalogChangePubSub,
  ProjectService,
  publicServiceKeys,
  type SalesforceVSCodeServicesApiV2,
  type DescribeSObjectResult
} from '@salesforce/vscode-services-v2';
import * as Duration from 'effect/Duration';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as HashMap from 'effect/HashMap';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as Scheduler from 'effect/Scheduler';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as TestClock from 'effect/testing/TestClock';
import assert from 'node:assert/strict';
import type * as FsPromises from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { catalogLayers, catalogProviderLayers } from '../../src/catalogLayers.js';
import { createCatalogRuntime } from '../../src/catalogRuntime.js';
import { ConnectionHost } from '../../src/connectionHost.js';
import { OrgCatalogInventory } from '../../src/orgCatalog/orgCatalogInventory.js';
import { OrgCatalogDocuments } from '../../src/orgCatalog/orgCatalogDocuments.js';
import { findInventoryComponent, typeCacheKey } from '../../src/orgCatalog/orgCatalogKeys.js';
import { OrgCatalogMessages } from '../../src/orgCatalog/orgCatalogMessages.js';
import { projectChildren } from '../../src/orgCatalog/orgCatalogProjection.js';
import { OrgCatalogState } from '../../src/orgCatalog/orgCatalogState.js';
import { OrgCatalogTreeProjection } from '../../src/orgCatalog/orgCatalogTreeProjection.js';
import { OrgCatalogWorkspace } from '../../src/orgCatalog/orgCatalogWorkspace.js';
import { OrgMetadataCatalogStore } from '../../src/orgCatalog/orgMetadataCatalogStore.js';
import { OrgChanges } from '../../src/targetOrgRef.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';
import { installVscodeFs } from '../support/vscodeFs.js';

const originalFs = coreFs.fs;
const sdkCreateConnection = Connection.create.bind(Connection);
const orgId = Schema.decodeUnknownSync(OrgId)('00D000000000001');
let root: URI;
let registrationDisposals: number;
const messages = {
  workspaceMissingContent: (type: string, xml: string, content: string) =>
    `Missing ${type} content: ${xml} → ${content}`,
  workspaceScanFailed: (type: string, error: string) => `Cannot scan ${type}: ${error}`
};
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
const hostLayers = Layer.mergeAll(
  host,
  Layer.succeed(OrgCatalogMessages, messages),
  Layer.succeed(WebFileSystemProvider, { get: () => undefined })
);
const graph = catalogLayers.pipe(Layer.provide(hostLayers), Layer.provideMerge(TestClock.layer()));
const providerGraph = catalogProviderLayers.pipe(Layer.provide(hostLayers), Layer.provideMerge(TestClock.layer()));
const jsonResponse = <T>(promise: Promise<T>) =>
  Object.assign(promise, {
    stream: () => {
      throw new Error('JSON fixture only');
    }
  });
const start = async (provider = false) => {
  const runtime = ManagedRuntime.make(provider ? providerGraph : graph);
  const connection = await runtime.runPromise(
    Effect.gen(function* () {
      const changes = yield* OrgChanges;
      const before = yield* changes.snapshot;
      const subscription = provider
        ? yield* OrgMetadataCatalogChangePubSub.pipe(Effect.flatMap(PubSub.subscribe))
        : undefined;
      const value = yield* ConnectionService.use(service => service.getConnection());
      const after = yield* changes.snapshot;
      if (subscription && after.orgGeneration !== before.orgGeneration)
        yield* PubSub.take(subscription).pipe(
          Effect.repeat({ while: event => event.kind !== 'org' || event.orgId !== after.org.orgId })
        );
      return value;
    }).pipe(Effect.scoped)
  );
  const { orgGeneration } = await runtime.runPromise(OrgChanges.use(changes => changes.snapshot));
  return {
    runtime,
    connection,
    org: { orgId, orgGeneration },
    inventory: await runtime.runPromise(OrgCatalogInventory),
    workspace: await runtime.runPromise(OrgCatalogWorkspace),
    tree: await runtime.runPromise(OrgCatalogTreeProjection),
    state: await runtime.runPromise(OrgCatalogState)
  };
};
const providerToken: vscode.CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: () => ({ dispose: () => undefined })
};
const registeredProvider = () => {
  const registration = vi.mocked(vscode.workspace.registerTextDocumentContentProvider).mock.calls.at(-1);
  assert.ok(registration);
  expect(registration[0]).toBe('sf-org-metadata');
  return registration[1];
};
const installApexReader = (connection: Connection) => {
  vi.spyOn(connection.metadata, 'list').mockResolvedValue([
    { type: 'ApexClass', fullName: 'Remote', lastModifiedDate: '2026-10-30T00:00:00.000Z' }
  ] as Awaited<ReturnType<typeof connection.metadata.list>>);
  vi.spyOn(connection, 'request').mockImplementation(function (this: Connection, options) {
    const url = decodeURIComponent(typeof options === 'string' ? options : options.url).replaceAll('+', ' ');
    return url.includes('FROM ApexClass')
      ? jsonResponse(Promise.resolve({ totalSize: 1, done: true, records: [{ Body: 'public class Remote {}' }] }))
      : jsonResponse(
          Promise.resolve({
            totalSize: 1,
            done: true,
            records: [{ Id: '005000000000001', Username: this.getUsername() }]
          })
        );
  });
};
beforeEach(async () => {
  registrationDisposals = 0;
  vi.mocked(vscode.workspace.registerTextDocumentContentProvider).mockImplementation(() => ({
    dispose: () => {
      registrationDisposals++;
    }
  }));
  vi.stubEnv('FORCE_MEMFS', 'false');
  vi.stubEnv('ESBUILD_PLATFORM', 'node');
  vi.stubEnv('SF_USE_GENERIC_UNIX_KEYCHAIN', 'true');
  coreFs.setFs(coreFs.getVirtualFs());
  installVscodeFs(coreFs.fs.promises as typeof FsPromises);
  SfProject.clearInstances();
  await StateAggregator.clearInstanceAsync();
  root = URI.file(await mkdtemp(`${process.env.RUNNER_TEMP ?? tmpdir()}/v4-inventory-`));
  vi.stubEnv('HOME', root.fsPath);
  vi.spyOn(Global, 'SF_DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sf').fsPath);
  vi.spyOn(Global, 'SFDX_DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sfdx').fsPath);
  vi.spyOn(Global, 'DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sfdx').fsPath);
  const classes = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes');
  await coreFs.fs.promises.mkdir(classes.fsPath, { recursive: true });
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(root, 'sfdx-project.json').fsPath,
    JSON.stringify({
      namespace: 'workspace',
      sourceApiVersion: '67.0',
      packageDirectories: [{ path: 'force-app', default: true }]
    })
  );
  await coreFs.fs.promises.writeFile(Utils.joinPath(classes, 'Local.cls').fsPath, 'public class Local {}');
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(classes, 'Local.cls-meta.xml').fsPath,
    '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>67.0</apiVersion><status>Active</status></ApexClass>'
  );
  await coreFs.fs.promises.mkdir(Utils.joinPath(root, '.sf').fsPath, { recursive: true });
  const config = '{"target-org":"inventory@example.com","org-api-version":"67.0"}';
  await coreFs.fs.promises.writeFile(Utils.joinPath(root, '.sf', 'config.json').fsPath, config);
  await coreFs.fs.promises.mkdir(Global.SF_DIR, { recursive: true });
  await coreFs.fs.promises.mkdir(Global.SFDX_DIR, { recursive: true });
  await coreFs.fs.promises.writeFile(Utils.joinPath(URI.file(Global.SF_DIR), 'config.json').fsPath, config);
  await coreFs.fs.promises.writeFile(Utils.joinPath(URI.file(Global.SFDX_DIR), 'alias.json').fsPath, '{"orgs":{}}');
  const auth = await AuthInfo.create({
    accessTokenOptions: {
      instanceUrl: 'https://fixture.example',
      accessToken: 'fixture-secret',
      username: 'inventory@example.com',
      orgId,
      namespacePrefix: '',
      isDevHub: false,
      isScratch: false,
      isSandbox: false
    }
  });
  auth.update({ tracksSource: false, refreshToken: 'fixture-refresh-secret' });
  await auth.save();
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri: root, name: 'inventory', index: 0 }]
  });
  const settings: Record<string, unknown> = {
    instanceUrl: 'https://fixture.example',
    accessToken: 'fixture-secret',
    apiVersion: '67.0',
    sessionContext: {
      username: 'inventory@example.com',
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
  vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(() => ({
    onDidCreate: () => ({ dispose: () => undefined }),
    onDidChange: () => ({ dispose: () => undefined }),
    onDidDelete: () => ({ dispose: () => undefined }),
    dispose: () => undefined,
    ignoreCreateEvents: false,
    ignoreChangeEvents: false,
    ignoreDeleteEvents: false
  }));
  vi.mocked(vscode.workspace.onDidChangeConfiguration).mockImplementation(() => ({ dispose: () => undefined }));
});
afterEach(async () => {
  await StateAggregator.clearInstanceAsync();
  SfProject.clearInstances();
  vi.restoreAllMocks();
  coreFs.setFs(originalFs);
  vi.unstubAllEnvs();
  await rm(root.fsPath, { recursive: true, force: true });
});

it('coalesces real SDK inventory discovery and merges workspace only into its matching namespace', async () => {
  const { runtime, connection, org, inventory, state } = await start();
  const list = vi.spyOn(connection.metadata, 'list').mockResolvedValue([
    { fullName: 'Local', type: 'ApexClass', namespacePrefix: 'workspace' },
    { fullName: 'foreign.Local', type: 'ApexClass', namespacePrefix: 'foreign' },
    { fullName: 'Remote', type: 'ApexClass' }
  ] as Awaited<ReturnType<typeof connection.metadata.list>>);
  try {
    const [first, second] = await runtime.runPromise(
      Effect.all([inventory.loadType(org, 'ApexClass'), inventory.loadType(org, 'ApexClass')], {
        concurrency: 'unbounded'
      })
    );
    expect(first).toBe(second);
    expect(list).toHaveBeenCalledTimes(1);
    expect(HashMap.size(first.components)).toBe(3);
    expect(
      findInventoryComponent(first.components, { xmlName: 'ApexClass', fullName: 'Local' }, 'workspace')
    ).toMatchObject({ inWorkspace: true, inOrg: true, provenance: 'metadata-api+workspace' });
    expect(
      findInventoryComponent(first.components, { xmlName: 'ApexClass', fullName: 'foreign.Local' }, 'foreign')
    ).toMatchObject({ inWorkspace: false, inOrg: true });
    expect(findInventoryComponent(first.components, { xmlName: 'ApexClass', fullName: 'Remote' })).toMatchObject({
      inWorkspace: false,
      inOrg: true
    });
    expect(await runtime.runPromise(state.getInventory(orgId, 'ApexClass'))).toBe(first);
    await runtime.dispose();
    expect(Exit.isFailure(await Effect.runPromiseExit(inventory.loadType(org, 'ApexClass')))).toBe(true);
  } finally {
    await runtime.dispose();
  }
});

it('projects nested folders and preserves empty folders with no local source', async () => {
  const { runtime, connection, org, inventory } = await start();
  vi.spyOn(connection.metadata, 'list').mockImplementation(
    request =>
      Promise.resolve(
        (Array.isArray(request) ? request[0]!.type : request.type) === 'ReportFolder'
          ? [
              { fullName: 'Team', type: 'ReportFolder' },
              { fullName: 'Empty', type: 'ReportFolder' }
            ]
          : [{ fullName: 'Team/Nested/Annual', type: 'Report' }]
      ) as ReturnType<typeof connection.metadata.list>
  );
  try {
    const value = await runtime.runPromise(inventory.loadType(org, 'Report'));
    const project = (parent?: string) => runtime.runPromise(projectChildren(orgId, 'Report', parent, value));
    // Pure projections need the same canonical registry, never another runtime/layer graph.
    expect((await project()).map(entry => [entry.name, entry.kind])).toEqual([
      ['Empty', 'folder'],
      ['Team', 'folder']
    ]);
    expect((await project('Team')).map(entry => [entry.name, entry.kind])).toEqual([['Nested', 'folder']]);
    expect((await project('Team/Nested')).map(entry => [entry.name, entry.kind])).toEqual([['Annual', 'component']]);
  } finally {
    await runtime.dispose();
  }
});

it('uses a genuinely cache-only cold hierarchy, then combines remote and SDK-discovered workspace root types', async () => {
  const { runtime, connection, org, tree } = await start();
  const describe = vi.spyOn(connection.metadata, 'describe').mockResolvedValue({
    metadataObjects: [
      { xmlName: 'CustomObject', directoryName: 'objects', inFolder: false, metaFile: false, childXmlNames: [] }
    ],
    organizationNamespace: '',
    partialSaveAllowed: true,
    testRequired: false
  });
  try {
    expect(await runtime.runPromise(tree.getChildrenCached(org, { xmlName: 'ApexClass' }))).toBeUndefined();
    expect(describe).not.toHaveBeenCalled();
    const hierarchyRoot = await runtime.runPromise(tree.getChildren(org));
    expect(hierarchyRoot.map(entry => [entry.name, entry.inOrg, entry.inWorkspace])).toEqual([
      ['ApexClass', false, true],
      ['CustomObject', true, false]
    ]);
    expect(await runtime.runPromise(tree.getChildrenCached(org, {}))).toEqual(hierarchyRoot);
    expect(describe).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it('reports actual missing SDR source content once using injected localized messages and does not claim workspace absence', async () => {
  const { runtime, workspace } = await start();
  await coreFs.fs.promises.unlink(Utils.joinPath(root, 'force-app', 'main', 'default', 'classes', 'Local.cls').fsPath);
  const report = vi.spyOn(vscode.window, 'showErrorMessage');
  try {
    expect((await runtime.runPromise(workspace.scanWorkspaceInventory('ApexClass'))).workspacePresenceAvailable).toBe(
      false
    );
    expect((await runtime.runPromise(workspace.scanWorkspaceInventory('ApexClass'))).workspacePresenceAvailable).toBe(
      false
    );
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(expect.stringContaining('Missing ApexClass content:'));
  } finally {
    await runtime.dispose();
  }
});

it('rejects an old epoch before installing inventory after a delayed native Metadata API listing', async () => {
  const { runtime, connection, org, inventory, state } = await start();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<Awaited<ReturnType<typeof connection.metadata.list>>>();
  vi.spyOn(connection.metadata, 'list').mockImplementationOnce(() => {
    entered.resolve();
    return release.promise;
  });
  try {
    const loading = runtime.runPromise(inventory.loadType(org, 'ApexClass').pipe(Effect.flip));
    await entered.promise;
    await runtime.runPromise(OrgChanges.use(changes => changes.clear));
    await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    release.resolve([{ fullName: 'Stale', type: 'ApexClass' }] as Awaited<ReturnType<typeof connection.metadata.list>>);
    expect(await loading).toMatchObject({ _tag: 'InactiveOrgOperationError' });
    expect(await runtime.runPromise(state.getInventory(orgId, 'ApexClass'))).toBeUndefined();
  } finally {
    release.resolve([]);
    await runtime.dispose();
  }
});

it('projects custom-field inventory and describe-only fields beneath their object', async () => {
  const { runtime, connection, org, tree } = await start();
  vi.spyOn(connection.metadata, 'list').mockImplementation(
    request =>
      Promise.resolve(
        (Array.isArray(request) ? request[0]!.type : request.type) === 'CustomObject'
          ? [{ fullName: 'Account', type: 'CustomObject' }]
          : [{ fullName: 'Account.Inventory__c', type: 'CustomField' }]
      ) as ReturnType<typeof connection.metadata.list>
  );
  const field = {
    name: 'Describe__c',
    label: 'Describe',
    type: 'string',
    custom: true,
    aggregatable: true,
    filterable: true,
    groupable: true,
    nillable: true,
    sortable: true
  };
  vi.spyOn(connection, 'describe').mockResolvedValue({
    name: 'Account',
    label: 'Account',
    custom: false,
    queryable: true,
    fields: [field],
    childRelationships: []
  } as unknown as DescribeSObjectResult);
  try {
    const children = await runtime.runPromise(tree.getChildren(org, { xmlName: 'CustomObject', fullName: 'Account' }));
    expect(children.map(entry => entry.name)).toEqual(['Describe__c', 'Inventory__c']);
    expect(children[0]).toMatchObject({ inOrg: true, field: { name: 'Describe__c', type: 'string' } });
    expect(children[1]).not.toHaveProperty('field');
  } finally {
    await runtime.dispose();
  }
});

it('never invokes network-capable loadType from cache-only hierarchy, even when its earlier completeness check becomes stale', async () => {
  const { runtime, connection, org, inventory, tree, state } = await start();
  const list = vi
    .spyOn(connection.metadata, 'list')
    .mockResolvedValue([{ type: 'ApexClass', fullName: 'Remote' }] as Awaited<
      ReturnType<typeof connection.metadata.list>
    >);
  try {
    await runtime.runPromise(inventory.loadType(org, 'ApexClass'));
    const descriptions = await runtime.runPromise(MetadataDescribeService);
    const originalLoad = inventory.loadType;
    const load = vi
      .spyOn(inventory, 'loadType')
      .mockImplementationOnce((...args) =>
        state
          .invalidateTypes(orgId, new Set(['ApexClass']))
          .pipe(
            Effect.andThen(descriptions.invalidateListMetadata('ApexClass', undefined, orgId)),
            Effect.andThen(originalLoad(...args))
          )
      );
    await runtime.runPromise(tree.getChildrenCached(org, { xmlName: 'ApexClass' }));
    expect(load).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it.each(['org', 'hierarchy'] as const)(
  'validates %s generation again after a cached fallback projection',
  async mode => {
    const { runtime, connection, org, inventory, tree, state } = await start();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    vi.spyOn(connection.metadata, 'list').mockImplementation(
      request =>
        Promise.resolve(
          (Array.isArray(request) ? request[0]!.type : request.type) === 'ReportFolder'
            ? [{ type: 'ReportFolder', fullName: 'Team' }]
            : [{ type: 'Report', fullName: 'Team/Remote' }]
        ) as ReturnType<typeof connection.metadata.list>
    );
    try {
      await runtime.runPromise(inventory.loadType(org, 'Report'));
      const registry = await runtime.runPromise(MetadataRegistryService);
      const originalGet = registry.getRegistryAccess;
      vi.spyOn(registry, 'getRegistryAccess').mockImplementationOnce(() =>
        Effect.promise(() => {
          entered.resolve();
          return release.promise;
        }).pipe(Effect.andThen(originalGet()))
      );
      const reading = runtime.runPromise(tree.getChildrenCached(org, { xmlName: 'Report' }).pipe(Effect.exit));
      await entered.promise;
      if (mode === 'org') {
        await runtime.runPromise(OrgChanges.use(changes => changes.clear));
        await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
      } else await runtime.runPromise(state.invalidateTypes(orgId, new Set(['Report'])));
      release.resolve();
      const exit = await reading;
      expect(Exit.isFailure(exit)).toBe(true);
      expect(
        Exit.isFailure(exit) &&
          exit.cause.reasons.some(
            reason =>
              reason._tag === 'Fail' &&
              reason.error._tag === (mode === 'org' ? 'InactiveOrgOperationError' : 'OrgMetadataCatalogError')
          )
      ).toBe(true);
    } finally {
      release.resolve();
      await runtime.dispose();
    }
  }
);

it('queues a complete replacement for a persisted partial inventory even after other observations have already flushed', async () => {
  const initial = await start();
  const partial: Parameters<typeof initial.state.setInventory>[2] = {
    observedAt: '2026-10-30T00:00:00.000Z',
    complete: false,
    components: HashMap.empty(),
    componentIdentityOrder: [],
    folders: HashMap.empty(),
    folderFullNameOrder: []
  };
  await initial.runtime.runPromise(initial.state.setInventory(orgId, 'ApexClass', partial));
  await initial.runtime.runPromise(initial.state.queuePersist(orgId));
  await initial.runtime.runPromise(initial.state.flushOrg(orgId));
  await initial.runtime.dispose();
  const { runtime, connection, org, inventory, state } = await start();
  vi.spyOn(connection.metadata, 'list').mockResolvedValue([{ type: 'ApexClass', fullName: 'Remote' }] as Awaited<
    ReturnType<typeof connection.metadata.list>
  >);
  try {
    const store = await runtime.runPromise(OrgMetadataCatalogStore);
    const descriptions = await runtime.runPromise(MetadataDescribeService);
    await runtime.runPromise(descriptions.listMetadata('ApexClass'));
    await runtime.runPromise(state.flushOrg(orgId));
    expect(
      (await runtime.runPromise(store.load(orgId)))?.inventory.find(value => value.xmlName === 'ApexClass')?.complete
    ).toBe(false);
    expect((await runtime.runPromise(inventory.loadType(org, 'ApexClass'))).complete).toBe(true);
    expect(await runtime.runPromise(state.flushOrg(orgId))).toBe(true);
    expect(
      (await runtime.runPromise(store.load(orgId)))?.inventory.find(value => value.xmlName === 'ApexClass')?.complete
    ).toBe(true);
  } finally {
    await runtime.dispose();
  }
});

it.each(['org', 'workspace'] as const)(
  'does not reinstall a restored inventory whose new type semaphore was absent from %s invalidation',
  async mode => {
    const { runtime, org, inventory, tree, state, workspace } = await start();
    const invalidationStarted = Promise.withResolvers<void>();
    const scanEntered = Promise.withResolvers<void>();
    const releaseScan = Promise.withResolvers<void>();
    const report = await runtime.runPromise(state.getInventorySemaphore(typeCacheKey(orgId, 'Report')));
    await runtime.runPromise(report.take(1));
    let reportHeld = true;
    const originalWithPermit = report.withPermit.bind(report);
    vi.spyOn(report, 'withPermit').mockImplementationOnce(program => {
      invalidationStarted.resolve();
      return originalWithPermit(program);
    });
    try {
      const store = await runtime.runPromise(OrgMetadataCatalogStore);
      await runtime.runPromise(
        store.save({
          version: 2,
          orgId,
          generation: 1,
          writtenAt: '2026-10-30T00:00:00.000Z',
          inventory: [
            {
              xmlName: 'ApexClass',
              complete: true,
              observedAt: '2026-10-30T00:00:00.000Z',
              components: [{ fullName: 'Remote' }],
              folders: []
            }
          ],
          sobjects: { descriptions: [] },
          tracking: [],
          metadataTypes: [],
          metadataListings: []
        })
      );
      await runtime.runPromise(state.ensureHydrated(orgId));
      const invalidating = runtime.runPromise(
        mode === 'org' ? state.invalidateOrgInventories(orgId) : state.invalidateWorkspaceInventories(orgId)
      );
      await invalidationStarted.promise;
      const originalScan = workspace.scanWorkspaceInventory;
      vi.spyOn(workspace, 'scanWorkspaceInventory').mockImplementationOnce(xmlName =>
        originalScan(xmlName).pipe(
          Effect.tap(() =>
            Effect.promise(() => {
              scanEntered.resolve();
              return releaseScan.promise;
            })
          )
        )
      );
      const reading = runtime.runPromise(tree.getChildrenCached(org, { xmlName: 'ApexClass' }).pipe(Effect.exit));
      await scanEntered.promise;
      if (mode === 'workspace')
        await coreFs.fs.promises.unlink(
          Utils.joinPath(root, 'force-app', 'main', 'default', 'classes', 'Local.cls').fsPath
        );
      await runtime.runPromise(report.release(1));
      reportHeld = false;
      await invalidating;
      releaseScan.resolve();
      expect(Exit.isFailure(await reading)).toBe(true);
      expect(await runtime.runPromise(inventory.getCachedInventory(org, 'ApexClass'))).toBeUndefined();
    } finally {
      releaseScan.resolve();
      if (reportHeld) await runtime.runPromise(report.release(1));
      await runtime.dispose();
    }
  }
);

it.each([16, 32])(
  'keeps generation comparison and inventory installation atomic with invalidation under automatic scheduler yields, budget=%s',
  async budget => {
    const { runtime, org, state, tree } = await start();
    const invalidationStarted = Promise.withResolvers<void>();
    const report = await runtime.runPromise(state.getInventorySemaphore(typeCacheKey(orgId, 'Report')));
    await runtime.runPromise(report.take(1));
    let reportHeld = true;
    const originalWithPermit = report.withPermit.bind(report);
    vi.spyOn(report, 'withPermit').mockImplementationOnce(program => {
      invalidationStarted.resolve();
      return originalWithPermit(program);
    });
    try {
      const store = await runtime.runPromise(OrgMetadataCatalogStore);
      await runtime.runPromise(
        store.save({
          version: 2,
          orgId,
          generation: 1,
          writtenAt: '2026-10-30T00:00:00.000Z',
          inventory: [
            {
              xmlName: 'ApexClass',
              complete: true,
              observedAt: '2026-10-30T00:00:00.000Z',
              components: [{ fullName: 'Remote' }],
              folders: []
            }
          ],
          sobjects: { descriptions: [] },
          tracking: [],
          metadataTypes: [],
          metadataListings: []
        })
      );
      await runtime.runPromise(state.ensureHydrated(orgId));
      const invalidating = runtime.runPromise(state.invalidateOrgInventories(orgId));
      await invalidationStarted.promise;
      const setInventory = state.setInventory;
      vi.spyOn(state, 'setInventory').mockImplementationOnce((...args) =>
        report.release(1).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              reportHeld = false;
            })
          ),
          Effect.andThen(setInventory(...args))
        )
      );
      await runtime.runPromiseExit(
        tree
          .getChildrenCached(org, { xmlName: 'ApexClass' })
          .pipe(Effect.provideService(Scheduler.MaxOpsBeforeYield, budget))
      );
      await invalidating;
      expect(await runtime.runPromise(state.getInventory(orgId, 'ApexClass'))).toBeUndefined();
      expect(await runtime.runPromise(tree.getChildrenCached(org, { xmlName: 'ApexClass' }))).toBeUndefined();
    } finally {
      if (reportHeld) await runtime.runPromise(report.release(1));
      await runtime.dispose();
    }
  }
);

it.each([16, 32])(
  'does not retain workspace types scanned before whole-org invalidation with a newly admitted scan, budget=%s',
  async budget => {
    const { runtime, connection, org, state, tree } = await start();
    vi.spyOn(connection.metadata, 'describe').mockResolvedValue({
      metadataObjects: [],
      organizationNamespace: '',
      partialSaveAllowed: true,
      testRequired: false
    });
    const invalidationStarted = Promise.withResolvers<void>();
    const scanEntered = Promise.withResolvers<void>();
    const releaseScan = Promise.withResolvers<void>();
    const report = await runtime.runPromise(state.getInventorySemaphore(typeCacheKey(orgId, 'Report')));
    await runtime.runPromise(report.take(1));
    let reportHeld = true;
    const originalWithPermit = report.withPermit.bind(report);
    vi.spyOn(report, 'withPermit').mockImplementationOnce(program => {
      invalidationStarted.resolve();
      return originalWithPermit(program);
    });
    try {
      const invalidating = runtime.runPromise(state.invalidateOrgInventories(orgId));
      await invalidationStarted.promise;
      const components = await runtime.runPromise(ComponentSetService);
      const scan = components.getComponentSetFromProjectDirectories;
      vi.spyOn(components, 'getComponentSetFromProjectDirectories').mockImplementationOnce(options =>
        scan(options).pipe(
          Effect.tap(() =>
            Effect.promise(() => {
              scanEntered.resolve();
              return releaseScan.promise;
            })
          )
        )
      );
      const reading = runtime.runPromiseExit(
        tree.getChildren(org).pipe(Effect.provideService(Scheduler.MaxOpsBeforeYield, budget))
      );
      await scanEntered.promise;
      const classes = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes');
      await coreFs.fs.promises.unlink(Utils.joinPath(classes, 'Local.cls').fsPath);
      await coreFs.fs.promises.unlink(Utils.joinPath(classes, 'Local.cls-meta.xml').fsPath);
      await runtime.runPromise(report.release(1));
      reportHeld = false;
      await invalidating;
      releaseScan.resolve();
      await reading;
      expect(await runtime.runPromise(state.getWorkspaceTypes(orgId))).toBeUndefined();
      expect((await runtime.runPromise(tree.getChildren(org))).map(entry => entry.name)).not.toContain('ApexClass');
    } finally {
      releaseScan.resolve();
      if (reportHeld) await runtime.runPromise(report.release(1));
      await runtime.dispose();
    }
  }
);

it.each([false, true])(
  'reads actual Tooling Apex source into a revisioned shadow and reuses it, protected=%s',
  async protectedSource => {
    const { runtime, connection } = await start();
    const revision = '2026-10-30T00:00:00.000Z';
    vi.spyOn(connection.metadata, 'list').mockResolvedValue([
      { type: 'ApexClass', fullName: 'Remote', lastModifiedDate: revision }
    ] as Awaited<ReturnType<typeof connection.metadata.list>>);
    let queries = 0;
    vi.spyOn(connection, 'request').mockImplementation(function (this: Connection, options) {
      const url = decodeURIComponent(typeof options === 'string' ? options : options.url).replaceAll('+', ' ');
      if (url.includes('FROM ApexClass')) {
        queries++;
        return jsonResponse(
          Promise.resolve({
            totalSize: 1,
            done: true,
            records: [{ Body: protectedSource ? '(hidden)' : 'public class Remote {}', LastModifiedDate: revision }]
          })
        );
      }
      return jsonResponse(
        Promise.resolve({
          totalSize: 1,
          done: true,
          records: [{ Id: '005000000000001', Username: this.getUsername() }]
        })
      );
    });
    try {
      const documents = await runtime.runPromise(OrgCatalogDocuments);
      const uri = URI.parse(`sf-org-metadata:/orgs/${orgId}/ApexClass/Remote.cls`);
      const expected = protectedSource
        ? "// Source code for managed class 'Remote' is protected."
        : 'public class Remote {}';
      expect(await runtime.runPromise(documents.readDocumentUri(orgId, uri))).toBe(expected);
      expect(await runtime.runPromise(documents.readDocumentUri(orgId, uri))).toBe(expected);
      expect(queries).toBe(1);
      expect(
        String(
          await coreFs.fs.promises.readFile(
            Utils.joinPath(root, 'force-app', 'main', 'default', 'classes', 'Local.cls').fsPath
          )
        )
      ).toBe('public class Local {}');
      expect(
        (
          await coreFs.fs.promises.readdir(
            Utils.joinPath(root, '.sf', 'orgs', orgId, 'remoteMetadata', 'catalog-staging').fsPath,
            { recursive: true }
          )
        ).some(name => name.endsWith('.__staging__'))
      ).toBe(false);
      await runtime.dispose();
      expect(Exit.isFailure(await Effect.runPromiseExit(documents.readDocumentUri(orgId, uri)))).toBe(true);
      expect(queries).toBe(1);
    } finally {
      await runtime.dispose();
    }
  }
);

it('does not publish a shadow when a Tooling body arrives after the committed org epoch changes', async () => {
  const { runtime, connection } = await start();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<{ totalSize: number; done: boolean; records: { Body: string }[] }>();
  vi.spyOn(connection.metadata, 'list').mockResolvedValue([{ type: 'ApexClass', fullName: 'Remote' }] as Awaited<
    ReturnType<typeof connection.metadata.list>
  >);
  vi.spyOn(connection, 'request').mockImplementation(function (this: Connection, options) {
    const url = decodeURIComponent(typeof options === 'string' ? options : options.url).replaceAll('+', ' ');
    if (url.includes('FROM ApexClass')) {
      entered.resolve();
      return jsonResponse(release.promise);
    }
    return jsonResponse(
      Promise.resolve({ totalSize: 1, done: true, records: [{ Id: '005000000000001', Username: this.getUsername() }] })
    );
  });
  try {
    const documents = await runtime.runPromise(OrgCatalogDocuments);
    const reading = runtime.runPromise(
      documents
        .readDocumentUri(orgId, URI.parse(`sf-org-metadata:/orgs/${orgId}/ApexClass/Remote.cls`))
        .pipe(Effect.flip)
    );
    await entered.promise;
    await runtime.runPromise(OrgChanges.use(changes => changes.clear));
    await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    release.resolve({ totalSize: 1, done: true, records: [{ Body: 'public class Stale {}' }] });
    expect(await reading).toMatchObject({ _tag: 'InactiveOrgOperationError' });
    expect(
      await runtime.runPromise(
        FsService.use(fs =>
          fs.fileOrFolderExists(Utils.joinPath(root, '.sf', 'orgs', orgId, 'metadata-shadow', 'ApexClass', 'Remote'))
        )
      )
    ).toBe(false);
  } finally {
    release.resolve({ totalSize: 0, done: true, records: [] });
    await runtime.dispose();
  }
});

it('revalidates org identity after reading a shadow file before returning document text', async () => {
  const { runtime, connection } = await start();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  vi.spyOn(connection.metadata, 'list').mockResolvedValue([{ type: 'ApexClass', fullName: 'Remote' }] as Awaited<
    ReturnType<typeof connection.metadata.list>
  >);
  vi.spyOn(connection, 'request').mockImplementation(function (this: Connection, options) {
    const url = decodeURIComponent(typeof options === 'string' ? options : options.url).replaceAll('+', ' ');
    return url.includes('FROM ApexClass')
      ? jsonResponse(Promise.resolve({ totalSize: 1, done: true, records: [{ Body: 'public class Remote {}' }] }))
      : jsonResponse(
          Promise.resolve({
            totalSize: 1,
            done: true,
            records: [{ Id: '005000000000001', Username: this.getUsername() }]
          })
        );
  });
  try {
    const documents = await runtime.runPromise(OrgCatalogDocuments);
    const fs = await runtime.runPromise(FsService);
    const uri = URI.parse(`sf-org-metadata:/orgs/${orgId}/ApexClass/Remote.cls`);
    await runtime.runPromise(documents.readDocumentUri(orgId, uri));
    const read = fs.readFile;
    vi.spyOn(fs, 'readFile').mockImplementationOnce(file =>
      read(file).pipe(
        Effect.tap(() =>
          Effect.promise(() => {
            entered.resolve();
            return release.promise;
          })
        )
      )
    );
    const reading = runtime.runPromise(documents.readDocumentUri(orgId, uri).pipe(Effect.flip));
    await entered.promise;
    await runtime.runPromise(OrgChanges.use(changes => changes.clear));
    await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    release.resolve();
    expect(await reading).toMatchObject({ _tag: 'InactiveOrgOperationError' });
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('serves the canonical public catalog, refreshes real inventories, and never discovers org inventory for consumer-owned references', async () => {
  const { runtime, connection } = await start();
  const list = vi
    .spyOn(connection.metadata, 'list')
    .mockResolvedValue([{ type: 'ApexClass', fullName: 'Remote' }] as Awaited<
      ReturnType<typeof connection.metadata.list>
    >);
  try {
    const catalog = await runtime.runPromise(OrgMetadataCatalog);
    expect(await runtime.runPromise(catalog.hasTypeInventory('ApexClass'))).toBe(false);
    expect(await runtime.runPromise(catalog.getChildren({ type: 'ApexClass' }, { consistency: 'cache-only' }))).toEqual(
      []
    );
    const resolved = await runtime.runPromise(
      catalog.resolveComponents([
        { type: 'ApexClass', fullName: 'Local' },
        { type: 'ApexClass', fullName: 'Remote' }
      ])
    );
    expect(resolved.map(value => value.presence)).toEqual(['both', 'org']);
    expect(resolved[0]?.preferredUri.scheme).toBe('file');
    expect(resolved[1]?.preferredUri.scheme).toBe('sf-org-metadata');
    expect(list).not.toHaveBeenCalled();
    const entries = await runtime.runPromise(catalog.getEntries([{ type: 'ApexClass', fullName: 'Remote' }]));
    expect(entries[0]).toMatchObject({ reference: { type: 'ApexClass', fullName: 'Remote' }, inOrg: true });
    // Consumer discovery is a partial observation, not a complete type inventory.
    expect(await runtime.runPromise(catalog.hasTypeInventory('ApexClass'))).toBe(false);
    await runtime.runPromise(catalog.getChildren({ type: 'ApexClass' }));
    expect(await runtime.runPromise(catalog.hasTypeInventory('ApexClass'))).toBe(true);
    expect(list).toHaveBeenCalledTimes(1);
    list.mockResolvedValue([{ type: 'ApexClass', fullName: 'Fresh' }] as Awaited<
      ReturnType<typeof connection.metadata.list>
    >);
    expect(
      (
        await runtime.runPromise(
          catalog.getEntries([{ type: 'ApexClass', fullName: 'Fresh' }], { consistency: 'refresh' })
        )
      )[0]
    ).toMatchObject({ reference: { type: 'ApexClass', fullName: 'Fresh' } });
    expect(list).toHaveBeenCalledTimes(2);
    await runtime.dispose();
    expect(Exit.isFailure(await Effect.runPromiseExit(catalog.getChildren()))).toBe(true);
  } finally {
    await runtime.dispose();
  }
});

it('registers one real text provider, reads native Tooling source, notifies requested documents, and disposes the registration', async () => {
  const { runtime, connection } = await start(true);
  installApexReader(connection);
  const provider = registeredProvider();
  const uri = URI.parse(`sf-org-metadata:/orgs/${orgId}/ApexClass/Remote.cls`);
  const changed = Promise.withResolvers<string>();
  assert.ok(provider.onDidChange);
  const listener = provider.onDidChange(value => changed.resolve(value.toString()));
  try {
    expect(await provider.provideTextDocumentContent(uri, providerToken)).toBe('public class Remote {}');
    await runtime.runPromise(
      OrgMetadataCatalogChangePubSub.pipe(
        Effect.flatMap(pubsub =>
          PubSub.publish(pubsub, {
            kind: 'tracking',
            orgId,
            references: [{ xmlName: 'ApexClass', fullName: 'Remote' }]
          })
        )
      )
    );
    expect(await changed.promise).toBe(uri.toString());
    expect(vscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalledTimes(1);
    await runtime.dispose();
    expect(registrationDisposals).toBe(1);
    await expect(Promise.resolve(provider.provideTextDocumentContent(uri, providerToken))).rejects.toBeDefined();
  } finally {
    listener.dispose();
    await runtime.dispose();
  }
});

it('excludes .sf changes and invalidates workspace inventory before notifying open org documents', async () => {
  const { runtime, connection, state } = await start(true);
  installApexReader(connection);
  const provider = registeredProvider();
  const uri = URI.parse(`sf-org-metadata:/orgs/${orgId}/ApexClass/Remote.cls`);
  const events: URI[] = [];
  assert.ok(provider.onDidChange);
  const listener = provider.onDidChange(value => events.push(URI.parse(value.toString())));
  try {
    await provider.provideTextDocumentContent(uri, providerToken);
    expect(await runtime.runPromise(state.getInventory(orgId, 'ApexClass'))).toBeDefined();
    const files = await runtime.runPromise(FileChangePubSub);
    await runtime.runPromise(
      PubSub.publish(files, {
        type: 'change' as const,
        uri: Utils.joinPath(root, '.sf', 'orgs', orgId, 'metadata-shadow', 'internal')
      })
    );
    await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
    expect(events).toEqual([]);
    const changed = Promise.withResolvers<void>();
    const invalidated: boolean[] = [];
    const stateRead = state.getInventory;
    const observation = provider.onDidChange(() =>
      Effect.runPromise(stateRead(orgId, 'ApexClass')).then(
        value => {
          invalidated.push(value === undefined);
          changed.resolve();
        },
        error => changed.reject(error)
      )
    );
    try {
      await runtime.runPromise(
        PubSub.publish(files, {
          type: 'change' as const,
          uri: Utils.joinPath(root, 'force-app', 'main', 'default', 'classes', 'Local.cls')
        })
      );
      await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
      await changed.promise;
      expect(invalidated).toEqual([true]);
      expect(events.map(value => value.toString())).toEqual([uri.toString()]);
    } finally {
      observation.dispose();
    }
  } finally {
    listener.dispose();
    await runtime.dispose();
  }
});

it.each([false, true])(
  'defers active-operation workspace events and correlates metadata notification paths, matched=%s',
  async matched => {
    const { runtime, connection, state } = await start(true);
    installApexReader(connection);
    const provider = registeredProvider();
    const uri = URI.parse(`sf-org-metadata:/orgs/${orgId}/ApexClass/Remote.cls`);
    const events: string[] = [];
    const notified = Promise.withResolvers<void>();
    assert.ok(provider.onDidChange);
    const listener = provider.onDidChange(value => {
      events.push(value.toString());
      notified.resolve();
    });
    try {
      await provider.provideTextDocumentContent(uri, providerToken);
      const active = await runtime.runPromise(ActiveMetadataOperationRef);
      const files = await runtime.runPromise(FileChangePubSub);
      const metadata = await runtime.runPromise(MetadataChangeNotificationService);
      const source = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes', 'Local.cls');
      await runtime.runPromise(SubscriptionRef.set(active, 1));
      await runtime.runPromise(PubSub.publish(files, { type: 'change' as const, uri: source }));
      await runtime.runPromise(TestClock.adjust(Duration.millis(125)));
      expect(events).toEqual([]);
      expect(await runtime.runPromise(state.getInventory(orgId, 'ApexClass'))).toBeDefined();
      if (matched)
        await runtime.runPromise(
          metadata.publishOperation({
            orgId,
            operation: 'retrieve',
            completedAt: '2026-10-30T00:00:00.000Z',
            changes: [
              {
                metadataType: 'ApexClass',
                fullName: 'Local',
                changeType: 'changed',
                fileUri: Option.some(source)
              }
            ]
          })
        );
      await runtime.runPromise(SubscriptionRef.set(active, 0));
      await runtime.runPromise(TestClock.adjust(Duration.millis(125)));
      if (!matched) await notified.promise;
      expect(events).toEqual(matched ? [] : [uri.toString()]);
    } finally {
      listener.dispose();
      await runtime.dispose();
    }
  }
);

it('closes inactive org text/diff tabs on clear, keeps workspace tabs, and stops notifying removed requests', async () => {
  const { runtime, connection } = await start(true);
  installApexReader(connection);
  const provider = registeredProvider();
  const uri = URI.parse(`sf-org-metadata:/orgs/${orgId}/ApexClass/Remote.cls`);
  const workspaceUri = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes', 'Local.cls');
  const orgTab = { input: new vscode.TabInputText(uri) } as vscode.Tab;
  const workspaceTab = { input: new vscode.TabInputText(workspaceUri) } as vscode.Tab;
  const diffTab = { input: new vscode.TabInputTextDiff(uri, workspaceUri) } as vscode.Tab;
  const previousTabs = Object.getOwnPropertyDescriptor(vscode.window, 'tabGroups');
  const closed = Promise.withResolvers<readonly vscode.Tab[]>();
  Object.defineProperty(vscode.window, 'tabGroups', {
    configurable: true,
    value: {
      all: [{ tabs: [orgTab, workspaceTab, diffTab] }],
      close: (tabs: readonly vscode.Tab[]) => {
        closed.resolve(tabs);
        return Promise.resolve(true);
      }
    }
  });
  const notifications: string[] = [];
  assert.ok(provider.onDidChange);
  const listener = provider.onDidChange(value => notifications.push(value.toString()));
  try {
    await provider.provideTextDocumentContent(uri, providerToken);
    await runtime.runPromise(OrgChanges.use(changes => changes.clear));
    expect(await closed.promise).toEqual([orgTab, diffTab]);
    await expect(Promise.resolve(provider.provideTextDocumentContent(uri, providerToken))).rejects.toBeDefined();
    await runtime.runPromise(
      OrgMetadataCatalogChangePubSub.pipe(
        Effect.flatMap(pubsub => PubSub.publish(pubsub, { kind: 'tracking', orgId, references: [] }))
      )
    );
    expect(notifications).toEqual([]);
  } finally {
    listener.dispose();
    await runtime.dispose();
    if (previousTabs) Object.defineProperty(vscode.window, 'tabGroups', previousTabs);
    else Reflect.deleteProperty(vscode.window, 'tabGroups');
  }
});

it('projects only the explicit public keys from one owning graph and shares native SDK identity with its legacy host', async () => {
  const owner = await createCatalogRuntime(catalogProviderLayers.pipe(Layer.provide(hostLayers), Layer.orDie), text =>
    text.replaceAll('fixture-secret', '<redacted>')
  );
  const api: SalesforceVSCodeServicesApiV2 = owner;
  const services = api.v2.services;
  const context = services.prebuiltServicesDependencies;
  try {
    expect([...context.mapUnsafe.keys()].toSorted()).toEqual(
      Object.values(publicServiceKeys)
        .map(key => key.key)
        .toSorted()
    );
    expect(Option.isNone(Context.getOption(context, OrgChanges))).toBe(true);
    expect(Option.isNone(Context.getOption(context, OrgCatalogState))).toBe(true);
    expect(services.OrgMetadataCatalog).toBe(OrgMetadataCatalog);
    const legacy = await owner.host.getConnection(undefined, new AbortController().signal);
    assert.equal(legacy._tag, 'Success');
    const direct = await Effect.runPromise(
      ConnectionService.use(service => service.getConnection()).pipe(Effect.provide(services.prebuiltServicesLayer))
    );
    expect(direct).toBe(legacy.value);
    expect(direct).toBeInstanceOf(Connection);
    const project = await Effect.runPromise(Context.get(context, ProjectService).getSfProject());
    expect(project.getPath()).toBe(root.fsPath);
    expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(1);
    expect(vscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalledTimes(1);
    expect(await owner.dispose()).toEqual({ _tag: 'Success', value: undefined });
    expect(await owner.dispose()).toEqual({ _tag: 'Success', value: undefined });
    expect(registrationDisposals).toBe(1);
    expect(Exit.isFailure(await Effect.runPromiseExit(Context.get(context, OrgMetadataCatalog).getChildren()))).toBe(
      true
    );
  } finally {
    await owner.dispose();
  }
});
