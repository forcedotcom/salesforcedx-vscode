/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Global, StateAggregator } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import {
  CliId,
  ChannelService,
  ConnectionService,
  TargetOrgRef
} from '@salesforce/vscode-services/v2';
import { ConnectionHost } from 'salesforcedx-vscode-services/out/src/services/connectionHost.js';
import { connectionWatcherLayers } from 'salesforcedx-vscode-services/out/src/services/connectionLayers.js';
import { createConnectionRuntime } from 'salesforcedx-vscode-services/out/src/services/connectionRuntime.js';
import { HostFileSystem } from 'salesforcedx-vscode-services/out/src/services/hostFileSystem.js';
import { WebFileSystemProvider } from 'salesforcedx-vscode-services/out/src/services/webFileSystemProvider.js';
import type { CompatibilityHost, CompatibilityLogItem, CompatibilityServiceFailure, HostExit } from '@salesforce/vscode-services-v3-compat/host';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { URI, Utils } from 'vscode-uri';

export { createCompatibleConnectionServices } from '@salesforce/vscode-services-v3-compat';
export const makeRealConnection = async () => {
  coreFs.setFs(coreFs.getVirtualFs());
  await StateAggregator.clearInstanceAsync();
  const writeJson = async (directory: string, name: string, data: object) => {
    await coreFs.fs.promises.mkdir(directory, { recursive: true });
    await coreFs.fs.promises.writeFile(Utils.joinPath(URI.file(directory), name).fsPath, JSON.stringify(data));
  };
  const setTarget = (target: string) => writeJson(Global.SF_DIR, 'config.json', { 'target-org': target, 'org-api-version': '67.0' });
  await coreFs.fs.promises.mkdir('/connection-fixture', { recursive: true });
  await setTarget('AliasA');
  await writeJson(Global.SFDX_DIR, 'alias.json', { orgs: { AliasA: 'fixture-a@example.com', AliasB: 'fixture-b@example.com' } });
  for (const [username, orgId] of [['fixture-a@example.com', '00D000000000001'], ['fixture-b@example.com', '00D000000000002']]) {
    const auth = await AuthInfo.create({ accessTokenOptions: { username, orgId, accessToken: 'fixture-secret',
      instanceUrl: 'https://fixture.example', isDevHub: false, namespacePrefix: '', isScratch: false, isSandbox: false } });
    auth.update({ refreshToken: 'fixture-refresh-secret', tracksSource: true });
    await auth.save();
  }
  const request = Object.getOwnPropertyDescriptor(Connection.prototype, 'request');
  Object.defineProperty(Connection.prototype, 'request', { configurable: true, value: function (this: Connection) {
    return Promise.resolve({ totalSize: 1, done: true, records: [{ Username: this.getUsername(), Id: '005000000000001' }] });
  } });
  const host = Layer.succeed(ConnectionHost, {
    globalState: { get: () => undefined, keys: () => [], setKeysForSync: () => {}, update: () => Promise.resolve() },
    messages: { expired: 'Expired', expiredDetail: 'Login again', login: 'Login', refreshFailed: 'Login failed', orgChanged: orgId => `Org changed: ${orgId}` }
  });
  const hostFileSystem = Layer.succeed(HostFileSystem, { get: () => ({ watch: coreFs.fs.watch }) });
  const graph = connectionWatcherLayers.pipe(Layer.provide(Layer.mergeAll(host,
    hostFileSystem,
    Layer.succeed(WebFileSystemProvider, { get: () => undefined }),
    Layer.mock(ChannelService, { appendToChannel: () => Effect.void })
  )), Layer.orDie);
  const owner = await createConnectionRuntime(Layer.mergeAll(graph, graph), text => text.replaceAll('fixture-secret', '<redacted>'));
  const unavailable = <A>(): HostExit<A, CompatibilityServiceFailure> => ({
    _tag: 'Failure',
    reasons: [{ _tag: 'Die', defect: new Error('The connection-only fixture has no Apex Log or Fs service layer') }]
  });
  const compatibilityHost: CompatibilityHost = {
    ...owner.host,
    listLogs: (_limit, _options, _signal) => Promise.resolve(unavailable<readonly CompatibilityLogItem[]>()),
    getLogBody: (_logId, _signal) => Promise.resolve(unavailable<string>()),
    safeWriteFile: (_filePath, _content, _signal) => Promise.resolve(unavailable<void>())
  };
  const services = owner.v2.services;
  const connection = Context.get(services.prebuiltServicesDependencies, ConnectionService);
  const ref = Context.get(services.prebuiltServicesDependencies, TargetOrgRef);
  // Activation's telemetry seed, before subscriptions/exports; not an authoritative org selection.
  await Effect.runPromise(SubscriptionRef.set(ref, { cliId: Schema.decodeUnknownSync(CliId)('00000000-0000-4000-8000-000000000001') }));
  return {
    owner: { ...owner, host: compatibilityHost },
    direct: (username?: string) => Effect.runPromise(connection.getConnection(username)),
    readOrg: () => Effect.runPromise(SubscriptionRef.get(ref)),
    native: (value: unknown) => value instanceof Connection,
    setTarget,
    restoreRequest: () => { if (request) Object.defineProperty(Connection.prototype, 'request', request); else Reflect.deleteProperty(Connection.prototype, 'request'); }
  };
};
