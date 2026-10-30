/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Global, Org, SfProject, StateAggregator } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import {
  ComponentSet,
  ComponentStatus,
  DeployResult,
  RequestStatus,
  RetrieveResult
} from '@salesforce/source-deploy-retrieve';
import { SourceTracking } from '@salesforce/source-tracking';
import { ShadowRepo } from '@salesforce/source-tracking/lib/shared/local/localShadowRepo.js';
import { RemoteSourceTrackingService } from '@salesforce/source-tracking/lib/shared/remote/remoteSourceTrackingService.js';
import {
  ConnectionService,
  MetadataDescribeService,
  OrgId,
  OrgMetadataCatalogChangePubSub,
  SourceTrackingService
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import assert from 'node:assert/strict';
import type * as FsPromises from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { catalogReaderLayers } from '../../src/catalogLayers.js';
import { ConnectionHost } from '../../src/connectionHost.js';
import { MetadataDescribeInvalidation } from '../../src/metadataDescribeService.js';
import { MetadataOperationOrg } from '../../src/metadataOperationOrg.js';
import { OrgCatalogState } from '../../src/orgCatalog/orgCatalogState.js';
import { trackingCacheOwnership } from '../../src/sourceTrackingCacheOwnership.js';
import { SourceTrackingResultUpdates } from '../../src/sourceTrackingService.js';
import { OrgChanges } from '../../src/targetOrgRef.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';
import { installVscodeFs } from '../support/vscodeFs.js';

const originalFs = coreFs.fs;
const sdkCreateConnection = Connection.create.bind(Connection);
const orgId = Schema.decodeUnknownSync(OrgId)('00D000000000001');
const directories: string[] = [];
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
const graph = catalogReaderLayers.pipe(
  Layer.provide(Layer.merge(host, Layer.succeed(WebFileSystemProvider, { get: () => undefined })))
);
const jsonResponse = <T>(promise: Promise<T>) =>
  Object.assign(promise, {
    stream: () => {
      throw new Error('JSON fixture only');
    }
  });
const member = (name: string, revision = 1, deleted = false) => ({
  MemberIdOrName: name,
  MemberType: 'ApexClass',
  MemberName: name,
  IsNameObsolete: deleted,
  IsNewMember: true,
  RevisionCounter: revision,
  ChangedBy: '005000000000001',
  LastModifiedDate: '2026-10-30T00:00:00.000Z'
});
let members: ReturnType<typeof member>[];
const nativeCache = (constructor: object): Map<unknown, unknown> => {
  const instances: unknown = Reflect.get(constructor, 'instanceMap');
  assert.ok(instances instanceof Map);
  return instances;
};
const start = async (enabled = true) => {
  const directory = await mkdtemp(`${process.env.RUNNER_TEMP ?? tmpdir()}/v4-tracking-`);
  directories.push(directory);
  const root = URI.file(directory);
  vi.stubEnv('HOME', directory);
  vi.spyOn(Global, 'SF_DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sf').fsPath);
  vi.spyOn(Global, 'SFDX_DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sfdx').fsPath);
  vi.spyOn(Global, 'DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sfdx').fsPath);
  const classes = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes');
  await coreFs.fs.promises.mkdir(classes.fsPath, { recursive: true });
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(root, 'sfdx-project.json').fsPath,
    JSON.stringify({
      packageDirectories: [{ path: 'force-app', default: true }],
      namespace: '',
      sourceApiVersion: '67.0'
    })
  );
  await coreFs.fs.promises.mkdir(Utils.joinPath(root, '.sf').fsPath, { recursive: true });
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(root, '.sf', 'config.json').fsPath,
    '{"target-org":"tracking@example.com","org-api-version":"67.0"}'
  );
  const source = Utils.joinPath(classes, 'Local.cls');
  await coreFs.fs.promises.writeFile(source.fsPath, 'public class Local {}');
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(classes, 'Local.cls-meta.xml').fsPath,
    '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>67.0</apiVersion><status>Active</status></ApexClass>'
  );
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri: root, name: 'tracking', index: 0 }]
  });
  await coreFs.fs.promises.mkdir(Global.SF_DIR, { recursive: true });
  await coreFs.fs.promises.mkdir(Global.SFDX_DIR, { recursive: true });
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(URI.file(Global.SF_DIR), 'config.json').fsPath,
    '{"target-org":"tracking@example.com","org-api-version":"67.0"}'
  );
  await coreFs.fs.promises.writeFile(Utils.joinPath(URI.file(Global.SFDX_DIR), 'alias.json').fsPath, '{"orgs":{}}');
  const auth = await AuthInfo.create({
    accessTokenOptions: {
      instanceUrl: 'https://fixture.example',
      accessToken: 'fixture-secret',
      username: 'tracking@example.com',
      orgId,
      isDevHub: false,
      namespacePrefix: '',
      isScratch: true,
      isSandbox: false
    }
  });
  auth.update({ refreshToken: 'fixture-refresh-secret', tracksSource: enabled });
  await auth.save();
  const runtime = ManagedRuntime.make(graph);
  const connection = await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
  return { runtime, connection, service: await runtime.runPromise(SourceTrackingService), root, source };
};
beforeEach(async () => {
  vi.stubEnv('FORCE_MEMFS', 'false');
  vi.stubEnv('ESBUILD_PLATFORM', 'node');
  vi.stubEnv('SF_USE_GENERIC_UNIX_KEYCHAIN', 'true');
  coreFs.setFs(coreFs.getVirtualFs());
  SfProject.clearInstances();
  await StateAggregator.clearInstanceAsync();
  installVscodeFs(coreFs.fs.promises as typeof FsPromises);
  members = [];
  vi.spyOn(Connection, 'create').mockImplementation(options =>
    sdkCreateConnection({ ...options, connectionOptions: { version: '67.0' } })
  );
  vi.spyOn(Connection.prototype, 'retrieveMaxApiVersion').mockResolvedValue('67.0');
  vi.spyOn(Connection.prototype, 'request').mockImplementation(function (this: Connection, options) {
    const url = decodeURIComponent(typeof options === 'string' ? options : options.url).replaceAll('+', ' ');
    const records = url.includes('FROM SourceMember')
      ? members
      : [{ Id: '005000000000001', Username: this.getUsername(), Name: 'Tracking User' }];
    return jsonResponse(Promise.resolve({ totalSize: records.length, done: true, records }));
  });
  vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
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
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

it('uses actual SDK local/remote status and ComponentSets; preserves flags and durable files on disposal', async () => {
  const { runtime, connection, service, root } = await start();
  const create = vi.spyOn(SourceTracking, 'create');
  const localChanges = vi.spyOn(SourceTracking.prototype, 'localChangesAsComponentSet');
  const remoteChanges = vi.spyOn(SourceTracking.prototype, 'remoteNonDeletesAsComponentSet');
  const remove = vi.spyOn(ShadowRepo.prototype, 'delete');
  members = [member('Remote'), member('Deleted', 2, true)];
  try {
    expect(await runtime.runPromise(service.hasTracking())).toBe(true);
    expect(create).not.toHaveBeenCalled();
    const local = await runtime.runPromise(service.getLocalChangesAsComponentSet());
    expect(local).toHaveLength(1);
    expect(local[0]).toBeInstanceOf(ComponentSet);
    expect((await local[0]!.getObject()).Package.types).toContainEqual({ name: 'ApexClass', members: ['Local'] });
    expect(localChanges).toHaveBeenCalledWith(false);
    const remote = await runtime.runPromise(service.getRemoteNonDeletesAsComponentSet({ applyIgnore: true }));
    expect((await remote.getObject()).Package.types).toContainEqual({ name: 'ApexClass', members: ['Remote'] });
    expect(remoteChanges).toHaveBeenCalledWith({ applyIgnore: true });
    expect(
      (await (await runtime.runPromise(service.getRemoteDeletesAsComponentSet())).getObject()).Package.types
    ).toContainEqual({ name: 'ApexClass', members: ['Deleted'] });
    const status = await runtime.runPromise(service.getStatus({ local: true, remote: true }));
    expect(status).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fullName: 'Local', origin: 'local' }),
        expect.objectContaining({ fullName: 'Remote', origin: 'remote' })
      ])
    );
    expect(create).toHaveBeenCalledTimes(1);
    const native: unknown = await create.mock.results[0]!.value;
    expect(native).toBeInstanceOf(SourceTracking);
    expect(create.mock.calls[0]![0]).toMatchObject({ subscribeSDREvents: false, ignoreConflicts: false });
    const options = create.mock.calls[0]![0];
    assert.ok(typeof options === 'object' && options !== null && 'org' in options && options.org instanceof Org);
    expect(options.org.getConnection()).toBe(connection);
    expect(nativeCache(ShadowRepo).has(root.fsPath)).toBe(true);
    await runtime.dispose();
    expect(nativeCache(ShadowRepo).has(root.fsPath)).toBe(false);
    expect(nativeCache(RemoteSourceTrackingService).has(orgId)).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(
      String(
        await coreFs.fs.promises.readFile(
          Utils.joinPath(root, '.sf', 'orgs', orgId, 'localSourceTracking', 'config').fsPath
        )
      )
    ).toContain('repositoryformatversion');
    expect(Exit.isFailure(await Effect.runPromiseExit(service.getLocalChangesAsComponentSet()))).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it('treats unknown capability as unknown and keeps disabled updates as no-ops', async () => {
  const { runtime, service } = await start(false);
  const create = vi.spyOn(SourceTracking, 'create');
  try {
    expect(await runtime.runPromise(service.hasTracking())).toBe(false);
    const retrieve = new RetrieveResult(
      {
        success: true,
        fileProperties: [],
        done: true,
        id: '09S000000000001',
        status: RequestStatus.Succeeded,
        zipFile: ''
      },
      new ComponentSet()
    );
    const deploy = new DeployResult(
      { success: true } as ConstructorParameters<typeof DeployResult>[0],
      new ComponentSet()
    );
    await runtime.runPromise(service.maybeUpdateTrackingFromRetrieve(retrieve));
    await runtime.runPromise(service.maybeUpdateTrackingFromDeploy(deploy));
    expect(await runtime.runPromise(service.getLocalChangesAsComponentSet().pipe(Effect.flip))).toMatchObject({
      _tag: 'SourceTrackingNotEnabledError'
    });
    expect(create).not.toHaveBeenCalled();
    await runtime.runPromise(
      OrgChanges.use(changes =>
        changes.begin.pipe(
          Effect.flatMap(generation =>
            changes.update(generation, snapshot => Effect.succeed({ ...snapshot.org, tracksSource: undefined }))
          )
        )
      )
    );
    const tracks = vi.spyOn(Org.prototype, 'tracksSource');
    expect(await runtime.runPromise(service.hasTracking())).toBe(false);
    expect(tracks).toHaveBeenCalled();
  } finally {
    await runtime.dispose();
  }
});

