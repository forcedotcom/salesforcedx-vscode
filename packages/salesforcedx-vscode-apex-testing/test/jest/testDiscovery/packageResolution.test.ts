/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ResolvedPackageInfo } from '../../../src/testDiscovery/schemas';
import type { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { PackageResolutionService } from '../../../src/testDiscovery/packageResolution';

// PackageResolutionService.resolve resolves the connection via ConnectionService.getConnection() and the
// org key via TargetOrgRef, both reached ambiently through ExtensionProviderService. The tests drive the
// service through a stub ExtensionProviderService layer; connection.tooling.query is the controllable seam.
// buildLayer() constructs a fresh service instance (fresh Ref state) per run, so cache/unavailable state
// never leaks between tests. runWith resolves the service once and runs the whole program in one runtime,
// so multiple resolve() calls in one test share that instance's cache.
describe('PackageResolutionService', () => {
  let mockToolingQuery: jest.Mock;
  let mockConnection: Partial<Connection>;
  let orgInfo: { orgId?: string; username?: string };

  beforeEach(() => {
    mockToolingQuery = jest.fn();
    mockConnection = { tooling: { query: mockToolingQuery } as unknown as Connection['tooling'] };
    orgInfo = { orgId: 'org123', username: 'user@example.com' };
  });

  const buildLayer = () => {
    const mockApi = {
      services: {
        ConnectionService: { getConnection: () => Effect.succeed(mockConnection as Connection) },
        TargetOrgRef: () => SubscriptionRef.make(orgInfo)
      }
    };
    const ExtProviderLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockApi)
    } as unknown as ExtensionProviderService);
    // Provide the ext provider to the service AND keep it ambient (resolve yields it at call time).
    return Layer.merge(Layer.provide(PackageResolutionService.Default, ExtProviderLayer), ExtProviderLayer);
  };

  // The mock api provides ConnectionService/TargetOrgRef at runtime, but resolve's type still declares them
  // in R (via the static accessor types); erase R to never at the boundary, like apexTestExecutionService.test.
  const runWith = <A, E, R>(program: (svc: PackageResolutionService) => Effect.Effect<A, E, R>): Promise<A> =>
    Effect.runPromise(
      Effect.flatMap(PackageResolutionService, program).pipe(Effect.provide(buildLayer())) as Effect.Effect<A>
    );

  const resolve = (
    ids: string[],
    namespaces?: ReadonlyMap<string, Option.Option<string>>
  ): Promise<Map<string, ResolvedPackageInfo>> => runWith(svc => svc.resolve(ids, namespaces));

  it('returns empty map for empty class IDs', async () => {
    const result = await resolve([]);
    expect(result.size).toBe(0);
    expect(mockToolingQuery).not.toHaveBeenCalled();
  });

  it('queries Package2Member by SubjectId and selects SubscriberPackageId (not MetadataComponentId/Package2Id)', async () => {
    mockToolingQuery.mockResolvedValueOnce({ records: [] });
    await resolve(['01p000000000001AAA', '01p000000000002AAA']);
    const memberQuery = mockToolingQuery.mock.calls[0][0] as string;
    expect(memberQuery).toContain('FROM Package2Member');
    expect(memberQuery).toContain('WHERE SubjectId IN');
    expect(memberQuery).toContain('SubscriberPackageId');
    expect(memberQuery).not.toContain('MetadataComponentId');
    expect(memberQuery).not.toContain('Package2Id');
  });

  it('resolves 2GP package info via SubscriberPackageId join', async () => {
    mockToolingQuery
      .mockResolvedValueOnce({
        records: [{ Id: 'm1', SubjectId: '01p000000000001AAA', SubscriberPackageId: '033000000000001AAA' }]
      })
      .mockResolvedValueOnce({
        records: [{ Id: '0Ho000000000001AAA', Name: 'My Package', SubscriberPackageId: '033000000000001AAA' }]
      });
    const result = await resolve(['01p000000000001AAA']);
    expect(result.size).toBe(1);
    const info = result.get('01p000000000001AAA');
    expect(info?.package2Id).toBe('0Ho000000000001AAA');
    expect(info?.packageName).toBe('My Package');
    expect(mockToolingQuery).toHaveBeenCalledTimes(2);
    expect(mockToolingQuery.mock.calls[1][0]).toContain('WHERE SubscriberPackageId IN');
  });

  it('returns empty map (does not fail) when Package2Member query fails and no fallback namespace map', async () => {
    mockToolingQuery.mockRejectedValueOnce(new Error('Permission denied'));
    const result = await resolve(['01p000000000001AAA']);
    expect(result.size).toBe(0);
  });

  it('returns empty map (does not fail) when Package2 join query fails', async () => {
    mockToolingQuery
      .mockResolvedValueOnce({
        records: [{ Id: 'm1', SubjectId: '01p000000000001AAA', SubscriberPackageId: '033000000000001AAA' }]
      })
      .mockRejectedValueOnce(new Error('Package2 not found'));
    const result = await resolve(['01p000000000001AAA']);
    expect(result.size).toBe(0);
  });

  it('skips empty or invalid class IDs', async () => {
    mockToolingQuery.mockResolvedValueOnce({ records: [] });
    const result = await resolve(['', '01p000000000001AAA']);
    expect(result.size).toBe(0);
    expect(mockToolingQuery).toHaveBeenCalledWith(expect.stringContaining('01p000000000001AAA'));
    expect(mockToolingQuery).not.toHaveBeenCalledWith(expect.stringContaining("''"));
  });

  it('caches results for the same org (second call does not re-query)', async () => {
    mockToolingQuery
      .mockResolvedValueOnce({ records: [{ Id: 'm1', SubjectId: '01pAAA', SubscriberPackageId: '033AAA' }] })
      .mockResolvedValueOnce({ records: [{ Id: '0HoAAA', Name: 'Pkg', SubscriberPackageId: '033AAA' }] });
    const { first, callsAfterFirst, second } = await runWith(svc =>
      Effect.gen(function* () {
        const firstResult = yield* svc.resolve(['01pAAA']);
        const calls = mockToolingQuery.mock.calls.length;
        const secondResult = yield* svc.resolve(['01pAAA']);
        return { first: firstResult, callsAfterFirst: calls, second: secondResult };
      })
    );
    expect(first.size).toBe(1);
    expect(callsAfterFirst).toBe(2);
    expect(second.size).toBe(1);
    expect(mockToolingQuery).toHaveBeenCalledTimes(2);
  });

  it('resolves package via enumeration fallback when direct query returns no rows', async () => {
    const classId = '01p000000000003AAA';
    mockToolingQuery
      // direct member-by-SubjectId query: no rows
      .mockResolvedValueOnce({ records: [] })
      // fallback: Package2 list
      .mockResolvedValueOnce({
        records: [{ Id: '0Ho000000000002AAA', Name: 'Unlocked Package', SubscriberPackageId: '033000000000002AAA' }]
      })
      // fallback: Package2Member for that package by SubscriberPackageId
      .mockResolvedValueOnce({
        records: [{ Id: 'm1', SubjectId: classId, SubscriberPackageId: '033000000000002AAA' }]
      });
    const result = await resolve([classId]);
    expect(result.size).toBe(1);
    const info = result.get(classId);
    expect(info?.package2Id).toBe('0Ho000000000002AAA');
    expect(info?.packageName).toBe('Unlocked Package');
    expect(mockToolingQuery).toHaveBeenCalledTimes(3);
    expect(mockToolingQuery.mock.calls[1][0]).toContain('FROM Package2');
    expect(mockToolingQuery.mock.calls[2][0]).toContain('FROM Package2Member');
    expect(mockToolingQuery.mock.calls[2][0]).toContain('WHERE SubscriberPackageId =');
  });

  it('resolves from InstalledSubscriberPackage when Package2Member is unavailable and namespace map is provided', async () => {
    const classId = '01p000000000001AAA';
    mockToolingQuery
      .mockRejectedValueOnce(new Error("sObject type 'Package2Member' is not supported."))
      .mockResolvedValueOnce({
        records: [
          {
            Id: '0Hi000000000001AAA',
            SubscriberPackageId: '033xx000000001AAA',
            SubscriberPackage: { NamespacePrefix: 'taf', Name: 'Trigger Actions Framework' }
          }
        ]
      });
    const classIdToNamespace = new Map<string, Option.Option<string>>([
      [classId, Option.some('taf')],
      ['01p000000000002AAA', Option.none()]
    ]);
    const result = await resolve([classId, '01p000000000002AAA'], classIdToNamespace);
    expect(result.size).toBe(1);
    const info = result.get(classId);
    expect(info?.packageName).toBe('Trigger Actions Framework');
    expect(info?.package2Id).toBe('033xx000000001AAA');
    expect(mockToolingQuery).toHaveBeenCalledTimes(2);
    expect(mockToolingQuery.mock.calls[1][0]).toContain('InstalledSubscriberPackage');
  });

  it('resolves no-namespace classes to the single no-namespace package (Skyline resolveNoNamespaceInstalledItem)', async () => {
    const classId = '01p000000000001AAA';
    mockToolingQuery
      .mockRejectedValueOnce(new Error("sObject type 'Package2Member' is not supported."))
      .mockResolvedValueOnce({
        records: [
          {
            Id: '0Hi000000000001AAA',
            SubscriberPackageId: '033xx000000001AAA',
            SubscriberPackage: { NamespacePrefix: null, Name: 'Trigger Actions Framework' }
          }
        ]
      })
      .mockResolvedValueOnce({ records: [{ Id: classId, ManageableState: 'installedEditable' }] });
    const classIdToNamespace = new Map<string, Option.Option<string>>([[classId, Option.none()]]);
    const result = await resolve([classId], classIdToNamespace);
    expect(result.size).toBe(1);
    const info = result.get(classId);
    expect(info?.packageName).toBe('Trigger Actions Framework');
    expect(Option.getOrNull(info!.containerOptions)).toBe('Unlocked');
    expect(mockToolingQuery).toHaveBeenCalledTimes(3);
    expect(mockToolingQuery.mock.calls[1][0]).toContain('InstalledSubscriberPackage');
    expect(mockToolingQuery.mock.calls[2][0]).toContain('ApexClass');
    expect(mockToolingQuery.mock.calls[2][0]).toContain('ManageableState');
  });

  it('only resolves no-namespace classes with installed ManageableState (null/empty excluded)', async () => {
    const installedId = '01p000000000001AAA';
    const unpackagedId = '01p000000000002AAA';
    mockToolingQuery
      .mockRejectedValueOnce(new Error("sObject type 'Package2Member' is not supported."))
      .mockResolvedValueOnce({
        records: [
          {
            Id: '0Hi000000000001AAA',
            SubscriberPackageId: '033xx000000001AAA',
            SubscriberPackage: { NamespacePrefix: null, Name: 'Trigger Actions Framework' }
          }
        ]
      })
      .mockResolvedValueOnce({
        records: [
          { Id: installedId, ManageableState: 'installed' },
          { Id: unpackagedId, ManageableState: null }
        ]
      });
    const classIdToNamespace = new Map<string, Option.Option<string>>([
      [installedId, Option.none()],
      [unpackagedId, Option.none()]
    ]);
    const result = await resolve([installedId, unpackagedId], classIdToNamespace);
    expect(result.size).toBe(1);
    expect(result.get(installedId)?.packageName).toBe('Trigger Actions Framework');
    expect(result.has(unpackagedId)).toBe(false);
  });

  it('serves cached resolution and does not re-query once the org is marked unavailable', async () => {
    const classId = '01p000000000001AAA';
    mockToolingQuery
      .mockRejectedValueOnce(new Error("sObject type 'Package2Member' is not supported."))
      .mockResolvedValueOnce({
        records: [
          {
            Id: '0Hi000000000001AAA',
            SubscriberPackageId: '033xx000000001AAA',
            SubscriberPackage: { NamespacePrefix: null, Name: 'Trigger Actions Framework' }
          }
        ]
      })
      .mockResolvedValueOnce({ records: [{ Id: classId, ManageableState: 'installedEditable' }] });
    const classIdToNamespace = new Map<string, Option.Option<string>>([[classId, Option.none()]]);
    const { first, second } = await runWith(svc =>
      Effect.gen(function* () {
        const firstResult = yield* svc.resolve([classId], classIdToNamespace);
        const secondResult = yield* svc.resolve([classId], classIdToNamespace);
        return { first: firstResult, second: secondResult };
      })
    );
    expect(first.get(classId)?.packageName).toBe('Trigger Actions Framework');
    expect(second.get(classId)?.packageName).toBe('Trigger Actions Framework');
    // Second call short-circuits on the unavailable-org cache: no additional queries.
    expect(mockToolingQuery).toHaveBeenCalledTimes(3);
  });
});
