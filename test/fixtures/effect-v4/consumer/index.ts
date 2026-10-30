/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import consumerVersion from 'effect/package.json' with { type: 'json' };
import * as Stream from 'effect/Stream';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeFixtureApi } from '../provider/index.js';
import providerVersion from '../provider/node_modules/effect/package.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const providerRequire = createRequire(new URL('../provider/index.js', import.meta.url));
assert.notEqual(require.resolve('effect/Effect'), providerRequire.resolve('effect/Effect'));
assert.equal(consumerVersion.version, '3.21.2');
assert.equal(providerVersion.version, '3.21.2');

const connection = { marker: 'same-connection' };
const api = makeFixtureApi(connection);
const dependencies = Layer.succeedContext(api.services.prebuiltServicesDependencies);
const resolved = await Effect.runPromise(
  api.services.ConnectionService.getConnection().pipe(Effect.provide(dependencies))
);
assert.equal(resolved, connection);
assert.equal(
  await Effect.runPromise(api.services.ConnectionService.getConnection().pipe(Effect.provide(api.services.prebuiltServicesLayer))),
  connection
);
assert.deepEqual(
  await Effect.runPromise(api.services.AliasService.getAliasesFromUsername('username').pipe(Effect.provide(dependencies))),
  ['username-alias']
);
assert.equal(await Effect.runPromise(api.services.ConfigService.getTargetOrg().pipe(Effect.provide(dependencies))), 'configured-alias');

const ready = Effect.runSync(Effect.makeLatch());
const watcher = Effect.runFork(
  api.services.TargetOrgRef().pipe(
    Effect.flatMap(ref => ref.changes.pipe(
      Stream.tap(() => ready.open),
      Stream.map(org => org.orgId),
      Stream.changes,
      Stream.drop(1),
      Stream.take(2),
      Stream.runCollect
    ))
  )
);
await Effect.runPromise(ready.await);
await api.setOrg('second');
await api.setOrg('third');
assert.deepEqual(Chunk.toReadonlyArray(await Effect.runPromise(Fiber.join(watcher))), ['second', 'third']);
console.log('PASS separate V3 installations: Context, Layer, Connection identity, alias/config, ref snapshot and updates');
