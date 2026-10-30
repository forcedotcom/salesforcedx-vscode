/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Global, StateAggregator } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import {
  AuthFields,
  ChannelService,
  CliId,
  ConnectionService,
  QueryService,
  SettingsChangePubSub,
  TargetOrgRef,
  authFieldsFrom
} from '@salesforce/vscode-services-v2';
import * as Duration from 'effect/Duration';
import * as Context from 'effect/Context';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as Tracer from 'effect/Tracer';
import * as TestClock from 'effect/testing/TestClock';
import * as vscode from 'vscode';
import type * as NodeFs from 'node:fs';
import { URI, Utils } from 'vscode-uri';
import { ConnectionHost } from '../../src/connectionHost.js';
import { ConnectionServiceLayer } from '../../src/connectionService.js';
import { createConnectionRuntime } from '../../src/connectionRuntime.js';
import { ConnectionWatcherLayer } from '../../src/connectionWatchers.js';
import { HostFileSystem } from '../../src/hostFileSystem.js';
import { foundationalLayers } from '../../src/foundationalLayers.js';
import { QueryServiceLayer } from '../../src/queryService.js';
import { OrgChanges } from '../../src/targetOrgRef.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';

// eslint-disable-next-line vitest/unbound-method -- Instantiate the inherited SDK factory's generics, then immediately bind its required constructor receiver.
const sdkCreateAuth = (AuthInfo.create<AuthInfo.Options, AuthInfo>).bind(AuthInfo);
const sdkCreateConnection = Connection.create.bind(Connection);
const originalFs = coreFs.fs;
const usernameA = 'v4-connection-a@example.com';
const usernameB = 'v4-connection-b@example.com';
const auths = new Map<string, AuthInfo>();
const webSettings: Record<string, unknown> = {};
const globalState = {
  get: vi.fn(),
  update: vi.fn().mockResolvedValue(undefined),
  keys: () => [],
  setKeysForSync: vi.fn()
};
const host = Layer.succeed(ConnectionHost, {
  globalState,
  messages: {
    expired: 'Access token expired or invalid.',
    expiredDetail: 'Please log in again.',
    login: 'Login',
    refreshFailed: 'Unable to refresh your access token.  Please login again.',
    orgChanged: orgId => `Org changed: ${orgId}`
  }
});
const graph = Layer.merge(
  ConnectionServiceLayer.pipe(
    Layer.provideMerge(foundationalLayers),
    Layer.provide(Layer.mergeAll(host, Layer.succeed(WebFileSystemProvider, { get: () => undefined })))
  ),
  Layer.mock(ChannelService, { appendToChannel: () => Effect.void })
);
const writeJson = async (directory: string, file: string, value: object) => {
  await coreFs.fs.promises.mkdir(directory, { recursive: true });
  await coreFs.fs.promises.writeFile(Utils.joinPath(URI.file(directory), file).fsPath, JSON.stringify(value));
};
const target = (value: string) =>
  writeJson(Global.SF_DIR, 'config.json', { 'target-org': value, 'org-api-version': '67.0' });
const initializeOrg = OrgChanges.use(changes =>
  changes.begin.pipe(
    Effect.flatMap(generation =>
      changes.update(generation, () =>
        Effect.succeed({ cliId: Schema.decodeUnknownSync(CliId)('00000000-0000-4000-8000-000000000001') })
      )
    )
  )
);
const start = async (layer = graph) => {
  const runtime = ManagedRuntime.make(layer);
  await runtime.runPromise(initializeOrg);
  return runtime;
};
const queryGraph = QueryServiceLayer.pipe(Layer.provideMerge(graph), Layer.provide(host));
const startQuery = async () => {
  const runtime = ManagedRuntime.make(queryGraph);
  await runtime.runPromise(initializeOrg);
  return runtime;
};
const getConnection = (username?: string) => ConnectionService.use(service => service.getConnection(username));
const jsonResponse = <T>(promise: Promise<T>) =>
  Object.assign(promise, {
    stream: () => {
      throw new Error('Fixture request supports JSON responses only');
    }
  });