it.each(['cancel', 'dispose'] as const)(
  'awaits a real native local operation before %s releases its lease/cache',
  async mode => {
    const { runtime, service, root } = await start();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    // eslint-disable-next-line vitest/unbound-method -- The native method is invoked with .call(this) below.
    const nativeLocal = SourceTracking.prototype.localChangesAsComponentSet;
    vi.spyOn(SourceTracking.prototype, 'localChangesAsComponentSet').mockImplementationOnce(async function (
      this: SourceTracking,
      byPackageDir
    ) {
      entered.resolve();
      await release.promise;
      return nativeLocal.call(this, byPackageDir);
    });
    const controller = new AbortController();
    let finished = false;
    const reading = runtime.runPromise(service.getLocalChangesAsComponentSet().pipe(Effect.exit), {
      signal: controller.signal
    });
    // The runtime AbortSignal interrupts outside .exit; normalize only the test's observation of cancellation.
    const settled = reading.then(
      value => value,
      error => error as unknown
    );
    try {
      await entered.promise;
      const stopping = mode === 'dispose' ? runtime.dispose() : Promise.resolve(controller.abort());
      const drained = Promise.all([stopping, settled]).then(value => {
        finished = true;
        return value;
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(finished).toBe(false);
      expect(nativeCache(ShadowRepo).has(root.fsPath)).toBe(true);
      release.resolve();
      await drained;
      await runtime.dispose();
      expect(nativeCache(ShadowRepo).has(root.fsPath)).toBe(false);
      expect(
        String(
          await coreFs.fs.promises.readFile(
            Utils.joinPath(root, '.sf', 'orgs', orgId, 'localSourceTracking', 'config').fsPath
          )
        )
      ).toContain('repositoryformatversion');
    } finally {
      release.resolve();
      await settled;
      await runtime.dispose();
    }
  }
);

it('retires reused leases before epoch/credential replacement without reviving stale observations', async () => {
  const { runtime, service } = await start();
  const create = vi.spyOn(SourceTracking, 'create');
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    await runtime.runPromise(service.getLocalChangesAsComponentSet());
    // eslint-disable-next-line vitest/unbound-method -- The native method is invoked with .call(this) below.
    const nativeLocal = SourceTracking.prototype.localChangesAsComponentSet;
    vi.spyOn(SourceTracking.prototype, 'localChangesAsComponentSet').mockImplementationOnce(async function (
      this: SourceTracking,
      byPackageDir
    ) {
      entered.resolve();
      await release.promise;
      return nativeLocal.call(this, byPackageDir);
    });
    const previous = runtime.runPromise(service.getLocalChangesAsComponentSet().pipe(Effect.flip));
    await entered.promise;
    await runtime.runPromise(OrgChanges.use(changes => changes.clear));
    await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    const replacing = runtime.runPromise(service.getLocalChangesAsComponentSet());
    await Promise.resolve();
    await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(1);
    release.resolve();
    expect(await previous).toMatchObject({ _tag: 'InactiveOrgOperationError' });
    expect((await replacing)[0]).toBeInstanceOf(ComponentSet);
    expect(create).toHaveBeenCalledTimes(2);
    const generation = (await runtime.runPromise(OrgChanges.use(changes => changes.snapshot))).orgGeneration;
    await runtime.runPromise(ConnectionService.use(connections => connections.invalidateCachedConnections()));
    await runtime.runPromise(service.getLocalChangesAsComponentSet());
    expect(create).toHaveBeenCalledTimes(3);
    expect((await runtime.runPromise(OrgChanges.use(changes => changes.snapshot))).orgGeneration).toBe(generation);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('invalidates describe before tracking publication and retries failed invalidation without consuming the signature', async () => {
  const { runtime, connection, service } = await start();
  const listing = vi
    .spyOn(connection.metadata, 'list')
    .mockResolvedValue([{ fullName: 'Remote', type: 'ApexClass' }] as Awaited<
      ReturnType<typeof connection.metadata.list>
    >);
  members = [member('Remote')];
  try {
    const descriptions = await runtime.runPromise(MetadataDescribeService);
    const invalidation = await runtime.runPromise(MetadataDescribeInvalidation);
    const nativeInvalidation = invalidation.invalidateForTracking;
    const state = await runtime.runPromise(OrgCatalogState);
    await runtime.runPromise(descriptions.listMetadata('ApexClass'));
    const failure = new Error('invalidation defect');
    vi.spyOn(invalidation, 'invalidateForTracking')
      .mockImplementationOnce(() => Effect.die(failure))
      .mockImplementation(nativeInvalidation);
    expect(Exit.isFailure(await runtime.runPromise(service.getStatus({ remote: true }).pipe(Effect.exit)))).toBe(true);
    expect((await runtime.runPromise(state.getTracking(orgId))).identityOrder).toEqual([]);
    await runtime.runPromise(
      Effect.gen(function* () {
        const subscription = yield* OrgMetadataCatalogChangePubSub.pipe(Effect.flatMap(PubSub.subscribe));
        yield* service.getStatus({ remote: true });
        expect(yield* PubSub.take(subscription)).toMatchObject({
          kind: 'tracking',
          orgId,
          references: [{ xmlName: 'ApexClass', fullName: 'Remote' }]
        });
        yield* descriptions.listMetadata('ApexClass');
        expect(listing).toHaveBeenCalledTimes(2);
      }).pipe(Effect.scoped)
    );
  } finally {
    await runtime.dispose();
  }
});

it('does not republish identical tracking observations but observes revision-only changes', async () => {
  const { runtime, service } = await start();
  members = [member('Remote')];
  try {
    await runtime.runPromise(service.getStatus({ remote: true }));
    await runtime.runPromise(
      Effect.gen(function* () {
        const subscription = yield* OrgMetadataCatalogChangePubSub.pipe(Effect.flatMap(PubSub.subscribe));
        yield* service.getStatus({ remote: true });
        expect(yield* PubSub.remaining(subscription)).toBe(0);
        members = [member('Remote', 2)];
        yield* service.getStatus({ remote: true });
        expect(yield* PubSub.take(subscription)).toMatchObject({
          kind: 'tracking',
          orgId,
          references: [{ xmlName: 'ApexClass', fullName: 'Remote' }]
        });
      }).pipe(Effect.scoped)
    );
  } finally {
    await runtime.dispose();
  }
});

it('acknowledges missing-local remote deletes through native tracking and exposes synthetic deleted responses', async () => {
  const { runtime, service } = await start();
  members = [member('Missing', 1, true), member('Remote', 2)];
  const update = vi.spyOn(SourceTracking.prototype, 'updateRemoteTracking');
  try {
    const result = await runtime.runPromise(service.maybeApplyRemoteDeletesToLocal());
    expect(result.fileResponsesFromDelete).toContainEqual({
      type: 'ApexClass',
      fullName: 'Missing',
      state: ComponentStatus.Deleted,
      filePath: ''
    });
    expect(update).toHaveBeenCalledWith(
      [{ type: 'ApexClass', fullName: 'Missing', state: ComponentStatus.Deleted }],
      true
    );
    expect((await runtime.runPromise(service.getRemoteDeletesAsComponentSet())).size).toBe(0);
    expect(await runtime.runPromise(service.resetRemoteTracking())).toBe(2);
  } finally {
    await runtime.dispose();
  }
});

it('uses native conflict rows, checks expected org before work, and preserves the conflict channel/error contract', async () => {
  const { runtime, service } = await start();
  members = [member('Local')];
  const nativeConflicts = vi.spyOn(SourceTracking.prototype, 'getConflicts');
  try {
    expect(
      await runtime.runPromise(
        service.getConflicts(Schema.decodeUnknownSync(OrgId)('00D000000000002')).pipe(Effect.flip)
      )
    ).toMatchObject({ _tag: 'InactiveOrgOperationError' });
    expect(nativeConflicts).not.toHaveBeenCalled();
    const conflicts = await runtime.runPromise(service.getConflicts(orgId));
    expect(conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Local', type: 'ApexClass' })]));
    expect(await runtime.runPromise(service.checkConflicts(orgId).pipe(Effect.flip))).toMatchObject({
      _tag: 'SourceTrackingConflictError',
      conflicts: conflicts.slice(0, 30).map(row => `${row.type}:${row.name} (${(row.filenames ?? []).join(', ')})`)
    });
    expect(vi.mocked(vscode.window.createOutputChannel).mock.results[0]?.value.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Conflicts detected')
    );
  } finally {
    await runtime.dispose();
  }
});

it('passes actual retrieve/deploy results to STL and updates native local and remote tracking', async () => {
  const { runtime, service, source } = await start();
  members = [member('Local')];
  const retrieveUpdate = vi.spyOn(SourceTracking.prototype, 'updateTrackingFromRetrieve');
  const deployUpdate = vi.spyOn(SourceTracking.prototype, 'updateTrackingFromDeploy');
  const remoteUpdate = vi.spyOn(SourceTracking.prototype, 'updateRemoteTracking');
  try {
    const components = ComponentSet.fromSource(source.fsPath);
    await runtime.runPromise(service.getStatus({ local: true, remote: true }));
    const retrieve = new RetrieveResult(
      {
        success: true,
        fileProperties: [],
        done: true,
        id: '09S000000000001',
        status: RequestStatus.Succeeded,
        zipFile: ''
      },
      components,
      components
    );
    expect(retrieve.getFileResponses()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fullName: 'Local', type: 'ApexClass', filePath: source.fsPath })
      ])
    );
    await runtime.runPromise(service.maybeUpdateTrackingFromRetrieve(retrieve, orgId));
    expect(retrieveUpdate).toHaveBeenCalledWith(retrieve);
    expect(remoteUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ fullName: 'Local', type: 'ApexClass' })]),
      true
    );
    expect(await runtime.runPromise(service.getStatus({ local: true, remote: true }))).toEqual([]);
    await coreFs.fs.promises.writeFile(source.fsPath, 'public class Local { /* deployed */ }');
    members = [member('Local', 2)];
    const deploy = new DeployResult(
      {
        success: true,
        details: {
          componentSuccesses: [
            {
              fullName: 'Local',
              componentType: 'ApexClass',
              fileName: source.fsPath,
              success: true,
              changed: true,
              created: false,
              deleted: false
            }
          ]
        }
      } as ConstructorParameters<typeof DeployResult>[0],
      components
    );
    expect(deploy.getFileResponses()).toEqual(
      expect.arrayContaining([expect.objectContaining({ fullName: 'Local', type: 'ApexClass' })])
    );
    await runtime.runPromise(service.maybeUpdateTrackingFromDeploy(deploy));
    expect(deployUpdate).toHaveBeenCalledWith(deploy);
    expect(remoteUpdate).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ fullName: 'Local', type: 'ApexClass' })])
    );
    expect(await runtime.runPromise(service.getStatus({ local: true, remote: true }))).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});

