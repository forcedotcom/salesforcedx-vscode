/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import { ApexTestDiscoveryService, resolveDiscoveryOrgKey } from '../../../src/discoveryVfs/apexTestDiscoveryService';
import {
  ApexTestingDiscoveryFsProviderLive,
  ApexTestingDiscoveryFsProviderTag
} from '../../../src/discoveryVfs/apexTestDiscoveryFsProviderTag';
import { getApexTestingClassUri, getOrgDiscoveryUri } from '../../../src/discoveryVfs/apexTestingDiscoveryFs';
import { ApexTestingDiscoveryFsProvider } from '../../../src/discoveryVfs/apexTestingDiscoveryFsProvider';
import type { ToolingTestClass } from '../../../src/testDiscovery/schemas';

const decoder = new TextDecoder();

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

const readClassBody = (provider: ApexTestingDiscoveryFsProvider, orgKey: string, fullClassName: string): string =>
  decoder.decode(provider.readFile(getApexTestingClassUri(orgKey, fullClassName)));

describe('ApexTestDiscoveryService', () => {
  it('writes a per-class .cls body into the VFS on save', async () => {
    const { provider, serviceLayer } = buildLayer();
    const classes = [classOf('MyTest', ['testOne'])];
    const bodies = new Map([['MyTest', '@isTest private class MyTest {}']]);

    await run(serviceLayer, ApexTestDiscoveryService.saveDiscoveredClasses('org123', classes, bodies));

    expect(readClassBody(provider, 'org123', 'MyTest')).toBe('@isTest private class MyTest {}');
  });

  it('writes a localized placeholder when no class body is supplied', async () => {
    const { provider, serviceLayer } = buildLayer();
    const classes = [classOf('MyTest', ['testOne'])];

    await run(serviceLayer, ApexTestDiscoveryService.saveDiscoveredClasses('org123', classes, new Map()));

    expect(readClassBody(provider, 'org123', 'MyTest').length).toBeGreaterThan(0);
  });

  it('clearOrg removes a saved org and succeeds when the org is absent', async () => {
    const { provider, serviceLayer } = buildLayer();
    const classes = [classOf('MyTest', ['testOne'])];

    await run(
      serviceLayer,
      Effect.gen(function* () {
        yield* ApexTestDiscoveryService.saveDiscoveredClasses('org123', classes, new Map());
        yield* ApexTestDiscoveryService.clearOrg('org123');
      })
    );
    expect(() => provider.readFile(getApexTestingClassUri('org123', 'MyTest'))).toThrow();
    expect(() => provider.readDirectory(getOrgDiscoveryUri('org123'))).toThrow();

    // Clearing an org that was never discovered is a no-op (FileNotFound → void), not an error.
    const exit = await runExit(serviceLayer, ApexTestDiscoveryService.clearOrg('never-existed'));
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it('re-saving an org replaces its prior classes', async () => {
    const { provider, serviceLayer } = buildLayer();

    await run(
      serviceLayer,
      Effect.gen(function* () {
        yield* ApexTestDiscoveryService.saveDiscoveredClasses('org123', [classOf('OldTest', ['a'])], new Map());
        yield* ApexTestDiscoveryService.saveDiscoveredClasses('org123', [classOf('NewTest', ['b'])], new Map());
      })
    );

    expect(readClassBody(provider, 'org123', 'NewTest').length).toBeGreaterThan(0);
    // clearOrg ran before the re-save, so the prior class is gone.
    expect(() => provider.readFile(getApexTestingClassUri('org123', 'OldTest'))).toThrow();
  });

  it('keeps orgs isolated', async () => {
    const { provider, serviceLayer } = buildLayer();

    await run(
      serviceLayer,
      Effect.gen(function* () {
        yield* ApexTestDiscoveryService.saveDiscoveredClasses('orgA', [classOf('AcctTest', ['a'])], new Map());
        yield* ApexTestDiscoveryService.saveDiscoveredClasses('orgB', [classOf('OppTest', ['b'])], new Map());
      })
    );

    expect(readClassBody(provider, 'orgA', 'AcctTest').length).toBeGreaterThan(0);
    expect(readClassBody(provider, 'orgB', 'OppTest').length).toBeGreaterThan(0);
    // An org's classes are not visible under the other org.
    expect(() => provider.readFile(getApexTestingClassUri('orgA', 'OppTest'))).toThrow();
  });

  it('resolveDiscoveryOrgKey prefers orgId, falls back to username, else unknown-org', () => {
    expect(resolveDiscoveryOrgKey({ orgId: '00Dxx', username: 'u@example.com' })).toBe('00Dxx');
    expect(resolveDiscoveryOrgKey({ username: 'u@example.com' })).toBe('u@example.com');
    expect(resolveDiscoveryOrgKey({})).toBe('unknown-org');
  });

  it('production layer resolves the FsProvider tag to a provider instance', async () => {
    const provider = await Effect.runPromise(
      Effect.provide(ApexTestingDiscoveryFsProviderTag, ApexTestingDiscoveryFsProviderLive)
    );
    expect(provider).toBeInstanceOf(ApexTestingDiscoveryFsProvider);
  });
});