const readOrg = TargetOrgRef.pipe(Effect.flatMap(SubscriptionRef.get));
const enriched = TargetOrgRef.pipe(
  Effect.flatMap(ref =>
    SubscriptionRef.changes(ref).pipe(
      Stream.filter(org => org.userId !== undefined),
      Stream.take(1),
      Stream.runCollect,
      Effect.timeout(Duration.seconds(2))
    )
  )
);
const queryRecords = QueryService.use(service =>
  service.query({ soql: 'SELECT Name FROM Account' }, Schema.Struct({ Name: Schema.String }))
);
const installQueryResponses = (blockNext = false) => {
  const requests: string[] = [];
  const nextStarted = Promise.withResolvers<void>();
  const nextRelease = Promise.withResolvers<void>();
  if (!blockNext) nextRelease.resolve();
  vi.mocked(Connection.prototype.request).mockImplementation(function (this: Connection, request) {
    const url = typeof request === 'string' ? request : request.url;
    const parsed = new URL(url, 'https://fixture.example');
    if (parsed.searchParams.get('q')?.includes(' FROM User ')) {
      return jsonResponse(
        Promise.resolve({
          totalSize: 1,
          done: true,
          records: [{ Id: '005000000000001', Username: this.getUsername() }]
        })
      );
    }
    requests.push(url);
    if (parsed.pathname.endsWith('/query/query-next')) {
      nextStarted.resolve();
      return jsonResponse(nextRelease.promise.then(() => ({ totalSize: 3, done: true, records: [{ Name: 'Third' }] })));
    }
    return jsonResponse(
      Promise.resolve({
        totalSize: 3,
        done: false,
        nextRecordsUrl: '/services/data/v67.0/query/query-next',
        records: [{ Name: 'First' }, { Name: 'Second' }]
      })
    );
  });
  return { requests, nextStarted, nextRelease };
};

beforeEach(async () => {
  vi.stubEnv('FORCE_MEMFS', 'true');
  vi.stubEnv('SF_USE_GENERIC_UNIX_KEYCHAIN', 'true');
  vi.stubEnv('ESBUILD_PLATFORM', 'node');
  coreFs.setFs(coreFs.getVirtualFs());
  vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined);
  globalState.update.mockResolvedValue(undefined);
  await StateAggregator.clearInstanceAsync();
  Object.keys(webSettings).forEach(key => {
    delete webSettings[key];
  });
  Object.assign(webSettings, {
    instanceUrl: 'https://fixture.example',
    accessToken: 'fixture-secret',
    apiVersion: '67.0',
    sessionContext: {
      username: usernameA,
      orgId: '00D000000000001',
      userId: '005000000000001',
      namespacePrefix: '',
      isDevHub: false,
      isScratch: false,
      isSandbox: false
    }
  });
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri: URI.file('/v4-connection-fixture'), name: 'fixture', index: 0 }]
  });
  vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(uri =>
    coreFs.fs.promises.readFile(uri.scheme === 'memfs' ? uri.path : uri.fsPath)
  );
  vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
    get: (key: string) => webSettings[key],
    update: vi.fn()
  } as unknown as vscode.WorkspaceConfiguration);
  await coreFs.fs.promises.mkdir('/v4-connection-fixture', { recursive: true });
  await target('AliasA');
  await writeJson(Global.SFDX_DIR, 'alias.json', { orgs: { AliasA: usernameA, AliasB: usernameB } });
  for (const [username, orgId] of [
    [usernameA, '00D000000000001'],
    [usernameB, '00D000000000002']
  ]) {
    const auth = await sdkCreateAuth({
      accessTokenOptions: {
        instanceUrl: 'https://fixture.example',
        accessToken: 'fixture-secret',
        username,
        orgId,
        isDevHub: false,
        namespacePrefix: '',
        isScratch: false,
        isSandbox: false
      }
    });
    auth.update({ tracksSource: true, refreshToken: 'fixture-refresh-secret' });
    auths.set(username, auth);
  }
  vi.spyOn(AuthInfo, 'create').mockImplementation((options?: AuthInfo.Options) => {
    const auth = auths.get(options?.username ?? options?.accessTokenOptions?.username ?? usernameA);
    if (!auth) throw new Error('Unknown fixture username');
    return Promise.resolve(auth);
  });
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

