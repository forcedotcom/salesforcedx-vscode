/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import {
  ConnectionService,
  DebugLevelItemSchema,
  OrgId,
  QueryService,
  TargetOrgRef,
  TraceFlagItemSchema,
  TraceFlagItemStruct,
  TraceFlagService,
  type DefaultOrgInfo,
  type QueryOptions
} from '@salesforce/vscode-services/v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as TestClock from 'effect/testing/TestClock';
import { setImmediate } from 'node:timers/promises';
import { TraceFlagServiceLayer } from '../../../src/services/traceFlagService.js';

const NOW = Date.parse('2026-11-02T00:00:00.000Z');
const row = (id = '7tf000000000001', entity: string | null = '005000000000001') => ({
  Id: id,
  LogType: 'DEVELOPER_LOG',
  StartDate: '2026-11-02T00:00:00.000Z',
  ExpirationDate: '2030-01-01T00:00:00.000Z',
  DebugLevelId: '7dl000000000001',
  TracedEntityId: entity
});
const decodeFlag = Schema.decodeUnknownSync(TraceFlagItemSchema);
const toolingCreate = vi.fn<(...args: unknown[]) => Promise<{ success: boolean; id?: string; errors: never[] }>>();
const toolingUpdate = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const toolingDelete = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const connection = {
  tooling: { create: toolingCreate, update: toolingUpdate, delete: toolingDelete }
} as unknown as Connection;
let rows: unknown[];
let nameRows: unknown[];
let debugRows: unknown[];
let queryFailure: Error | undefined;
let queryDefect: unknown;
const queries: QueryOptions[] = [];
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  rows = [];
  nameRows = [];
  debugRows = [];
  queryFailure = undefined;
  queryDefect = undefined;
  queries.splice(0);
  toolingCreate.mockResolvedValue({ success: true, id: 'created-id', errors: [] });
  toolingUpdate.mockResolvedValue({ success: true });
  toolingDelete.mockResolvedValue({ success: true });
});
afterEach(() => vi.restoreAllMocks());
const query: QueryService['Service']['query'] = (options, decodePage) => {
  queries.push(options);
  if (queryDefect) return Effect.die(queryDefect);
  return Effect.tryPromise(() =>
    queryFailure
      ? Promise.reject(queryFailure)
      : Promise.resolve(
          options.soql.includes('FROM TraceFlag')
            ? rows
            : options.soql.includes('FROM DebugLevel')
              ? debugRows
              : nameRows
        )
  ).pipe(
    Effect.flatMap(records => decodePage({ totalSize: records.length, records, done: true })),
    Effect.map(page => ({ totalSize: page.totalSize, records: Stream.fromIterable(page.records ?? []) }))
  );
};
const fixture = async () => {
  const ref = await Effect.runPromise(SubscriptionRef.make<DefaultOrgInfo>({ userId: '005000000000001' }));
  const runtime = ManagedRuntime.make(
    TraceFlagServiceLayer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.mock(ConnectionService, { getConnection: () => Effect.succeed(connection) }),
          Layer.mock(QueryService, { query }),
          Layer.effect(
            TargetOrgRef,
            Effect.acquireRelease(Effect.succeed(ref), value => PubSub.shutdown(value.pubsub))
          )
        )
      ),
      Layer.provideMerge(TestClock.layer())
    )
  );
  await runtime.runPromise(TestClock.setTime(NOW));
  const service = await runtime.runPromise(TraceFlagService);
  return { runtime, ref, service };
};

