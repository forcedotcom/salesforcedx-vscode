/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { ConnectionService } from '../../../src/core/connectionService';
import { getDefaultOrgRef, clearDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { TraceFlagService } from '../../../src/core/traceFlagService';

type IdName = { Id: string; Name: string };

type TraceFlagRow = {
  Id: string;
  LogType: 'DEVELOPER_LOG' | 'USER_DEBUG' | 'CLASS_TRACING';
  StartDate: string | null;
  ExpirationDate: string;
  DebugLevelId: string | null;
  TracedEntityId: string | null;
  DebugLevel?: { ApexCode?: string; Visualforce?: string; DeveloperName?: string };
};

type QuerySpy = jest.Mock<Promise<{ records: unknown[]; totalSize: number }>, [string]>;

const farFuture = () => new Date(Date.now() + 1000 * 60 * 60).toISOString();

const makeTraceFlagRow = (id: string, tracedEntityId: string): TraceFlagRow => ({
  Id: id,
  LogType: 'DEVELOPER_LOG',
  StartDate: new Date().toISOString(),
  ExpirationDate: farFuture(),
  DebugLevelId: 'dl1',
  TracedEntityId: tracedEntityId
});

const buildMockConnectionLayer = (opts: {
  traceFlagRowsBySequence: TraceFlagRow[][];
  toolingNameRowsBySoql: Map<string, IdName[]>;
  userNameRowsBySoql: Map<string, IdName[]>;
}): { layer: Layer.Layer<ConnectionService>; toolingSpy: QuerySpy; querySpy: QuerySpy } => {
  let traceFlagCallIndex = 0;
  const toolingSpy: QuerySpy = jest.fn(async (soql: string) => {
    if (soql.includes('FROM TraceFlag')) {
      const tfRows = opts.traceFlagRowsBySequence[traceFlagCallIndex] ?? [];
      traceFlagCallIndex += 1;
      return { records: tfRows, totalSize: tfRows.length };
    }
    const nameRows = opts.toolingNameRowsBySoql.get(soql) ?? [];
    return { records: nameRows, totalSize: nameRows.length };
  });
  const querySpy: QuerySpy = jest.fn(async (soql: string) => {
    const nameRows = opts.userNameRowsBySoql.get(soql) ?? [];
    return { records: nameRows, totalSize: nameRows.length };
  });
  const layer = Layer.succeed(
    ConnectionService,
    ConnectionService.make({
      getConnection: () =>
        Effect.succeed({
          tooling: { query: toolingSpy },
          query: querySpy
        } as unknown as Connection),
      invalidateCachedConnections: () => Effect.void
    })
  );
  return { layer, toolingSpy, querySpy };
};

const setOrg = (info: { orgId?: string; username?: string; alias?: string }) =>
  Effect.gen(function* () {
    const ref = yield* getDefaultOrgRef();
    yield* SubscriptionRef.set(ref, info);
  });

const userIdInClause = (ids: string[]) => `SELECT Id, Name FROM User WHERE Id IN (${ids.map(i => `'${i}'`).join(',')})`;
const apexClassIdInClause = (ids: string[]) =>
  `SELECT Id, Name FROM ApexClass WHERE Id IN (${ids.map(i => `'${i}'`).join(',')})`;
const apexTriggerIdInClause = (ids: string[]) =>
  `SELECT Id, Name FROM ApexTrigger WHERE Id IN (${ids.map(i => `'${i}'`).join(',')})`;

const runScoped = <A, E>(
  prog: Effect.Effect<A, E, TraceFlagService | Scope.Scope>,
  layer: Layer.Layer<ConnectionService>
) =>
  Effect.runPromise(
    Effect.scoped(prog).pipe(Effect.provide(Layer.provide(TraceFlagService.DefaultWithoutDependencies, layer)))
  );

describe('TraceFlagService.getTraceFlags id->name cache', () => {
  beforeEach(async () => {
    await Effect.runPromise(clearDefaultOrgRef());
  });

  it('queries name lookups on first call, skips them on second call (warm cache)', async () => {
    const u1 = '005000000000001';
    const c1 = '01p000000000001';
    const rows = [makeTraceFlagRow('7tf1', u1), makeTraceFlagRow('7tf2', c1)];
    const { layer, toolingSpy, querySpy } = buildMockConnectionLayer({
      traceFlagRowsBySequence: [rows, rows],
      toolingNameRowsBySoql: new Map([[apexClassIdInClause([c1]), [{ Id: c1, Name: 'MyClass' }]]]),
      userNameRowsBySoql: new Map([[userIdInClause([u1]), [{ Id: u1, Name: 'Alice' }]]])
    });

    const result = await runScoped(
      Effect.gen(function* () {
        yield* setOrg({ orgId: 'org-A', username: 'a@example.com' });
        const svc = yield* TraceFlagService;
        const first = yield* svc.getTraceFlags();
        const second = yield* svc.getTraceFlags();
        return { first, second };
      }),
      layer
    );

    expect(result.first.find(f => f.id === '7tf1')?.tracedEntityName).toBe('Alice');
    expect(result.first.find(f => f.id === '7tf2')?.tracedEntityName).toBe('MyClass');
    expect(result.second.find(f => f.id === '7tf1')?.tracedEntityName).toBe('Alice');

    const userQueries = querySpy.mock.calls.filter(c => c[0].includes('FROM User'));
    const classQueries = toolingSpy.mock.calls.filter(c => c[0].includes('FROM ApexClass'));
    expect(userQueries).toHaveLength(1);
    expect(classQueries).toHaveLength(1);
  });

  it('queries only the missing ID on second call when a new entity is added', async () => {
    const u1 = '005000000000001';
    const c1 = '01p000000000001';
    const c2 = '01p000000000002';
    const firstRows = [makeTraceFlagRow('7tf1', u1), makeTraceFlagRow('7tf2', c1)];
    const secondRows = [...firstRows, makeTraceFlagRow('7tf3', c2)];
    const { layer, toolingSpy, querySpy } = buildMockConnectionLayer({
      traceFlagRowsBySequence: [firstRows, secondRows],
      toolingNameRowsBySoql: new Map([
        [apexClassIdInClause([c1]), [{ Id: c1, Name: 'MyClass' }]],
        [apexClassIdInClause([c2]), [{ Id: c2, Name: 'OtherClass' }]]
      ]),
      userNameRowsBySoql: new Map([[userIdInClause([u1]), [{ Id: u1, Name: 'Alice' }]]])
    });

    const result = await runScoped(
      Effect.gen(function* () {
        yield* setOrg({ orgId: 'org-A', username: 'a@example.com' });
        const svc = yield* TraceFlagService;
        yield* svc.getTraceFlags();
        return yield* svc.getTraceFlags();
      }),
      layer
    );

    expect(result.find(f => f.id === '7tf3')?.tracedEntityName).toBe('OtherClass');
    const classCalls = toolingSpy.mock.calls.filter(c => c[0].includes('FROM ApexClass')).map(c => c[0]);
    expect(classCalls).toEqual([apexClassIdInClause([c1]), apexClassIdInClause([c2])]);
    expect(querySpy.mock.calls.filter(c => c[0].includes('FROM User'))).toHaveLength(1);
  });

  it('does not cache misses — re-queries an ID whose Name was never returned', async () => {
    const u1 = '005000000000001';
    const u2 = '005000000000002';
    const rows = [makeTraceFlagRow('7tf1', u1), makeTraceFlagRow('7tf2', u2)];
    const { layer, querySpy } = buildMockConnectionLayer({
      traceFlagRowsBySequence: [rows, rows],
      toolingNameRowsBySoql: new Map(),
      // first call returns only u1; u2 missing
      userNameRowsBySoql: new Map([[userIdInClause([u1, u2]), [{ Id: u1, Name: 'Alice' }]]])
    });

    await runScoped(
      Effect.gen(function* () {
        yield* setOrg({ orgId: 'org-A', username: 'a@example.com' });
        const svc = yield* TraceFlagService;
        yield* svc.getTraceFlags();
        return yield* svc.getTraceFlags();
      }),
      layer
    );

    const userCalls = querySpy.mock.calls.filter(c => c[0].includes('FROM User')).map(c => c[0]);
    // First: queries both ids. Second: u1 cached, u2 still uncached -> queries only u2.
    expect(userCalls).toEqual([userIdInClause([u1, u2]), userIdInClause([u2])]);
  });

  it('invalidates the cache when default org changes', async () => {
    const u1 = '005000000000001';
    const rows = [makeTraceFlagRow('7tf1', u1)];
    const { layer, querySpy } = buildMockConnectionLayer({
      traceFlagRowsBySequence: [rows, rows],
      toolingNameRowsBySoql: new Map(),
      userNameRowsBySoql: new Map([[userIdInClause([u1]), [{ Id: u1, Name: 'Alice' }]]])
    });

    await runScoped(
      Effect.gen(function* () {
        yield* setOrg({ orgId: 'org-A', username: 'a@example.com' });
        const svc = yield* TraceFlagService;
        yield* svc.getTraceFlags();
        yield* setOrg({ orgId: 'org-B', username: 'b@example.com' });
        // Yield once to let the org-change subscription fiber process the invalidation.
        yield* Effect.sleep(0);
        return yield* svc.getTraceFlags();
      }),
      layer
    );

    expect(querySpy.mock.calls.filter(c => c[0].includes('FROM User'))).toHaveLength(2);
  });

  it('does not invalidate the cache when a non-identity field (alias) changes on same org', async () => {
    const u1 = '005000000000001';
    const rows = [makeTraceFlagRow('7tf1', u1)];
    const { layer, querySpy } = buildMockConnectionLayer({
      traceFlagRowsBySequence: [rows, rows],
      toolingNameRowsBySoql: new Map(),
      userNameRowsBySoql: new Map([[userIdInClause([u1]), [{ Id: u1, Name: 'Alice' }]]])
    });

    await runScoped(
      Effect.gen(function* () {
        yield* setOrg({ orgId: 'org-A', username: 'a@example.com' });
        const svc = yield* TraceFlagService;
        yield* svc.getTraceFlags();
        yield* setOrg({ orgId: 'org-A', username: 'a@example.com', alias: 'changed-alias' });
        yield* Effect.sleep(0);
        return yield* svc.getTraceFlags();
      }),
      layer
    );

    expect(querySpy.mock.calls.filter(c => c[0].includes('FROM User'))).toHaveLength(1);
  });

  it('skips name resolution for unknown ID prefixes', async () => {
    const unknown = '999000000000001';
    const rows = [makeTraceFlagRow('7tf1', unknown)];
    const { layer, toolingSpy, querySpy } = buildMockConnectionLayer({
      traceFlagRowsBySequence: [rows],
      toolingNameRowsBySoql: new Map(),
      userNameRowsBySoql: new Map()
    });

    const result = await runScoped(
      Effect.gen(function* () {
        yield* setOrg({ orgId: 'org-A', username: 'a@example.com' });
        const svc = yield* TraceFlagService;
        return yield* svc.getTraceFlags();
      }),
      layer
    );

    expect(result.find(f => f.id === '7tf1')?.tracedEntityName).toBeUndefined();
    expect(toolingSpy.mock.calls.filter(c => !c[0].includes('FROM TraceFlag'))).toHaveLength(0);
    expect(querySpy).not.toHaveBeenCalled();
  });

  it('queries ApexTrigger names with the 01q prefix branch', async () => {
    const t1 = '01q000000000001';
    const rows = [makeTraceFlagRow('7tf1', t1)];
    const { layer, toolingSpy } = buildMockConnectionLayer({
      traceFlagRowsBySequence: [rows],
      toolingNameRowsBySoql: new Map([[apexTriggerIdInClause([t1]), [{ Id: t1, Name: 'MyTrigger' }]]]),
      userNameRowsBySoql: new Map()
    });

    const result = await runScoped(
      Effect.gen(function* () {
        yield* setOrg({ orgId: 'org-A', username: 'a@example.com' });
        const svc = yield* TraceFlagService;
        return yield* svc.getTraceFlags();
      }),
      layer
    );

    expect(result.find(f => f.id === '7tf1')?.tracedEntityName).toBe('MyTrigger');
    expect(toolingSpy.mock.calls.filter(c => c[0].includes('FROM ApexTrigger'))).toHaveLength(1);
  });
});
