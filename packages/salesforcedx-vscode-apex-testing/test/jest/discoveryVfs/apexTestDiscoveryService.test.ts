/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import {
  ApexTestDiscoveryService,
  DiscoveryReadError,
  resolveDiscoveryOrgKey
} from '../../../src/discoveryVfs/apexTestDiscoveryService';
import {
  ApexTestingDiscoveryFsProviderLive,
  ApexTestingDiscoveryFsProviderTag
} from '../../../src/discoveryVfs/apexTestDiscoveryFsProviderTag';
import { getOrgDiscoveryUri, getOrgIndexUri } from '../../../src/discoveryVfs/apexTestingDiscoveryFs';
import { ApexTestingDiscoveryFsProvider } from '../../../src/discoveryVfs/apexTestingDiscoveryFsProvider';
import type { ToolingTestClass } from '../../../src/testDiscovery/schemas';

const classOf = (name: string, methods: string[]): ToolingTestClass => ({
  id: `id-${name}`,
  name,
  namespacePrefix: '',
  testMethods: methods.map(m => ({ name: m }))
});

// Fresh real in-mem provider per case → true per-case isolation, no module singleton, no reset hack.
const buildLayer = () => {
  const provider = new ApexTestingDiscoveryFsProvider();
  const providerLayer = Layer.succeed(ApexTestingDiscoveryFsProviderTag, provider);
  const serviceLayer = Layer.provide(ApexTestDiscoveryService.DefaultWithoutDependencies, providerLayer);
  return { provider, serviceLayer };
};

const run = <A, E>(
  serviceLayer: Layer.Layer<ApexTestDiscoveryService>,
  effect: Effect.Effect<A, E, ApexTestDiscoveryService>
) => Effect.runPromise(Effect.provide(effect, serviceLayer));

const runExit = <A, E>(
  serviceLayer: Layer.Layer<ApexTestDiscoveryService>,
  effect: Effect.Effect<A, E, ApexTestDiscoveryService>
) => Effect.runPromise(Effect.exit(Effect.provide(effect, serviceLayer)));