it('preserves foreign native cache entries instead of evicting another SDK owner during disposal', async () => {
  const { runtime, service, root } = await start();
  try {
    await runtime.runPromise(service.getLocalChangesAsComponentSet());
    const cache = nativeCache(ShadowRepo);
    const owned = cache.get(root.fsPath);
    assert.ok(owned instanceof ShadowRepo);
    const replacement = Object.create(Object.getPrototypeOf(owned)) as unknown;
    cache.set(root.fsPath, replacement);
    await runtime.dispose();
    expect(cache.get(root.fsPath)).toBe(replacement);
    // Fixture owns its replacement and removes it after the preservation assertion.
    cache.delete(root.fsPath);
  } finally {
    await runtime.dispose();
  }
});

it('does not claim a foreign ShadowRepo acquired after lazy SourceTracking creation', async () => {
  const { runtime, connection, root } = await start();
  try {
    const project = await SfProject.resolve(root.fsPath);
    const tracking = await SourceTracking.create({
      org: await Org.create({ connection }),
      project,
      subscribeSDREvents: false
    });
    const ownership = trackingCacheOwnership(tracking, orgId);
    const foreign = await ShadowRepo.getInstance({
      orgId,
      projectPath: root.fsPath,
      registry: tracking.registry,
      packageDirs: project.getPackageDirectories()
    });
    try {
      await ownership.run(() => tracking.reReadLocalTrackingCache(), 'local');
      ownership.release();
      expect(nativeCache(ShadowRepo).get(root.fsPath)).toBe(foreign);
    } finally {
      nativeCache(ShadowRepo).delete(root.fsPath);
    }
  } finally {
    await runtime.dispose();
  }
});

