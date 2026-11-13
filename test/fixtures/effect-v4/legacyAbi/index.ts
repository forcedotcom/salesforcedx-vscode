/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FullLegacyServicesApi, PublicLegacyServicesApi } from '../bridgeHost/legacyClasses.js';
import { AliasService, ApexLogService, bindLegacyAliasService, ConfigService, bindLegacyConfigService, ConnectionService,
  FsService,
  bindLegacyConnectionService, WorkspaceService, bindLegacyWorkspaceService, QueryService, bindLegacyQueryService
} from '../bridgeHost/legacyClasses.js';
import { createAbiSdkValues } from '../bridgeHost/nodeConnection.js';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { URI } from 'vscode-uri';

type Legacy = FullLegacyServicesApi['services'];
type Body<Name extends 'WorkspaceService' | 'ConnectionService' | 'AliasService' | 'ConfigService' | 'QueryService'> =
  ConstructorParameters<Legacy[Name]>[0];
type Instance<Name extends 'WorkspaceService' | 'ConnectionService' | 'AliasService' | 'ConfigService' | 'QueryService'> =
  InstanceType<Legacy[Name]>;

const require = createRequire(import.meta.url);
const requireHost = createRequire(new URL('../bridgeHost/package.json', import.meta.url));
const requireCompat = createRequire(requireHost.resolve('@salesforce/vscode-services-v3-compat'));
assert.notEqual(require.resolve('effect/Effect'), requireCompat.resolve('effect/Effect'));
assert.equal(require('effect/package.json').version, '3.21.2');
assert.equal(requireCompat('effect/package.json').version, '3.21.2');

// Controlled bodies prove actual emitted constructors/layers, not SDK ownership or provider activation.
const { connection: nativeConnection, config: nativeConfig } = await createAbiSdkValues();
let target: string | undefined = 'owner-a@example.com';
const calls: string[] = [];
const connectionBody: Body<'ConnectionService'> = {
  getConnection: username => Effect.sync(() => { calls.push(`connection:${username ?? 'default'}`); return nativeConnection; }),
  getConnectionForOrg: orgId => Effect.sync(() => { calls.push(`org:${orgId}`); return nativeConnection; }),
  getAuthInfoFields: username => Effect.succeed({ username }),
  validateAccessTokenOrPromptReauth: connection => Effect.sync(() => { assert.equal(connection, nativeConnection); calls.push('validate'); }),
  invalidateCachedConnections: () => Effect.sync(() => { calls.push('invalidate'); }),
  listAllAuthorizations: () => Effect.succeed([])
};
const configBody: Body<'ConfigService'> = {
  getConfigAggregator: () => Effect.succeed(nativeConfig),
  invalidateConfigAggregator: () => Effect.sync(() => { calls.push('invalidateConfig'); }),
  getTargetOrg: () => Effect.sync(() => target),
  getTargetDevHub: () => Effect.succeed('hub@example.com'),
  isCliTelemetryDisabled: () => Effect.succeed(false),
  isCurrentTargetOrg: username => Effect.sync(() => username === target),
  isCurrentTargetDevHub: username => Effect.succeed(username === 'hub@example.com'),
  setTargetOrg: username => Effect.sync(() => { target = username; }),
  unsetTargetOrg: () => Effect.sync(() => { target = undefined; }),
  unsetTargetDevHub: () => Effect.sync(() => { calls.push('unsetHub'); })
};
const aliasBody: Body<'AliasService'> = {
  getAllAliases: () => Effect.succeed({ a: 'owner-a@example.com' }),
  getAliasesFromUsername: username => Effect.succeed(username === 'owner-a@example.com' ? ['a'] : []),
  getUsernameFromAlias: alias => Effect.succeed(alias === 'a' ? Option.some('owner-a@example.com') : Option.none()),
  unsetAliases: aliases => Effect.sync(() => { calls.push(...aliases.map(alias => `unset:${alias}`)); })
};
const workspaceBody = (name: string): Body<'WorkspaceService'> => {
  const info: Effect.Effect.Success<ReturnType<Body<'WorkspaceService'>['getWorkspaceInfoOrThrow']>> = {
    uri: URI.file(`/${name}`), path: `/${name}`, fsPath: `/${name}`, cwd: '/', isEmpty: false, isVirtualFs: false
  };
  return { getWorkspaceInfo: () => Effect.succeed(info), getWorkspaceInfoOrThrow: () => Effect.succeed(info) };
};