it.each([null, undefined, '', '   '])('preserves missing/blank start dates and orphaned relationships: %s', start => {
  const result = decodeFlag({ ...row(), StartDate: start, DebugLevelId: null, DebugLevel: null, TracedEntityId: null });
  expect(result).toMatchObject({
    id: row().Id,
    logType: 'DEVELOPER_LOG',
    isActive: true,
    expirationDate: new Date('2030-01-01T00:00:00.000Z')
  });
  expect(result.startDate).toBeUndefined();
  expect(result.debugLevelId).toBeUndefined();
  expect(result.debugLevelName).toBeUndefined();
});
it('round-trips dates, debug-level relationships and entity names without accepting invalid dates', () => {
  const value = { ...row(), DebugLevel: { DeveloperName: 'ReplayDebuggerLevels' }, TracedEntityName: 'Alice' };
  const decoded = decodeFlag(value);
  expect(decoded.startDate).toEqual(new Date(value.StartDate));
  expect(Schema.encodeSync(TraceFlagItemSchema)(decoded)).toMatchObject(value);
  expect(() => decodeFlag({ ...row(), ExpirationDate: 'invalid' })).toThrow();
  expect(() => decodeFlag({ ...row(), StartDate: 'invalid' })).toThrow();
  expect(() => decodeFlag({ ...row(), LogType: 'INVALID' })).toThrow();
});