it('shares native SDK connections and real foundational aliases/config across calls; overrides do not select an org', async () => {
  const runtime = await start();
  try {
    const connections = await runtime.runPromise(
      Effect.all([getConnection(), getConnection('AliasA'), getConnection('AliasA')], { concurrency: 'unbounded' })
    );
    expect(connections[0]).toBeInstanceOf(Connection);
    expect(connections.every(connection => connection === connections[0])).toBe(true);
    expect(AuthInfo.create).toHaveBeenCalledTimes(1);
    expect(Connection.create).toHaveBeenCalledTimes(1);
    await runtime.runPromise(enriched);
    const before = await runtime.runPromise(readOrg);
    expect(before).toMatchObject({
      username: usernameA,
      orgId: '00D000000000001',
      aliases: ['AliasA'],
      alias: 'AliasA'
    });
    const other = await runtime.runPromise(getConnection('AliasB'));
    expect(other.getUsername()).toBe(usernameB);
    expect(await runtime.runPromise(readOrg)).toEqual(before);
    expect(
      await runtime.runPromise(ConnectionService.use(service => service.getAuthInfoFields('AliasA')))
    ).not.toHaveProperty('accessToken');
    await runtime.runPromise(ConnectionService.use(service => service.invalidateCachedConnections()));
    expect(await runtime.runPromise(getConnection('AliasA'))).not.toBe(connections[0]);
  } finally {
    await runtime.dispose();
  }
});

