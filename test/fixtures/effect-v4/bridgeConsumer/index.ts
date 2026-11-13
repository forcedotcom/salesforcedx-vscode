/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Connection as ConsumerConnection, Org } from '@salesforce/core';
import { createOfflineConnection } from '../bridgeHost/nodeConnection.js';
import { basicConformance } from './basic.js';
import { advancedConformance } from './advanced.js';

const requireConsumer = createRequire(import.meta.url);
const requireHost = createRequire(new URL('../bridgeHost/package.json', import.meta.url));
const requireCompat = createRequire(requireHost.resolve('@salesforce/vscode-services-v3-compat'));
assert.equal(requireConsumer('effect/package.json').version, '3.21.2');
assert.equal(requireHost('effect/package.json').version, '4.1.4');
assert.equal(requireCompat('effect/package.json').version, '3.21.2');
assert.notEqual(requireConsumer.resolve('effect/Effect'), requireCompat.resolve('effect/Effect'));
// Core 8 does not export its package.json subpath; inspect the installed manifest beside its public entry.
const sdkVersion = (require: ReturnType<typeof createRequire>) => JSON.parse(
  readFileSync(new URL('../package.json', pathToFileURL(require.resolve('@salesforce/core'))), 'utf8')
).version;
assert.equal(sdkVersion(requireConsumer), '8.31.3');
assert.equal(sdkVersion(requireHost), '9.3.6');
assert.notEqual(requireConsumer.resolve('@salesforce/core'), requireHost.resolve('@salesforce/core'));

const connection = await createOfflineConnection();
const result = await basicConformance(connection, async value => {
  // Einstein main 4e120aef org-service.ts declares an unknown result and casts ONLY the plain
  // native SDK object to its own Core 8 Connection. Private SDK class fields are nominal;
  // this is not a declaration-compatibility claim or a cast of runnable Effect values.
  const native = value as ConsumerConnection;
  assert.ok(Object.is(native, connection));
  assert.notEqual(Object.getPrototypeOf(native), ConsumerConnection.prototype, 'the bridge must not construct a consumer SDK wrapper');
  const consumerOrg = await Org.create({ connection: native });
  assert.ok(Object.is(consumerOrg.getConnection(), connection), 'Core 8 Org must retain the Core 9 Connection');
  assert.equal(consumerOrg.getConnection().getAuthInfo(), connection.getAuthInfo());
  assert.equal(consumerOrg.getConnection().getApiVersion(), '65.0');
  assert.equal(consumerOrg.getConnection().sobject('Account').type, 'Account');
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const soql = url.searchParams.get('q') ?? '';
    requests.push(soql);
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ totalSize: 1, done: true, records: [soql.includes('Organization')
      ? { Id: '00D000000000001', Name: 'SDK pair fixture', OrganizationType: 'Developer Edition', IsSandbox: false,
          TrialExpirationDate: null, InstanceName: 'NA1', NamespacePrefix: '' }
      : { Id: '001000000000001' }] }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const originalUrl = native.instanceUrl;
  native.instanceUrl = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await native.query('SELECT Id FROM Account')).records[0]?.Id, '001000000000001');
    assert.equal((await consumerOrg.retrieveOrganizationInformation()).Name, 'SDK pair fixture');
    assert.equal(requests.length, 2);
    assert.ok(requests[1]?.includes('Organization'));
  } finally {
    native.instanceUrl = originalUrl;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  console.log('PASS producer Core 9.3.6 / consumer Core 8.31.3: genuine V3 bridge, same native Connection, consumer Org.create, native SOQL and Organization lookup');
});
assert.equal(result.sameConnection, true);
assert.equal(result.stableRef, true);
assert.deepEqual(result.initialSnapshots, ['00D000000000001']);
assert.deepEqual(result.aliases, ['fixture-alias']);
assert.equal(result.configured, 'configured-alias');
assert.equal(result.override, 'overridden');
assert.deepEqual(result.ownerConfigured, { _tag: 'Success', value: 'configured-alias' });
assert.equal(result.immediate, '00D000000000002');
assert.deepEqual(result.fullState, {
  aliases: ['fixture-alias'],
  orgId: '00D000000000002',
  instanceName: 'CS1',
  devHubOrgId: '00D000000000007',
  username: 'fixture',
  alias: 'fixture-alias',
  devHubUsername: 'hub',
  tracksSource: true,
  isScratch: true,
  isSandbox: false,
  userId: 'legacy-string-is-accepted',
  cliId: '123e4567-e89b-12d3-a456-426614174000',
  webUserId: 'web',
  orgEdition: 'Developer'
});
assert.equal(result.ownerAfterLocalMutation, '00D000000000002');
assert.equal(result.restored, '00D000000000002');
assert.deepEqual(
  result.updates,
  Array.from({ length: 2 }, () => ['00D000000000002', '00D000000000003', '00D000000000004', '00D000000000005'])
);
assert.equal(result.graphBuilds, 1);
assert.equal(result.graphDisposals, 1);
assert.equal(result.subscribersAfterClose, 0);
assert.equal(result.interruptedAfterClose, true);
console.log(
  'PASS actual packed V3 adapters over one V4 runtime: real SDK Connection identity, static accessors/Context/Layer, org commit acknowledgments, ordered subscribers, local-only V3 mutation, shutdown'
);
await advancedConformance(connection);