it('preserves the separately exported JSON client-item date codec', () => {
  const wire = {
    id: '7tf1',
    logType: 'DEVELOPER_LOG',
    startDate: new Date(NOW).toISOString(),
    expirationDate: '2030-01-01T00:00:00.000Z',
    isActive: true
  };
  const codec = Schema.fromJsonString(TraceFlagItemStruct);
  const value = Schema.decodeUnknownSync(codec)(JSON.stringify(wire));
  expect(value.startDate).toEqual(new Date(NOW));
  expect(value.expirationDate).toEqual(new Date(wire.expirationDate));
  expect(JSON.parse(Schema.encodeSync(codec)(value))).toEqual(wire);
});
it('defaults null/missing categories to NONE and exposes camel-case DebugLevel fields', () => {
  const decoded = Schema.decodeUnknownSync(DebugLevelItemSchema)({
    Id: '7dl1',
    DeveloperName: 'Custom',
    MasterLabel: 'Custom label',
    Language: null,
    ApexCode: 'FINEST',
    Visualforce: null
  });
  expect(decoded).toEqual({
    id: '7dl1',
    developerName: 'Custom',
    masterLabel: 'Custom label',
    language: null,
    apexCode: 'FINEST',
    visualforce: 'NONE',
    apexProfiling: 'NONE',
    callout: 'NONE',
    database: 'NONE',
    nba: 'NONE',
    system: 'NONE',
    validation: 'NONE',
    wave: 'NONE',
    workflow: 'NONE'
  });
  expect(() =>
    Schema.decodeUnknownSync(DebugLevelItemSchema)({
      Id: 'x',
      DeveloperName: 'x',
      MasterLabel: 'x',
      Language: null,
      ApexCode: 'INVALID'
    })
  ).toThrow();
});
it('batches entity names by prefix, keeps warm hits, and does not cache misses', async () => {
  rows = [row(), row('7tf2', '01p000000000001'), row('7tf3', '005000000000002'), row('7tf4', '999000000000001')];
  nameRows = [
    { Id: '005000000000001', Name: 'Alice' },
    { Id: '01p000000000001', Name: 'ClassOne' }
  ];
  const { runtime, service } = await fixture();
  try {
    expect((await runtime.runPromise(service.getTraceFlags())).map(value => value.tracedEntityName)).toEqual([
      'Alice',
      'ClassOne',
      undefined,
      undefined
    ]);
    await runtime.runPromise(service.getTraceFlags());
    expect(queries.filter(value => value.soql.includes('FROM User')).map(value => value.soql)).toEqual([
      "SELECT Id, Name FROM User WHERE Id IN ('005000000000001','005000000000002')",
      "SELECT Id, Name FROM User WHERE Id IN ('005000000000002')"
    ]);
    expect(queries.filter(value => value.soql.includes('FROM ApexClass'))).toHaveLength(1);
    expect(queries.filter(value => value.soql.includes('999000000000001'))).toHaveLength(0);
    expect(queries.find(value => value.soql.includes('FROM User'))?.tooling).toBe(false);
  } finally {
    await runtime.dispose();
  }
});
it('invalidates names for org-ID changes, not alias-only changes, and closes owned state', async () => {
  rows = [row()];
  nameRows = [{ Id: '005000000000001', Name: 'Alice' }];
  const { runtime, service, ref } = await fixture();
  try {
    await runtime.runPromise(service.getTraceFlags());
    await runtime.runPromise(SubscriptionRef.set(ref, { userId: '005000000000001', alias: 'new alias' }));
    await setImmediate();
    await runtime.runPromise(service.getTraceFlags());
    expect(queries.filter(value => value.soql.includes('FROM User'))).toHaveLength(1);
    await runtime.runPromise(SubscriptionRef.set(ref, { userId: '005000000000001' }));
    // Changing to a canonical org identity must invalidate the warmed cache.
    await runtime.runPromise(
      SubscriptionRef.set(ref, { orgId: Schema.decodeUnknownSync(OrgId)('00D000000000001'), userId: '005000000000001' })
    );
    await setImmediate();
    await runtime.runPromise(service.getTraceFlags());
    expect(queries.filter(value => value.soql.includes('FROM User'))).toHaveLength(2);
    await runtime.dispose();
    expect(await Effect.runPromise(PubSub.isShutdown(service.traceFlagsChanged))).toBe(true);
    expect(Exit.isFailure(await Effect.runPromiseExit(service.getTraceFlags()))).toBe(true);
  } finally {
    await runtime.dispose();
  }
});
it('uses the latest user ID and returns a typed missing-user error', async () => {
  const { runtime, service, ref } = await fixture();
  try {
    expect(await runtime.runPromise(service.getUserId())).toBe('005000000000001');
    await runtime.runPromise(SubscriptionRef.set(ref, {}));
    expect(await runtime.runPromise(service.getUserId().pipe(Effect.flip))).toMatchObject({
      _tag: 'UserIdNotFoundError'
    });
  } finally {
    await runtime.dispose();
  }
});
it('lists debug levels and finds the newest user/log-type trace flag', async () => {
  rows = [row()];
  debugRows = [{ Id: '7dl1', DeveloperName: 'Level', MasterLabel: 'Label', Language: null }];
  const { runtime, service } = await fixture();
  try {
    expect((await runtime.runPromise(service.getDebugLevels()))[0]?.developerName).toBe('Level');
    expect(Option.isSome(await runtime.runPromise(service.getTraceFlagForUser('005000000000001', 'USER_DEBUG')))).toBe(
      true
    );
    expect(queries.at(-1)?.soql).toContain(
      "WHERE LogType='USER_DEBUG' AND TracedEntityId='005000000000001' ORDER BY ExpirationDate DESC LIMIT 1"
    );
    rows = [];
    expect(Option.isNone(await runtime.runPromise(service.getTraceFlagForUser('005000000000001')))).toBe(true);
  } finally {
    await runtime.dispose();
  }
});
it('creates replay debug levels on demand and reuses a returned ID', async () => {
  const { runtime, service } = await fixture();
  try {
    expect(await runtime.runPromise(service.getOrCreateDebugLevel())).toBe('created-id');
    expect(toolingCreate).toHaveBeenCalledWith(
      'DebugLevel',
      expect.objectContaining({
        DeveloperName: 'ReplayDebuggerLevels',
        MasterLabel: 'ReplayDebuggerLevels',
        ApexCode: 'FINEST',
        Visualforce: 'FINER',
        ApexProfiling: 'NONE'
      })
    );
    debugRows = [{ Id: '7dl000000000001' }];
    expect(await runtime.runPromise(service.getOrCreateDebugLevel())).toBe('7dl000000000001');
    expect(toolingCreate).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});
it('preserves create duration/log type and updates DebugLevel before TraceFlag', async () => {
  const { runtime, service } = await fixture();
  try {
    expect(
      await runtime.runPromise(service.createTraceFlag('user-id', 'level-id', Duration.hours(1), 'CLASS_TRACING'))
    ).toBe('created-id');
    expect(toolingCreate).toHaveBeenCalledWith('TraceFlag', {
      TracedEntityId: 'user-id',
      DebugLevelId: 'level-id',
      LogType: 'CLASS_TRACING',
      StartDate: new Date(NOW).toISOString(),
      ExpirationDate: new Date(NOW + 3_600_000).toISOString()
    });
    await runtime.runPromise(
      service.updateTraceFlag('flag-id', { debugLevelId: 'level-id', expirationDate: new Date(NOW + 1000) })
    );
    expect(toolingUpdate.mock.calls).toEqual([
      ['DebugLevel', { Id: 'level-id', ApexCode: 'FINEST', Visualforce: 'FINER' }],
      [
        'TraceFlag',
        { Id: 'flag-id', StartDate: new Date(NOW).toISOString(), ExpirationDate: new Date(NOW + 1000).toISOString() }
      ]
    ]);
  } finally {
    await runtime.dispose();
  }
});
it.each(['none', 'expired', 'valid', 'extend', 'change-level'] as const)(
  'ensures a %s trace flag without unnecessary mutations',
  async state => {
    rows =
      state === 'none'
        ? []
        : [
            {
              ...row(),
              ExpirationDate: new Date(
                state === 'expired' ? NOW - 1 : state === 'extend' ? NOW + 1 : NOW + 3_600_000
              ).toISOString(),
              DebugLevelId: state === 'change-level' ? 'old-level' : 'level-id'
            }
          ];
    const { runtime, service } = await fixture();
    try {
      const result = await runtime.runPromise(
        service.ensureTraceFlag('user-id', Duration.minutes(30), 'DEVELOPER_LOG', 'level-id')
      );
      expect(result).toEqual({
        created: state === 'none' || state === 'expired',
        traceFlagId: state === 'none' || state === 'expired' ? 'created-id' : row().Id
      });
      expect(toolingCreate).toHaveBeenCalledTimes(state === 'none' || state === 'expired' ? 1 : 0);
      expect(toolingDelete).toHaveBeenCalledTimes(state === 'expired' ? 1 : 0);
      expect(toolingUpdate).toHaveBeenCalledTimes(state === 'extend' || state === 'change-level' ? 1 : 0);
      if (state === 'none' || state === 'expired')
        expect(toolingCreate).toHaveBeenCalledWith(
          'TraceFlag',
          expect.objectContaining({
            TracedEntityId: 'user-id',
            DebugLevelId: 'level-id',
            LogType: 'DEVELOPER_LOG',
            ExpirationDate: new Date(NOW + 1_800_000).toISOString()
          })
        );
      if (state === 'expired') expect(toolingDelete).toHaveBeenCalledWith('TraceFlag', row().Id);
      if (state === 'extend')
        expect(toolingUpdate).toHaveBeenCalledWith('TraceFlag', {
          Id: row().Id,
          StartDate: new Date(NOW).toISOString(),
          ExpirationDate: new Date(NOW + 1_800_000).toISOString()
        });
      if (state === 'change-level')
        expect(toolingUpdate).toHaveBeenCalledWith('TraceFlag', { Id: row().Id, DebugLevelId: 'level-id' });
    } finally {
      await runtime.dispose();
    }
  }
);
it('keeps successful writes successful when optional refresh fails, but preserves write errors', async () => {
  queryFailure = new Error('query unavailable');
  const { runtime, service } = await fixture();
  try {
    await runtime.runPromise(service.deleteTraceFlag('flag-id'));
    const cause = new Error('delete failed');
    toolingDelete.mockRejectedValueOnce(cause);
    expect(await runtime.runPromise(service.deleteTraceFlag('flag-id').pipe(Effect.flip))).toMatchObject({
      _tag: 'TraceFlagUpdateError',
      message: 'Failed to delete trace flag: delete failed',
      cause
    });
    toolingCreate.mockResolvedValueOnce({ success: false, errors: [] });
    expect(await runtime.runPromise(service.createTraceFlag('user-id', 'level-id').pipe(Effect.flip))).toMatchObject({
      _tag: 'TraceFlagCreateError',
      message: 'Trace flag create returned no ID'
    });
  } finally {
    await runtime.dispose();
  }
});
it('holds admission through a native write during shutdown and does not refresh after cancellation', async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<unknown>();
  toolingUpdate.mockImplementationOnce(() => {
    started.resolve();
    return release.promise;
  });
  const { runtime, service } = await fixture();
  const running = Effect.runPromiseExit(service.changeTraceFlagDebugLevel('flag-id', 'level-id'));
  await started.promise;
  let closed = false;
  const closing = runtime.dispose().then(() => {
    closed = true;
  });
  try {
    await setImmediate();
    expect(closed).toBe(false);
    expect(Exit.isFailure(await Effect.runPromiseExit(service.deleteTraceFlag('late')))).toBe(true);
    expect(toolingDelete).not.toHaveBeenCalled();
  } finally {
    release.resolve({ success: true });
    await closing;
  }
  expect(Exit.isFailure(await running)).toBe(true);
  expect(queries).toHaveLength(0);
  expect(await Effect.runPromise(PubSub.isShutdown(service.traceFlagsChanged))).toBe(true);
});