it('deduplicates expired-token modals by username across connection invalidation', async () => {
  const auth = auths.get(usernameA);
  if (!auth) throw new Error('Missing fixture auth');
  auth.update({ refreshToken: undefined });
  vi.spyOn(Connection.prototype, 'identity').mockRejectedValue(new Error('expired'));
  const runtime = await start();
  try {
    const exits = await runtime.runPromise(
      Effect.all([getConnection(), getConnection()], { concurrency: 'unbounded', mode: 'result' })
    );
    expect(exits.every(exit => exit._tag === 'Failure')).toBe(true);
    expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(1);
    await runtime.runPromise(ConnectionService.use(service => service.invalidateCachedConnections()));
    expect(await runtime.runPromise(getConnection().pipe(Effect.flip))).toMatchObject({
      _tag: 'AccessTokenExpiredError',
      username: usernameA
    });
    expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(Connection.prototype.identity).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it('does not publish slow earlier selection results after a newer org resolves', async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  vi.mocked(AuthInfo.create).mockImplementation(async (options?: AuthInfo.Options) => {
    if (options?.username === usernameA) {
      entered.resolve();
      await release.promise;
    }
    const auth = auths.get(options?.username ?? usernameA);
    if (!auth) throw new Error('Missing fixture auth');
    return auth;
  });
  const runtime = await start();
  try {
    const first = runtime.runPromise(getConnection());
    await entered.promise;
    await target('AliasB');
    const second = await runtime.runPromise(getConnection());
    expect(second.getUsername()).toBe(usernameB);
    release.resolve();
    await first;
    expect(await runtime.runPromise(readOrg)).toMatchObject({ username: usernameB, orgId: '00D000000000002' });
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('reuses equal redacted web cache keys and awaits in-flight persistent auth saves on shutdown', async () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const auth = auths.get(usernameA);
  if (!auth) throw new Error('Missing fixture auth');
  vi.spyOn(auth, 'save').mockImplementation(async () => {
    entered.resolve();
    await release.promise;
    return auth;
  });
  const runtime = await start();
  try {
    const first = await runtime.runPromise(getConnection('ignored'));
    await entered.promise;
    expect(await runtime.runPromise(getConnection('also-ignored'))).toBe(first);
    expect(AuthInfo.create).toHaveBeenCalledTimes(1);
    expect(auth.save).toHaveBeenCalledTimes(1);
    const disposed = vi.fn();
    const closing = runtime.dispose().then(disposed);
    await Promise.resolve();
    expect(disposed).not.toHaveBeenCalled();
    release.resolve();
    await closing;
    expect(disposed).toHaveBeenCalledTimes(1);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('closes real host admission and replays the same failing runtime-finalizer outcome to every disposer', async () => {
  const defect = new Error('runtime finalizer failed');
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const cleanup = vi.fn<() => void>();
  const layer = Layer.effectDiscard(
    Effect.addFinalizer(() =>
      Effect.promise(() => {
        entered.resolve();
        return release.promise;
      }).pipe(
        Effect.tap(() => Effect.sync(cleanup)),
        Effect.andThen(Effect.die(defect))
      )
    )
  );
  const owner = await createConnectionRuntime(Layer.mergeAll(graph, layer), text =>
    text.replaceAll('fixture-secret', '<redacted>')
  );
  const signal = new AbortController().signal;
  expect((await owner.host.getConnection('AliasA', signal))._tag).toBe('Success');
  const first = owner.dispose();
  await entered.promise;
  expect((await owner.host.getConnection('AliasA', signal))._tag).toBe('Failure');
  const second = owner.dispose();
  release.resolve();
  const exits = await Promise.all([first, second, owner.dispose()]);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(
    exits.every(
      exit => exit._tag === 'Failure' && exit.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)
    )
  ).toBe(true);
});

it('rolls back the acquired real graph when later startup fails', async () => {
  const defect = new Error('startup failed');
  const cleanup = vi.fn<() => void>();
  const failed = Layer.effectDiscard(
    OrgChanges.pipe(
      Effect.flatMap(() => Effect.addFinalizer(() => Effect.sync(cleanup)).pipe(Effect.andThen(Effect.die(defect))))
    )
  ).pipe(Layer.provideMerge(graph));
  await expect(createConnectionRuntime(failed, text => text)).rejects.toBeDefined();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

it('preserves desktop success TTL, immediately retries failures and marks only the actual concurrent miss', async () => {
  const spans: Tracer.Span[] = [];
  const tracer = Tracer.make({
    span: options => {
      const span = Tracer.nativeTracer.span(options);
      spans.push(span);
      return span;
    }
  });
  vi.mocked(AuthInfo.create).mockRejectedValueOnce(new Error('temporary auth read failure'));
  await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* ConnectionService;
      expect((yield* service.getConnection('AliasA').pipe(Effect.flip))._tag).toBe('FailedToCreateAuthInfoError');
      const values = yield* Effect.all(
        [service.getConnection('AliasA'), service.getConnection('AliasA'), service.getConnection('AliasA')],
        { concurrency: 'unbounded' }
      );
      expect(values.every(value => value === values[0])).toBe(true);
      yield* TestClock.adjust(Duration.minutes(29));
      expect(yield* service.getConnection('AliasA')).toBe(values[0]);
      yield* TestClock.adjust(Duration.minutes(1));
      expect(yield* service.getConnection('AliasA')).not.toBe(values[0]);
      expect(AuthInfo.create).toHaveBeenCalledTimes(3);
    }).pipe(Effect.provide(graph), Effect.provide(TestClock.layer()), Effect.withTracer(tracer))
  );
  const labels = spans
    .map(span => Object.fromEntries(span.attributes))
    .filter(attributes => attributes.connectionCache);
  expect(labels.filter(attributes => attributes.connectionCache === 'miss')).toHaveLength(2);
  expect(labels.filter(attributes => attributes.connectionCache === 'hit')).toHaveLength(3);
});

it('keeps web cache credentials out of tracing and rebuilds for a changed session token', async () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  const auth = auths.get(usernameA);
  if (!auth) throw new Error('Missing fixture auth');
  vi.spyOn(auth, 'save').mockResolvedValue(auth);
  const spans: Tracer.Span[] = [];
  const tracer = Tracer.make({
    span: options => {
      const span = Tracer.nativeTracer.span(options);
      spans.push(span);
      return span;
    }
  });
  const runtime = await start();
  try {
    const first = await runtime.runPromise(getConnection('ignored').pipe(Effect.withTracer(tracer)));
    expect(await runtime.runPromise(getConnection('ignored-again').pipe(Effect.withTracer(tracer)))).toBe(first);
    webSettings.accessToken = 'new-fixture-secret';
    expect(await runtime.runPromise(getConnection('ignored').pipe(Effect.withTracer(tracer)))).not.toBe(first);
    expect(AuthInfo.create).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(spans.map(span => Object.fromEntries(span.attributes)))).not.toMatch(
      /fixture-secret|fixture-refresh-secret/
    );
  } finally {
    await runtime.dispose();
  }
});

it('preserves the configured alias for login and invalidates both reauth and connection caches', async () => {
  const auth = auths.get(usernameA);
  if (!auth) throw new Error('Missing fixture auth');
  auth.update({ refreshToken: undefined });
  vi.spyOn(Connection.prototype, 'identity')
    .mockRejectedValueOnce(new Error('expired'))
    .mockResolvedValue({ id: 'fixture' } as never);
  vi.mocked(vscode.window.showErrorMessage).mockResolvedValue('Login' as never);
  const runtime = await start();
  try {
    expect((await runtime.runPromise(getConnection().pipe(Effect.flip)))._tag).toBe('AccessTokenExpiredError');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'sf.org.login.web',
      'https://fixture.example',
      'AliasA'
    );
    expect(await runtime.runPromise(getConnection('AliasA'))).toBeInstanceOf(Connection);
    expect(Connection.prototype.identity).toHaveBeenCalledTimes(2);
    expect(Connection.create).toHaveBeenCalledTimes(2);
  } finally {
    await runtime.dispose();
  }
});

it('interrupts V2 calls run in a consumer-owned fiber and rejects calls after owning-runtime shutdown', async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  vi.mocked(AuthInfo.create).mockImplementation(async () => {
    entered.resolve();
    await release.promise;
    const auth = auths.get(usernameA);
    if (!auth) throw new Error('Missing fixture auth');
    return auth;
  });
  const owner = await createConnectionRuntime(graph, text => text);
  const service = Context.get(owner.v2.services.prebuiltServicesDependencies, ConnectionService);
  const operation = Effect.runPromiseExit(service.getConnection('AliasA'));
  await entered.promise;
  const disposed = await owner.dispose();
  expect(disposed._tag).toBe('Success');
  const exit = await operation;
  expect(Exit.isFailure(exit) && exit.cause.reasons.some(reason => reason._tag === 'Interrupt')).toBe(true);
  const after = await Effect.runPromiseExit(service.getConnection('AliasA'));
  expect(Exit.isFailure(after)).toBe(true);
  release.resolve();
});

it('does not attach old aliases to the new identity while a selection generation is reserved', async () => {
  const layer = ConnectionWatcherLayer.pipe(Layer.provideMerge(graph), Layer.orDie);
  const runtime = await start(layer);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const acknowledged = Promise.withResolvers<void>();
  try {
    await runtime.runPromise(getConnection());
    await runtime.runPromise(enriched);
    const changes = await runtime.runPromise(OrgChanges);
    const generation = await runtime.runPromise(changes.begin);
    const read = vscode.workspace.fs.readFile.bind(vscode.workspace.fs);
    vi.mocked(vscode.workspace.fs.readFile).mockImplementationOnce(async uri => {
      entered.resolve();
      await release.promise;
      return read(uri);
    });
    let bAcknowledgments = 0;
    const subscription = await runtime.runPromise(
      changes.subscribe(org => {
        if (org.username === usernameB && ++bAcknowledgments === 2) acknowledged.resolve();
        return Promise.resolve();
      })
    );
    await writeJson(Global.SFDX_DIR, 'alias.json', { orgs: { OldAlias: usernameA, AliasB: usernameB } });
    await entered.promise;
    await runtime.runPromise(
      changes.update(generation, () => Effect.succeed({ username: usernameB, aliases: ['AliasB'] }))
    );
    release.resolve();
    await acknowledged.promise;
    expect(await runtime.runPromise(readOrg)).toMatchObject({ username: usernameB, aliases: ['AliasB'] });
    await runtime.runPromise(subscription.stop);
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('propagates actual connection-watcher close defects instead of discarding scoped child exits', async () => {
  const defect = new Error('watch close failed');
  const close = vi.fn<() => void>();
  const watch = coreFs.fs.watch as (path: NodeFs.PathLike, listener: NodeFs.WatchListener<string>) => NodeFs.FSWatcher;
  const watchHost = Layer.succeed(HostFileSystem, {
    get: () => ({
      watch: (path, listener) => {
        const handle = watch(path, listener);
        const originalClose = handle.close.bind(handle);
        vi.spyOn(handle, 'close').mockImplementation(() => {
          originalClose();
          close();
          throw defect;
        });
        return handle;
      }
    })
  });
  const runtime = await start(
    ConnectionWatcherLayer.pipe(Layer.provideMerge(graph.pipe(Layer.provide(watchHost))), Layer.orDie)
  );
  const exit = await Effect.runPromise(runtime.disposeEffect.pipe(Effect.exit));
  expect(close).toHaveBeenCalledTimes(2);
  expect(
    Exit.isFailure(exit) && exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)
  ).toBe(true);
});

it('keeps reauth success for one minute and failure for thirty minutes using the real V4 clock', async () => {
  const auth = auths.get(usernameA);
  if (!auth) throw new Error('Missing fixture auth');
  auth.update({ refreshToken: undefined });
  const identity = vi.spyOn(Connection.prototype, 'identity').mockResolvedValue({ id: 'fixture' } as never);
  await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* ConnectionService;
      yield* service.getConnection('AliasA');
      yield* TestClock.adjust(Duration.seconds(59));
      yield* service.getConnection('AliasA');
      expect(identity).toHaveBeenCalledTimes(1);
      yield* TestClock.adjust(Duration.seconds(1));
      yield* service.getConnection('AliasA');
      expect(identity).toHaveBeenCalledTimes(2);
      identity.mockRejectedValue(new Error('expired'));
      yield* TestClock.adjust(Duration.minutes(1));
      yield* service.getConnection('AliasA').pipe(Effect.flip);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(1);
      yield* TestClock.adjust(Duration.minutes(29));
      yield* service.getConnection('AliasA').pipe(Effect.flip);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(1);
      yield* TestClock.adjust(Duration.minutes(1));
      yield* service.getConnection('AliasA').pipe(Effect.flip);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(2);
    }).pipe(Effect.provide(graph), Effect.provide(TestClock.layer()))
  );
});