it.each(['retrieve', 'deploy'] as const)(
  'retains the original captured epoch when a %s result triggers A→empty→A before tracking acquisition',
  async mode => {
    const { runtime, service } = await start();
    const retrieve = new RetrieveResult(
      {
        success: true,
        fileProperties: [],
        done: true,
        id: '09S000000000001',
        status: RequestStatus.Succeeded,
        zipFile: ''
      },
      new ComponentSet()
    );
    const deploy = new DeployResult(
      { success: true } as ConstructorParameters<typeof DeployResult>[0],
      new ComponentSet()
    );
    const nativeRetrieve = vi.spyOn(SourceTracking.prototype, 'updateTrackingFromRetrieve');
    const nativeDeploy = vi.spyOn(SourceTracking.prototype, 'updateTrackingFromDeploy');
    const result = mode === 'retrieve' ? retrieve : deploy;
    vi.spyOn(result, 'getFileResponses').mockImplementationOnce(() => {
      // Complete the selection change before a second capture could run; no competing auth-attempt race.
      runtime.runSync(
        OrgChanges.use(changes =>
          changes.snapshot.pipe(
            Effect.flatMap(snapshot =>
              changes.clear.pipe(
                Effect.andThen(changes.begin),
                Effect.flatMap(generation => changes.update(generation, () => Effect.succeed(snapshot.org)))
              )
            )
          )
        )
      );
      return [];
    });
    try {
      expect(
        await runtime.runPromise(
          (mode === 'retrieve'
            ? service.maybeUpdateTrackingFromRetrieve(retrieve, orgId)
            : service.maybeUpdateTrackingFromDeploy(deploy)
          ).pipe(Effect.flip)
        )
      ).toMatchObject({ _tag: 'InactiveOrgOperationError' });
      expect(nativeRetrieve).not.toHaveBeenCalled();
      expect(nativeDeploy).not.toHaveBeenCalled();
    } finally {
      await runtime.dispose();
    }
  }
);