it('publishes refreshed flags, publishes [] for typed read failures, and propagates defects without publishing', async () => {
  const { runtime, service } = await fixture();
  const defect = new Error('query defect');
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const subscription = yield* PubSub.subscribe(service.traceFlagsChanged);
        rows = [row('flag', null)];
        yield* service.deleteDebugLevel('level-id');
        expect((yield* PubSub.take(subscription)).map(flag => flag.id)).toEqual(['flag']);
        queryFailure = new Error('optional refresh failed');
        yield* service.deleteTraceFlag('flag');
        expect(yield* PubSub.take(subscription)).toEqual([]);
        queryFailure = undefined;
        queryDefect = defect;
        const exit = yield* service.deleteTraceFlag('flag').pipe(Effect.exit);
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit))
          expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
        expect(yield* PubSub.takeUpTo(subscription, 1)).toEqual([]);
      }).pipe(Effect.scoped)
    );
  } finally {
    await runtime.dispose();
  }
});

it('retains typed wire/date failures and original non-Error SDK causes', async () => {
  const { runtime, service } = await fixture();
  try {
    rows = [{ ...row(), Id: 1 }];
    expect(await runtime.runPromise(service.getTraceFlags().pipe(Effect.flip))).toMatchObject({ _tag: 'SchemaError' });
    rows = [{ ...row(), TracedEntityId: null, ExpirationDate: 'invalid date' }];
    expect(await runtime.runPromise(service.getTraceFlags().pipe(Effect.flip))).toMatchObject({
      _tag: 'TraceFlagNotFoundError'
    });
    const cause = { code: 'DENIED' };
    toolingCreate.mockRejectedValueOnce(cause);
    const failure = await runtime.runPromise(service.createTraceFlag('user', 'level').pipe(Effect.flip));
    expect(failure).toMatchObject({
      _tag: 'TraceFlagCreateError',
      message: 'Failed to create trace flag: [object Object]'
    });
    if (failure._tag === 'TraceFlagCreateError') expect(failure.cause).toBe(cause);
  } finally {
    await runtime.dispose();
  }
});

