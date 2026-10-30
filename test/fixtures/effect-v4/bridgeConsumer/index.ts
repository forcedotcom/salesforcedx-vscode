/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createOfflineConnection } from '../bridgeHost/nodeConnection.js';
import { basicConformance } from './basic.js';
import { advancedConformance } from './advanced.js';

const requireConsumer = createRequire(import.meta.url);
const requireHost = createRequire(new URL('../bridgeHost/package.json', import.meta.url));
const requireCompat = createRequire(requireHost.resolve('@salesforce/vscode-services-v3-compat'));
assert.equal(requireConsumer('effect/package.json').version, '3.21.2');
assert.equal(requireHost('effect/package.json').version, '4.0.6');
assert.equal(requireCompat('effect/package.json').version, '3.21.2');
assert.notEqual(requireConsumer.resolve('effect/Effect'), requireCompat.resolve('effect/Effect'));

const connection = await createOfflineConnection();
const result = await basicConformance(connection);
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