const clearAndRestoreOrg = Effect.fn('test.clearAndRestoreOrg')(function* () {
  const changes = yield* OrgChanges;
  const snapshot = yield* changes.snapshot;
  yield* changes.clear;
  yield* changes.begin.pipe(
    Effect.flatMap(generation => changes.update(generation, () => Effect.succeed(snapshot.org)))
  );
});

it.each(['retrieve', 'deploy'] as const)(
  'rejects a %s operation identity captured before A→empty→A without entering the native tracking method',
  async mode => {
    const { runtime } = await start();
    try {
      const captured = await runtime.runPromise(MetadataOperationOrg.use(org => org.capture()));
      const updates = await runtime.runPromise(SourceTrackingResultUpdates);
      const retrieve = new RetrieveResult(
        {
          success: true,
          done: true,
          id: '09S000000000001',
          status: RequestStatus.Succeeded,
          zipFile: '',
          fileProperties: []
        },
        new ComponentSet()
      );
      const deploy = new DeployResult(
        { success: true } as ConstructorParameters<typeof DeployResult>[0],
        new ComponentSet()
      );
      const nativeRetrieve = vi.spyOn(SourceTracking.prototype, 'updateTrackingFromRetrieve');
      const nativeDeploy = vi.spyOn(SourceTracking.prototype, 'updateTrackingFromDeploy');
      await runtime.runPromise(clearAndRestoreOrg());
      expect(
        await runtime.runPromise(
          (mode === 'retrieve'
            ? updates.maybeUpdateTrackingFromRetrieve(retrieve, captured)
            : updates.maybeUpdateTrackingFromDeploy(deploy, captured)
          ).pipe(Effect.flip)
        )
      ).toMatchObject({ _tag: 'InactiveOrgOperationError' });
      expect(nativeRetrieve).not.toHaveBeenCalled();
      expect(nativeDeploy).not.toHaveBeenCalled();
    } finally {
      await runtime.dispose();
    }
  }
);