it('captures TraceFlag StartDate before waiting for a DebugLevel update', async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<unknown>();
  toolingUpdate.mockImplementationOnce(() => {
    started.resolve();
    return release.promise;
  });
  const { runtime, service } = await fixture();
  try {
    const updating = runtime.runPromise(service.updateTraceFlag('flag', { debugLevelId: 'level' }));
    await started.promise;
    await runtime.runPromise(TestClock.adjust(Duration.seconds(10)));
    release.resolve({ success: true });
    await updating;
    expect(toolingUpdate.mock.calls[1]).toEqual(['TraceFlag', { Id: 'flag', StartDate: new Date(NOW).toISOString() }]);
  } finally {
    release.resolve({ success: true });
    await runtime.dispose();
  }
});

it.each(['missing', 'valid', 'expired', 'exact-expiry'] as const)(
  'cleans up only an expired trace flag: %s',
  async state => {
    rows =
      state === 'missing'
        ? []
        : [
            {
              ...row(),
              ExpirationDate: new Date(state === 'valid' ? NOW + 1 : state === 'expired' ? NOW - 1 : NOW).toISOString()
            }
          ];
    const { runtime, service } = await fixture();
    try {
      expect(await runtime.runPromise(service.cleanupExpired())).toBe(state === 'expired');
      expect(toolingDelete).toHaveBeenCalledTimes(state === 'expired' ? 1 : 0);
      if (state === 'expired') expect(toolingDelete).toHaveBeenCalledWith('TraceFlag', row().Id);
    } finally {
      await runtime.dispose();
    }
  }
);