const workspaceA = bindLegacyWorkspaceService(workspaceBody('owner-a'));
const workspaceB = bindLegacyWorkspaceService(workspaceBody('owner-b'));
const connection = bindLegacyConnectionService(connectionBody);
const config = bindLegacyConfigService(configBody);
const alias = bindLegacyAliasService(aliasBody);
const queryBody: Body<'QueryService'> = {
  query: <A, I>(_options: Parameters<Body<'QueryService'>['query']>[0], schema: Schema.Schema<A, I, never>) =>
    Schema.decodeUnknown(Schema.Array(schema))([{ count: '42' }]).pipe(
      Effect.map(records => ({ totalSize: records.length, records: Stream.fromIterable(records) })))
};
const query = bindLegacyQueryService(queryBody);
const apexLogs = ApexLogService.of({
  listLogs: () => Effect.succeed([]),
  getLogBody: () => Effect.succeed('')
});
const fs = FsService.of({ safeWriteFile: () => Effect.void });
const constructors: Pick<Legacy, 'WorkspaceService' | 'ConnectionService' | 'ConfigService' | 'AliasService' | 'QueryService'> = {
  WorkspaceService: workspaceA.Service, ConnectionService: connection.Service, ConfigService: config.Service, AliasService: alias.Service,
  QueryService: query.Service
};
const sourceConstructors: typeof constructors = { WorkspaceService, ConnectionService, ConfigService, AliasService, QueryService };
assert.equal(new constructors.ConnectionService(connectionBody).getConnection, connectionBody.getConnection);
assert.equal(constructors.AliasService.make(aliasBody).getAllAliases, aliasBody.getAllAliases);
const shared = Context.make(WorkspaceService, workspaceA.instance).pipe(
  Context.add(ConnectionService, connection.instance), Context.add(ConfigService, config.instance), Context.add(AliasService, alias.instance),
  Context.add(QueryService, query.instance), Context.add(ApexLogService, apexLogs), Context.add(FsService, fs)
);
type OrgInfo = Effect.Effect.Success<ReturnType<Legacy['TargetOrgRef']>> extends SubscriptionRef.SubscriptionRef<infer A> ? A : never;
const orgRef = await Effect.runPromise(SubscriptionRef.make<OrgInfo>({}));
const publicApi: PublicLegacyServicesApi = { services: {
  ConnectionService: connection.Service, AliasService: alias.Service, ConfigService: config.Service,
  ApexLogService, FsService,
  TargetOrgRef: () => Effect.succeed(orgRef), prebuiltServicesDependencies: shared,
  prebuiltServicesLayer: Layer.succeedContext(shared)
} };
const runtime = ManagedRuntime.make(Layer.succeedContext(shared));
const boundRuntime = ManagedRuntime.make(Layer.mergeAll(workspaceA.Service.Default, connection.Service.Default,
  config.Service.Default, alias.Service.Default, query.Service.Default));