it.each(['retrieve', 'deploy'] as const)(
  'drains the already-entered native %s tracking promise across A→empty→A, then rejects its old identity',
  async mode => {
    const { runtime, service, source, root } = await start();
    const release = Promise.withResolvers<void>();
    let updating: Promise<unknown> | undefined;
    try {
      const components = ComponentSet.fromSource(source.fsPath);
      const retrieve = new RetrieveResult(
        {
          success: true,
          done: true,
          id: '09S000000000001',
          status: RequestStatus.Succeeded,
          zipFile: '',
          fileProperties: [{ fullName: 'Local', type: 'ApexClass', fileName: source.fsPath }] as ConstructorParameters<
            typeof RetrieveResult
          >[0]['fileProperties']
        },
        components
      );
      members = [member('Local')];
      await runtime.runPromise(service.maybeUpdateTrackingFromRetrieve(retrieve, orgId));
      await coreFs.fs.promises.writeFile(source.fsPath, 'public class Local { /* changed */ }');
      members = [member('Local', 2)];
      const deploy = new DeployResult(
        {
          success: true,
          status: RequestStatus.Succeeded,
          details: {
            componentSuccesses: [
              {
                fullName: 'Local',
                componentType: 'ApexClass',
                fileName: source.fsPath,
                success: true,
                changed: true,
                created: false,
                deleted: false
              }
            ]
          }
        } as ConstructorParameters<typeof DeployResult>[0],
        components
      );
      const captured = await runtime.runPromise(MetadataOperationOrg.use(org => org.capture()));
      const updates = await runtime.runPromise(SourceTrackingResultUpdates);
      const entered = Promise.withResolvers<void>();
      // eslint-disable-next-line vitest/unbound-method -- Both actual native methods are invoked with their original receiver below.
      const nativeRetrieve = SourceTracking.prototype.updateTrackingFromRetrieve;
      // eslint-disable-next-line vitest/unbound-method -- Both actual native methods are invoked with their original receiver below.
      const nativeDeploy = SourceTracking.prototype.updateTrackingFromDeploy;
      vi.spyOn(SourceTracking.prototype, 'updateTrackingFromRetrieve').mockImplementationOnce(async function (
        this: SourceTracking,
        result
      ) {
        entered.resolve();
        await release.promise;
        return nativeRetrieve.call(this, result);
      });
      vi.spyOn(SourceTracking.prototype, 'updateTrackingFromDeploy').mockImplementationOnce(async function (
        this: SourceTracking,
        result
      ) {
        entered.resolve();
        await release.promise;
        return nativeDeploy.call(this, result);
      });
      let finished = false;
      updating = runtime
        .runPromise(
          (mode === 'retrieve'
            ? updates.maybeUpdateTrackingFromRetrieve(retrieve, captured)
            : updates.maybeUpdateTrackingFromDeploy(deploy, captured)
          ).pipe(Effect.flip)
        )
        .then(error => {
          finished = true;
          return error;
        });
      await entered.promise;
      await runtime.runPromise(clearAndRestoreOrg());
      expect(finished).toBe(false);
      expect(nativeCache(ShadowRepo).has(root.fsPath)).toBe(true);
      release.resolve();
      expect(await updating).toMatchObject({ _tag: 'InactiveOrgOperationError' });
      // The unchanged SDK may have committed files during its public promise. The wrapper must drain, not claim rollback.
      await runtime.dispose();
      expect(nativeCache(ShadowRepo).has(root.fsPath)).toBe(false);
    } finally {
      release.resolve();
      await updating;
      await runtime.dispose();
    }
  }
);