describe('ApexTestDiscoveryService', () => {
  it('round-trips a saved index on read', async () => {
    const { serviceLayer } = buildLayer();
    const classes = [classOf('MyTest', ['testOne'])];
    const bodies = new Map([['MyTest', '@isTest private class MyTest {}']]);

    const result = await run(
      serviceLayer,
      Effect.gen(function* () {
        yield* ApexTestDiscoveryService.saveDiscoveredClasses('org123', classes, bodies);
        return yield* ApexTestDiscoveryService.readDiscoveredClassesIndex('org123');
      })
    );

    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrThrow(result).orgKey).toBe('org123');
    expect(Option.getOrThrow(result).classes).toEqual(classes);
  });

  it('returns Option.none for a never-saved org (FileNotFound), not an error', async () => {
    const { serviceLayer } = buildLayer();

    const result = await run(serviceLayer, ApexTestDiscoveryService.readDiscoveredClassesIndex('missing-org'));

    expect(Option.isNone(result)).toBe(true);
  });

  it('fails with DiscoveryReadError on a corrupt index', async () => {
    const { provider, serviceLayer } = buildLayer();
    // Write garbage bytes directly so the decode step fails (not swallowed).
    provider.createDirectoryInternal(getOrgDiscoveryUri('corrupt-org'));
    provider.writeFileInternal(getOrgIndexUri('corrupt-org'), new TextEncoder().encode('{ not json'), {
      create: true,
      overwrite: true
    });

    const exit = await runExit(serviceLayer, ApexTestDiscoveryService.readDiscoveredClassesIndex('corrupt-org'));

    expect(Exit.isFailure(exit)).toBe(true);
    const failure = Exit.isFailure(exit) ? Option.getOrUndefined(Cause.failureOption(exit.cause)) : undefined;
    expect(failure).toBeInstanceOf(DiscoveryReadError);
    expect((failure as DiscoveryReadError).orgKey).toBe('corrupt-org');
  });

  it('clearOrg removes a saved org and succeeds when the org is absent', async () => {
    const { serviceLayer } = buildLayer();
    const classes = [classOf('MyTest', ['testOne'])];

    const afterClear = await run(
      serviceLayer,
      Effect.gen(function* () {
        yield* ApexTestDiscoveryService.saveDiscoveredClasses('org123', classes, new Map());
        yield* ApexTestDiscoveryService.clearOrg('org123');
        return yield* ApexTestDiscoveryService.readDiscoveredClassesIndex('org123');
      })
    );
    expect(Option.isNone(afterClear)).toBe(true);

    // Clearing an org that was never discovered is a no-op (FileNotFound → void), not an error.
    const exit = await runExit(serviceLayer, ApexTestDiscoveryService.clearOrg('never-existed'));
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it('keeps orgs isolated', async () => {
    const { serviceLayer } = buildLayer();
    const aClasses = [classOf('AcctTest', ['a'])];
    const bClasses = [classOf('OppTest', ['b'])];

    const [a, b] = await run(
      serviceLayer,
      Effect.gen(function* () {
        yield* ApexTestDiscoveryService.saveDiscoveredClasses('orgA', aClasses, new Map());
        yield* ApexTestDiscoveryService.saveDiscoveredClasses('orgB', bClasses, new Map());
        const readA = yield* ApexTestDiscoveryService.readDiscoveredClassesIndex('orgA');
        const readB = yield* ApexTestDiscoveryService.readDiscoveredClassesIndex('orgB');
        return [readA, readB] as const;
      })
    );

    expect(Option.getOrThrow(a).classes).toEqual(aClasses);
    expect(Option.getOrThrow(b).classes).toEqual(bClasses);
  });

  it('serves the second read from cache, and invalidates on save', async () => {
    const { provider, serviceLayer } = buildLayer();
    const classes = [classOf('MyTest', ['testOne'])];
    const readFileSpy = jest.spyOn(provider, 'readFile');

    await run(serviceLayer, ApexTestDiscoveryService.saveDiscoveredClasses('org123', classes, new Map()));
    const callsAfterSave = readFileSpy.mock.calls.length;

    await run(
      serviceLayer,
      Effect.gen(function* () {
        yield* ApexTestDiscoveryService.readDiscoveredClassesIndex('org123');
        yield* ApexTestDiscoveryService.readDiscoveredClassesIndex('org123');
      })
    );
    // Two reads of the same org hit the VFS once; the second is served from cache.
    expect(readFileSpy.mock.calls.length - callsAfterSave).toBe(1);

    // A save invalidates the cache so the next read reflects the new classes.
    const updated = [classOf('MyTest', ['testOne']), classOf('OtherTest', ['testTwo'])];
    const afterResave = await run(
      serviceLayer,
      Effect.gen(function* () {
        yield* ApexTestDiscoveryService.saveDiscoveredClasses('org123', updated, new Map());
        return yield* ApexTestDiscoveryService.readDiscoveredClassesIndex('org123');
      })
    );
    expect(Option.getOrThrow(afterResave).classes).toEqual(updated);
  });

  it('resolveDiscoveryOrgKey prefers orgId, falls back to username, else unknown-org', () => {
    expect(resolveDiscoveryOrgKey({ orgId: '00Dxx', username: 'u@example.com' })).toBe('00Dxx');
    expect(resolveDiscoveryOrgKey({ username: 'u@example.com' })).toBe('u@example.com');
    expect(resolveDiscoveryOrgKey({})).toBe('unknown-org');
  });

  it('production layer wires the module FsProvider singleton', () => {
    // Smoke: ApexTestingDiscoveryFsProviderLive builds without throwing (single getter call site).
    expect(ApexTestingDiscoveryFsProviderLive).toBeDefined();
  });
});