const otherRuntime = ManagedRuntime.make(workspaceB.Service.Default);
try {
  assert.equal(await runtime.runPromise(sourceConstructors.ConnectionService), connection.instance);
  assert.equal(await boundRuntime.runPromise(ConnectionService), connection.instance);
  assert.equal(await runtime.runPromise(constructors.ConnectionService.getConnection()), nativeConnection);
  assert.equal(await Effect.runPromise(publicApi.services.ConnectionService.getConnection().pipe(
    Effect.provide(publicApi.services.prebuiltServicesLayer))), nativeConnection);
  assert.equal(await runtime.runPromise(ConnectionService.getConnection('other@example.com')), nativeConnection);
  assert.equal(await runtime.runPromise(ConnectionService.getConnectionForOrg('00D000000000001')), nativeConnection);
  assert.deepEqual(await runtime.runPromise(ConnectionService.getAuthInfoFields('explicit@example.com')), { username: 'explicit@example.com' });
  await runtime.runPromise(ConnectionService.validateAccessTokenOrPromptReauth(nativeConnection));
  await runtime.runPromise(ConnectionService.invalidateCachedConnections());
  assert.deepEqual(await runtime.runPromise(ConnectionService.listAllAuthorizations()), []);
  assert.equal(await runtime.runPromise(ConfigService.getConfigAggregator()), nativeConfig);
  await runtime.runPromise(ConfigService.invalidateConfigAggregator());
  assert.equal(await runtime.runPromise(ConfigService.getTargetOrg()), target);
  assert.equal(await runtime.runPromise(ConfigService.getTargetDevHub()), 'hub@example.com');
  assert.equal(await runtime.runPromise(ConfigService.isCliTelemetryDisabled()), false);
  assert.equal(await runtime.runPromise(ConfigService.isCurrentTargetOrg('owner-a@example.com', [])), true);
  assert.equal(await runtime.runPromise(ConfigService.isCurrentTargetDevHub('hub@example.com', [])), true);
  await runtime.runPromise(ConfigService.setTargetOrg('changed@example.com'));
  assert.equal(await runtime.runPromise(ConfigService.getTargetOrg()), 'changed@example.com');
  await runtime.runPromise(ConfigService.unsetTargetOrg());
  assert.equal(await runtime.runPromise(ConfigService.getTargetOrg()), undefined);
  await runtime.runPromise(ConfigService.unsetTargetDevHub());
  assert.deepEqual(await runtime.runPromise(AliasService.getAllAliases()), { a: 'owner-a@example.com' });
  assert.deepEqual(await runtime.runPromise(AliasService.getAliasesFromUsername('owner-a@example.com')), ['a']);
  assert.deepEqual(await runtime.runPromise(AliasService.getUsernameFromAlias('a')), Option.some('owner-a@example.com'));
  await runtime.runPromise(AliasService.unsetAliases(['a']));
  assert.equal((await runtime.runPromise(WorkspaceService.getWorkspaceInfoOrThrow())).path, '/owner-a');
  assert.equal((await otherRuntime.runPromise(constructors.WorkspaceService.getWorkspaceInfo())).path, '/owner-b');
  assert.equal(await runtime.runPromise(constructors.ConfigService.use(service => service.getConfigAggregator())), nativeConfig);
  const result = await runtime.runPromise(constructors.QueryService.use(service =>
    service.query({ soql: 'SELECT count FROM Fixture' }, Schema.Struct({ count: Schema.NumberFromString }))));
  const records: readonly { readonly count: number }[] = Array.from(await Effect.runPromise(Stream.runCollect(result.records)));
  assert.deepEqual(records, [{ count: 42 }]);

  // Frozen Without declarations conservatively retain old dependencies. The bound layer is
  // the SAME value already executed by boundRuntime; source declarations expose its actual requirements.
  assert.equal(connection.Service.DefaultWithoutDependencies, connection.Service.Default);
  assert.equal(config.Service.DefaultWithoutDependencies, config.Service.Default);
  assert.equal(alias.Service.DefaultWithoutDependencies, alias.Service.Default);
  assert.equal(query.Service.DefaultWithoutDependencies, query.Service.Default);
  const without = Layer.mergeAll(ConnectionService.DefaultWithoutDependencies, ConfigService.DefaultWithoutDependencies,
    AliasService.DefaultWithoutDependencies, QueryService.DefaultWithoutDependencies).pipe(Layer.provide(Layer.succeedContext(shared)));
  assert.equal(await Effect.runPromise(ConnectionService.pipe(Effect.provide(without))), connection.instance);
  assert.equal(await Effect.runPromise(ConfigService.pipe(Effect.provide(without))), config.instance);
  assert.equal(await Effect.runPromise(AliasService.pipe(Effect.provide(without))), alias.instance);
  assert.equal(await Effect.runPromise(QueryService.pipe(Effect.provide(without))), query.instance);
  const sourceDefaults = Layer.mergeAll(WorkspaceService.Default, ConnectionService.Default, ConfigService.Default, AliasService.Default)
    .pipe(Layer.provide(Layer.succeedContext(shared)));
  assert.equal(await Effect.runPromise(ConnectionService.pipe(Effect.provide(sourceDefaults))), connection.instance);
  assert.equal(await Effect.runPromise(WorkspaceService.pipe(Effect.provide(sourceDefaults))), workspaceA.instance);

  const all: Effect.Effect<[Instance<'ConnectionService'>, Instance<'ConfigService'>], never,
    Instance<'ConnectionService'> | Instance<'ConfigService'>> = Effect.all([ConnectionService, ConfigService]);
  assert.deepEqual(await runtime.runPromise(all), [connection.instance, config.instance]);
  const generate: Effect.Effect<Instance<'ConnectionService'>, never, Instance<'ConnectionService'>> = Effect.gen(function* () {
    return yield* ConnectionService;
  });
  assert.equal(await runtime.runPromise(generate), connection.instance);
  const select = (useConnection: boolean): Effect.Effect<Instance<'ConnectionService'> | Instance<'ConfigService'>,
    never, Instance<'ConnectionService'> | Instance<'ConfigService'>> => Effect.gen(function* () {
    return yield* (useConnection ? ConnectionService : ConfigService);
  });
  assert.equal(await runtime.runPromise(select(false)), config.instance);
  const replacement = bindLegacyWorkspaceService(workspaceBody('replacement'));
  assert.equal((await Effect.runPromise(WorkspaceService.getWorkspaceInfo().pipe(Effect.provide(
    Layer.succeed(constructors.WorkspaceService, replacement.instance))))).path, '/replacement');
  await otherRuntime.dispose();
  assert.equal((await runtime.runPromise(WorkspaceService.getWorkspaceInfo())).path, '/owner-a');
  assert.deepEqual(calls, ['connection:default', 'connection:default', 'connection:other@example.com', 'org:00D000000000001', 'validate',
    'invalidate', 'invalidateConfig', 'unsetHub', 'unset:a']);
  console.log('PASS packed frozen V3 constructors, full Connection/Config/Alias/Workspace methods, both defaults, unification and source/API instance identity');
} finally {
  await Promise.all([runtime.dispose(), boundRuntime.dispose(), otherRuntime.dispose()]);
}