it('rejects late B enrichment after switching A→B→A, including telemetry persistence', async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<void>();
  const tracer = Tracer.make({
    span: options => {
      const span = Tracer.nativeTracer.span(options);
      const end = span.end.bind(span);
      span.end = (time, exit) => {
        end(time, exit);
        if (span.name === 'maybeUpdateDefaultOrgRef') finished.resolve();
      };
      return span;
    }
  });
  vi.mocked(Connection.prototype.request).mockImplementation(function (this: Connection) {
    const username = this.getUsername();
    return jsonResponse(
      (async () => {
        if (username === usernameB) {
          entered.resolve();
          await release.promise;
        }
        return { totalSize: 1, done: true, records: [{ Id: '005000000000001', Username: username }] };
      })()
    );
  });
  const runtime = await start();
  try {
    await runtime.runPromise(getConnection());
    await runtime.runPromise(enriched);
    await target('AliasB');
    await runtime.runPromise(getConnection().pipe(Effect.withTracer(tracer)));
    await entered.promise;
    await target('AliasA');
    await runtime.runPromise(getConnection());
    await runtime.runPromise(enriched);
    const current = await runtime.runPromise(readOrg);
    const persisted = [...globalState.update.mock.calls];
    release.resolve();
    await finished.promise;
    expect(await runtime.runPromise(readOrg)).toEqual(current);
    expect(globalState.update.mock.calls).toEqual(persisted);
    expect(current).toMatchObject({ username: usernameA, orgId: '00D000000000001', aliases: ['AliasA'] });
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it('does not await a caller-owned finalizer that waits for the owning runtime disposal', async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  vi.mocked(AuthInfo.create).mockImplementation(async () => {
    entered.resolve();
    await release.promise;
    const auth = auths.get(usernameA);
    if (!auth) throw new Error('Missing fixture auth');
    return auth;
  });
  const owner = await createConnectionRuntime(graph, text => text);
  const service = Context.get(owner.v2.services.prebuiltServicesDependencies, ConnectionService);
  const callerCleanup = vi.fn<() => void>();
  const operation = Effect.runPromiseExit(
    service
      .getConnection('AliasA')
      .pipe(Effect.ensuring(Effect.promise(owner.dispose).pipe(Effect.tap(() => Effect.sync(callerCleanup)))))
  );
  await entered.promise;
  expect((await owner.dispose())._tag).toBe('Success');
  expect(Exit.isFailure(await operation)).toBe(true);
  expect(callerCleanup).toHaveBeenCalledTimes(1);
  release.resolve();
});

it('redacts formatted V4 owner and V2 prebuilt-layer messages, causes and annotations', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(Connection.prototype.request).mockRejectedValue(new Error('Bearer fixture-secret'));
  const owner = await createConnectionRuntime(graph, text => text.replaceAll('fixture-secret', '<redacted>'));
  const ref = Context.get(owner.v2.services.prebuiltServicesDependencies, TargetOrgRef);
  try {
    await Effect.runPromise(
      SubscriptionRef.set(ref, { cliId: Schema.decodeUnknownSync(CliId)('00000000-0000-4000-8000-000000000001') })
    );
    await Effect.runPromise(
      Effect.logError('fixture-secret', Cause.die(new Error('fixture-secret'))).pipe(
        Effect.annotateLogs({ credential: 'fixture-secret' }),
        Effect.provide(owner.v2.services.prebuiltServicesLayer)
      )
    );
    expect((await owner.host.getConnection(undefined, new AbortController().signal))._tag).toBe('Success');
    await Effect.runPromise(
      SubscriptionRef.changes(ref).pipe(
        Stream.filter(org => org.alias === 'AliasA'),
        Stream.take(1),
        Stream.runCollect
      )
    );
    expect(log.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain('fixture-secret');
    expect(JSON.stringify(log.mock.calls)).toContain('<redacted>');
  } finally {
    await owner.dispose();
  }
});

it('keeps domain org generation valid across parallel same-org connection acquisitions', async () => {
  const runtime = await start();
  try {
    await runtime.runPromise(getConnection());
    await runtime.runPromise(enriched);
    const changes = await runtime.runPromise(OrgChanges);
    const captured = await runtime.runPromise(changes.snapshot);
    const orgId = captured.org.orgId;
    if (!orgId) throw new Error('Missing fixture org');
    await runtime.runPromise(
      Effect.all(
        [
          getConnection(),
          ConnectionService.use(service => service.getConnectionForOrg(orgId)),
          ConnectionService.use(service => service.getConnectionForOrg(orgId))
        ],
        { concurrency: 'unbounded' }
      )
    );
    const current = await runtime.runPromise(changes.snapshot);
    expect(current.generation).toBeGreaterThan(captured.generation);
    expect(current.orgGeneration).toBe(captured.orgGeneration);
  } finally {
    await runtime.dispose();
  }
});

it('uses the real query reader and lazily follows the captured SDK connection pagination', async () => {
  const response = installQueryResponses();
  const runtime = await startQuery();
  try {
    const result = await runtime.runPromise(queryRecords);
    expect(result.totalSize).toBe(3);
    expect(response.requests).toHaveLength(1);
    expect(await runtime.runPromise(Stream.runCollect(result.records))).toEqual([
      { Name: 'First' },
      { Name: 'Second' },
      { Name: 'Third' }
    ]);
    expect(response.requests).toHaveLength(2);
  } finally {
    response.nextRelease.resolve();
    await runtime.dispose();
  }
});

it('rejects buffered query records and the next page after switching org before consumption', async () => {
  const response = installQueryResponses();
  const runtime = await startQuery();
  try {
    const result = await runtime.runPromise(queryRecords);
    await target('AliasB');
    await runtime.runPromise(getConnection());
    expect(await Effect.runPromise(Stream.runCollect(result.records).pipe(Effect.flip))).toMatchObject({
      _tag: 'InactiveOrgOperationError'
    });
    expect(response.requests).toHaveLength(1);
  } finally {
    response.nextRelease.resolve();
    await runtime.dispose();
  }
});

it('discards a late query page after org change without holding the org semaphore during network work', async () => {
  const response = installQueryResponses(true);
  const runtime = await startQuery();
  try {
    const result = await runtime.runPromise(queryRecords);
    const reading = Effect.runPromise(Stream.runCollect(result.records).pipe(Effect.flip));
    await response.nextStarted.promise;
    await target('AliasB');
    await runtime.runPromise(getConnection());
    response.nextRelease.resolve();
    expect(await reading).toMatchObject({ _tag: 'InactiveOrgOperationError' });
  } finally {
    response.nextRelease.resolve();
    await runtime.dispose();
  }
});

it('owns lazy query page calls made by external consumers and rejects retained streams after disposal', async () => {
  const response = installQueryResponses(true);
  const runtime = await startQuery();
  try {
    const result = await runtime.runPromise(queryRecords);
    const reading = Effect.runPromiseExit(Stream.runCollect(result.records));
    await response.nextStarted.promise;
    await runtime.dispose();
    expect(Exit.isFailure(await reading)).toBe(true);
    expect(Exit.isFailure(await Effect.runPromiseExit(Stream.runCollect(result.records)))).toBe(true);
    expect(response.requests).toHaveLength(2);
  } finally {
    response.nextRelease.resolve();
    await runtime.dispose();
  }
});

it('retains available auth identity when optional SDK fields are explicitly undefined', () => {
  const fields = authFieldsFrom({
    orgId: '00D000000000001',
    username: usernameA,
    tracksSource: undefined,
    instanceName: undefined,
    isScratch: undefined
  });
  expect(Option.isSome(fields)).toBe(true);
  if (Option.isSome(fields)) {
    expect(Option.getOrUndefined(fields.value.orgId)).toBe('00D000000000001');
    expect(Option.isNone(fields.value.tracksSource)).toBe(true);
    expect(Schema.encodeSync(AuthFields)(fields.value)).toEqual({ orgId: '00D000000000001', username: usernameA });
  }
});

it('retains connection, reauth, identity and dev-hub spans while memoizing dev-hub auth', async () => {
  const auth = auths.get(usernameA);
  if (!auth) throw new Error('Missing fixture auth');
  auth.update({ devHubUsername: usernameB, refreshToken: undefined });
  vi.spyOn(Connection.prototype, 'identity').mockResolvedValue({ id: 'fixture' } as never);
  const spans: Tracer.Span[] = [];
  const tracer = Tracer.make({
    span: options => {
      const span = Tracer.nativeTracer.span(options);
      spans.push(span);
      return span;
    }
  });
  const runtime = await start();
  try {
    await runtime.runPromise(getConnection().pipe(Effect.withTracer(tracer)));
    await runtime.runPromise(enriched);
    expect(await runtime.runPromise(readOrg)).toMatchObject({ devHubOrgId: '00D000000000002' });
    await runtime.runPromise(getConnection().pipe(Effect.withTracer(tracer)));
    expect(
      vi
        .mocked(AuthInfo.create)
        .mock.calls.filter(([options]) => options && 'username' in options && options.username === usernameB)
    ).toHaveLength(1);
    expect(spans.filter(span => span.name === 'getDevHubId')).toHaveLength(1);
    for (const name of [
      'ConnectionService.connectionCache.get',
      'ConnectionService.runReauthLookup',
      'getUserFromUserSobject'
    ]) {
      expect(spans.some(span => span.name === name)).toBe(true);
    }
  } finally {
    await runtime.dispose();
  }
});

it.each(['accessToken', 'instanceUrl', 'apiVersion'])(
  'refreshes default-org state on %s settings changes without a caller requesting a connection',
  async key => {
    vi.stubEnv('ESBUILD_PLATFORM', 'web');
    auths.forEach(auth => {
      vi.spyOn(auth, 'save').mockResolvedValue(auth);
    });
    const runtime = await start(ConnectionWatcherLayer.pipe(Layer.provideMerge(graph), Layer.orDie));
    try {
      await runtime.runPromise(getConnection());
      await runtime.runPromise(enriched);
      webSettings.accessToken = 'new-fixture-secret';
      webSettings.sessionContext = {
        username: usernameB,
        orgId: '00D000000000002',
        userId: '005000000000002',
        namespacePrefix: '',
        isDevHub: false,
        isScratch: false,
        isSandbox: false
      };
      await runtime.runPromise(
        SettingsChangePubSub.use(events =>
          PubSub.publish(events, {
            affectsConfiguration: section => section === `salesforce-web-console.${key}`
          })
        )
      );
      const changed = await runtime.runPromise(
        TargetOrgRef.pipe(
          Effect.flatMap(ref =>
            SubscriptionRef.changes(ref).pipe(
              Stream.filter(org => org.username === usernameB),
              Stream.take(1),
              Stream.runCollect,
              Effect.timeout(Duration.seconds(2))
            )
          )
        )
      );
      expect(changed[0]).toMatchObject({ username: usernameB, orgId: '00D000000000002' });
      expect(Connection.create).toHaveBeenCalledTimes(2);
    } finally {
      await runtime.dispose();
    }
  }
);