it('rejects a delayed old-epoch status before describe invalidation, signature recording, or publication', async () => {
  const { runtime, connection, service } = await start();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  // eslint-disable-next-line vitest/unbound-method -- The SDK method is invoked below with .call(this).
  const nativeStatus = SourceTracking.prototype.getStatus;
  vi.spyOn(SourceTracking.prototype, 'getStatus').mockImplementationOnce(async function (
    this: SourceTracking,
    options
  ) {
    entered.resolve();
    await release.promise;
    return nativeStatus.call(this, options);
  });
  members = [member('Remote')];
  const listing = vi
    .spyOn(connection.metadata, 'list')
    .mockResolvedValue([{ fullName: 'Remote', type: 'ApexClass' }] as Awaited<
      ReturnType<typeof connection.metadata.list>
    >);
  try {
    const reading = runtime.runPromise(service.getStatus({ remote: true }).pipe(Effect.flip));
    await entered.promise;
    await runtime.runPromise(OrgChanges.use(changes => changes.clear));
    await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    const descriptions = await runtime.runPromise(MetadataDescribeService);
    await runtime.runPromise(descriptions.listMetadata('ApexClass'));
    await runtime.runPromise(
      Effect.gen(function* () {
        const subscription = yield* OrgMetadataCatalogChangePubSub.pipe(Effect.flatMap(PubSub.subscribe));
        release.resolve();
        expect(yield* Effect.promise(() => reading)).toMatchObject({ _tag: 'InactiveOrgOperationError' });
        expect(yield* PubSub.remaining(subscription)).toBe(0);
      }).pipe(Effect.scoped)
    );
    const state = await runtime.runPromise(OrgCatalogState);
    expect((await runtime.runPromise(state.getTracking(orgId))).identityOrder).toEqual([]);
    expect(Option.isSome(await runtime.runPromise(descriptions.listMetadataCached('ApexClass')))).toBe(true);
    expect(listing).toHaveBeenCalledTimes(1);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it.each(['cancel', 'dispose'] as const)(
  'preserves native rejection identity when %s races with public-promise completion',
  async mode => {
    const { runtime, service } = await start();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<ComponentSet[]>();
    const cause = new Error('native tracking failure');
    vi.spyOn(SourceTracking.prototype, 'localChangesAsComponentSet').mockImplementationOnce(() => {
      entered.resolve();
      return release.promise;
    });
    const controller = new AbortController();
    const reading = runtime.runPromiseExit(service.getLocalChangesAsComponentSet(), { signal: controller.signal });
    try {
      await entered.promise;
      release.reject(cause);
      const disposal =
        mode === 'dispose'
          ? runtime.dispose().then(
              () => undefined,
              error => error as unknown
            )
          : Promise.resolve(controller.abort());
      const exit = await reading;
      expect(
        Exit.isFailure(exit) &&
          exit.cause.reasons.some(
            reason =>
              reason._tag === 'Fail' && reason.error._tag === 'SourceTrackingError' && reason.error.cause === cause
          )
      ).toBe(true);
      await disposal;
    } finally {
      release.reject(cause);
      await reading;
      await runtime.dispose().then(
        () => undefined,
        error => error as unknown
      );
    }
  }
);
