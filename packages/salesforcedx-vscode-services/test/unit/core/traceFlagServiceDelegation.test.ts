/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Queue from 'effect/Queue';
import type * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { ConnectionService } from '../../../src/core/connectionService';
import { clearDefaultOrgRef, getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { QueryService } from '../../../src/core/queryService';
import { TraceFlagService } from '../../../src/core/traceFlagService';
import { closeExtensionScope } from '../../../src/vscode/extensionScope';

const USER_ID = '005000000000001';
const LEVEL_ID = '7dl000000000001';
const FLAG_ID = '7tf000000000001';
const NEW_FLAG_ID = '7tf000000000002';
const NOW = new Date('2026-11-09T12:00:00.000Z');
const EXPIRATION = new Date('2026-11-09T13:00:00.000Z');
const traceFlagEntities = [
  { entityId: USER_ID, logType: 'DEVELOPER_LOG' },
  { entityId: USER_ID, logType: 'USER_DEBUG' },
  { entityId: '01p000000000001', logType: 'CLASS_TRACING' },
  { entityId: '01q000000000001', logType: 'CLASS_TRACING' }
] as const;
const categories = {
  ApexCode: 'FINEST',
  ApexProfiling: 'FINE',
  Callout: 'DEBUG',
  Database: 'INFO',
  Nba: 'WARN',
  System: 'ERROR',
  Validation: 'FINER',
  Visualforce: 'FINER',
  Wave: 'NONE',
  Workflow: 'FINEST'
} as const;
const debugLevel = { DeveloperName: 'Custom', MasterLabel: 'Custom label', ...categories };
const row = (overrides: Record<string, unknown> = {}) => ({
  Id: FLAG_ID,
  LogType: 'DEVELOPER_LOG',
  StartDate: NOW.toISOString(),
  ExpirationDate: EXPIRATION.toISOString(),
  DebugLevelId: LEVEL_ID,
  DebugLevel: { DeveloperName: 'Custom' },
  ...overrides
});
const page = (records: unknown[] = []) => ({ records, totalSize: records.length, done: true });

const tooling = () => ({
  query: vi.fn<(soql: string) => Promise<unknown>>().mockResolvedValue(page()),
  queryMore: vi.fn<(url: string) => Promise<unknown>>().mockResolvedValue(page()),
  create: vi.fn<(type: string, payload: unknown) => Promise<unknown>>().mockImplementation(async type => ({
    success: true,
    id: type === 'TraceFlag' ? NEW_FLAG_ID : LEVEL_ID,
    errors: []
  })),
  update: vi
    .fn<(type: string, payload: { Id: string }) => Promise<unknown>>()
    .mockImplementation(async (_type, payload) => ({ success: true, id: payload.Id, errors: [] })),
  delete: vi
    .fn<(type: string, id: string) => Promise<unknown>>()
    .mockImplementation(async (_type, id) => ({ success: true, id, errors: [] }))
});

const run = <A, E>(
  connectionTooling: ReturnType<typeof tooling>,
  program: Effect.Effect<A, E, TraceFlagService | QueryService | Scope.Scope>
) => {
  const connectionLayer = Layer.succeed(
    ConnectionService,
    ConnectionService.make({
      getConnection: () => Effect.succeed({ tooling: connectionTooling } as unknown as Connection),
      getConnectionForOrg: () => Effect.succeed({ tooling: connectionTooling } as unknown as Connection),
      validateAccessTokenOrPromptReauth: () => Effect.void,
      invalidateCachedConnections: () => Effect.void,
      getAuthInfoFields: () => Effect.succeed({}),
      listAllAuthorizations: () => Effect.succeed([])
    })
  );
  const dependencies = QueryService.DefaultWithoutDependencies.pipe(Layer.provideMerge(connectionLayer));
  return program.pipe(
    Effect.provide(TraceFlagService.DefaultWithoutDependencies.pipe(Layer.provideMerge(dependencies))),
    Effect.scoped,
    Effect.runPromise
  );
};

describe('TraceFlagService apex-node delegation', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    await Effect.runPromise(clearDefaultOrgRef());
  });

  afterEach(async () => {
    await Effect.runPromise(closeExtensionScope());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(traceFlagEntities)('creates and finds a $logType trace flag for $entityId', async ({ entityId, logType }) => {
    const api = tooling();
    api.query.mockResolvedValue(page([row({ LogType: logType })]));
    const result = await run(
      api,
      Effect.gen(function* () {
        const service = yield* TraceFlagService;
        const id = yield* service.createTraceFlag(entityId, LEVEL_ID, Duration.minutes(15), logType);
        const flag = yield* service.getTraceFlagForUser(entityId, logType);
        return { id, flag };
      })
    );
    expect(result.id).toBe(NEW_FLAG_ID);
    expect(Option.getOrUndefined(result.flag)).toMatchObject({ id: FLAG_ID, logType });
    expect(api.create).toHaveBeenCalledWith(
      'TraceFlag',
      expect.objectContaining({
        TracedEntityId: entityId,
        DebugLevelId: LEVEL_ID,
        LogType: logType,
        ExpirationDate: '2026-11-09T12:15:00.000Z'
      })
    );
    expect(api.query).toHaveBeenCalledWith(
      expect.stringContaining(`TracedEntityId='${entityId}' ORDER BY ExpirationDate DESC LIMIT 1`)
    );
    expect(api.query).toHaveBeenCalledWith(expect.stringContaining(`LogType='${logType}'`));
  });

  it('retains every debug category in create and camelCase read payloads, including paginated results', async () => {
    const api = tooling();
    const record = { ...debugLevel, Id: LEVEL_ID, Language: null };
    api.query.mockResolvedValue({ ...page([record]), done: false, nextRecordsUrl: '/debug-levels/next' });
    api.queryMore.mockResolvedValue(page([{ ...record, Id: '7dl000000000002' }]));
    const result = await run(
      api,
      Effect.gen(function* () {
        const service = yield* TraceFlagService;
        yield* service.createDebugLevel(debugLevel);
        return yield* service.getDebugLevels();
      })
    );
    expect(api.create).toHaveBeenCalledWith('DebugLevel', debugLevel);
    expect(api.queryMore).toHaveBeenCalledWith('/debug-levels/next');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: LEVEL_ID,
      developerName: 'Custom',
      masterLabel: 'Custom label',
      language: null,
      apexCode: 'FINEST',
      apexProfiling: 'FINE',
      callout: 'DEBUG',
      database: 'INFO',
      nba: 'WARN',
      system: 'ERROR',
      validation: 'FINER',
      visualforce: 'FINER',
      wave: 'NONE',
      workflow: 'FINEST'
    });
  });

  it('creates the complete replay-debugger category policy only when the named level is missing', async () => {
    const api = tooling();
    await run(api, TraceFlagService.getOrCreateDebugLevel());
    expect(api.create).toHaveBeenCalledWith('DebugLevel', {
      DeveloperName: 'ReplayDebuggerLevels',
      MasterLabel: 'ReplayDebuggerLevels',
      ApexCode: 'FINEST',
      ApexProfiling: 'NONE',
      Callout: 'NONE',
      Database: 'NONE',
      Nba: 'NONE',
      System: 'NONE',
      Validation: 'NONE',
      Visualforce: 'FINER',
      Wave: 'NONE',
      Workflow: 'NONE'
    });
  });

  it('ensures a missing flag using the on-demand replay level and publishes the new flag', async () => {
    const api = tooling();
    api.query
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(page())
      .mockResolvedValue(page([row({ Id: NEW_FLAG_ID })]));
    const result = await run(
      api,
      Effect.gen(function* () {
        const service = yield* TraceFlagService;
        const subscription = yield* PubSub.subscribe(service.traceFlagsChanged);
        const ensured = yield* service.ensureTraceFlag(USER_ID);
        return { ensured, events: Chunk.toReadonlyArray(yield* Queue.takeAll(subscription)) };
      })
    );
    expect(result.ensured).toEqual({ created: true, traceFlagId: NEW_FLAG_ID });
    expect(api.create.mock.calls).toEqual([
      ['DebugLevel', expect.objectContaining({ DeveloperName: 'ReplayDebuggerLevels' })],
      ['TraceFlag', expect.objectContaining({ DebugLevelId: LEVEL_ID, ExpirationDate: '2026-11-09T12:30:00.000Z' })]
    ]);
    expect(result.events).toEqual([[expect.objectContaining({ id: NEW_FLAG_ID })]]);
  });

  it('publishes refreshed, Date-valued items through the same service instance after a successful write', async () => {
    const api = tooling();
    api.query.mockResolvedValue(page([row()]));
    const result = await run(
      api,
      Effect.gen(function* () {
        const service = yield* TraceFlagService;
        const subscription = yield* PubSub.subscribe(service.traceFlagsChanged);
        yield* TraceFlagService.changeTraceFlagDebugLevel(FLAG_ID, LEVEL_ID);
        const events = yield* Queue.takeAll(subscription);
        return { events: Chunk.toReadonlyArray(events), sameService: service === (yield* TraceFlagService) };
      })
    );
    expect(result.sameService).toBe(true);
    expect(result.events).toEqual([
      [
        expect.objectContaining({
          id: FLAG_ID,
          startDate: NOW,
          expirationDate: EXPIRATION,
          debugLevelName: 'Custom',
          isActive: true
        })
      ]
    ]);
    expect(api.update).toHaveBeenCalledExactlyOnceWith('TraceFlag', { Id: FLAG_ID, DebugLevelId: LEVEL_ID });
  });

  it('keeps a successful write successful and publishes an empty refresh when the read fails', async () => {
    const api = tooling();
    api.query.mockRejectedValue(new Error('refresh unavailable'));
    const events = await run(
      api,
      Effect.gen(function* () {
        const service = yield* TraceFlagService;
        const subscription = yield* PubSub.subscribe(service.traceFlagsChanged);
        yield* service.deleteTraceFlag(FLAG_ID);
        return Chunk.toReadonlyArray(yield* Queue.takeAll(subscription));
      })
    );
    expect(events).toEqual([[]]);
  });

  it('updates replay categories and expiration without changing the flag relationship', async () => {
    const api = tooling();
    await run(api, TraceFlagService.updateTraceFlag(FLAG_ID, { debugLevelId: LEVEL_ID, expirationDate: EXPIRATION }));
    expect(api.update.mock.calls).toEqual([
      ['DebugLevel', { Id: LEVEL_ID, ApexCode: 'FINEST', Visualforce: 'FINER' }],
      ['TraceFlag', { Id: FLAG_ID, StartDate: expect.any(String), ExpirationDate: EXPIRATION.toISOString() }]
    ]);
  });

  it.each(traceFlagEntities)(
    'recreates an expired $logType flag for $entityId and publishes after deletion and creation',
    async ({ entityId, logType }) => {
      const api = tooling();
      api.query
        .mockResolvedValueOnce(page([row({ ExpirationDate: '2026-11-09T11:00:00.000Z' })]))
        .mockResolvedValueOnce(page())
        .mockResolvedValue(page([row({ Id: NEW_FLAG_ID })]));
      const result = await run(
        api,
        Effect.gen(function* () {
          const service = yield* TraceFlagService;
          const subscription = yield* PubSub.subscribe(service.traceFlagsChanged);
          const events = yield* Effect.all([Queue.take(subscription), Queue.take(subscription)]).pipe(Effect.fork);
          const ensured = yield* service.ensureTraceFlag(entityId, Duration.minutes(15), logType, LEVEL_ID);
          return { ensured, events: yield* Fiber.join(events) };
        })
      );
      expect(result.ensured).toEqual({ created: true, traceFlagId: NEW_FLAG_ID });
      expect(api.delete).toHaveBeenCalledExactlyOnceWith('TraceFlag', FLAG_ID);
      expect(api.create).toHaveBeenCalledWith(
        'TraceFlag',
        expect.objectContaining({ TracedEntityId: entityId, LogType: logType })
      );
      expect(api.update).not.toHaveBeenCalled();
      expect(result.events).toEqual([[], [expect.objectContaining({ id: NEW_FLAG_ID })]]);
    }
  );

  it('keeps a later expiry, changing only the debug-level relationship', async () => {
    const api = tooling();
    api.query.mockResolvedValue(page([row({ DebugLevelId: '7dl000000000002' })]));
    const result = await run(
      api,
      TraceFlagService.ensureTraceFlag(USER_ID, Duration.minutes(15), 'USER_DEBUG', LEVEL_ID)
    );
    expect(result).toEqual({ created: false, traceFlagId: FLAG_ID });
    expect(api.update).toHaveBeenCalledExactlyOnceWith('TraceFlag', { Id: FLAG_ID, DebugLevelId: LEVEL_ID });
    expect(api.create).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('extends an active flag without shortening it or overwriting custom categories', async () => {
    const api = tooling();
    api.query.mockResolvedValue(page([row()]));
    const result = await run(
      api,
      TraceFlagService.ensureTraceFlag(USER_ID, Duration.hours(2), 'DEVELOPER_LOG', LEVEL_ID)
    );
    expect(result).toEqual({ created: false, traceFlagId: FLAG_ID });
    expect(api.update).toHaveBeenCalledExactlyOnceWith('TraceFlag', {
      Id: FLAG_ID,
      StartDate: expect.any(String),
      ExpirationDate: '2026-11-09T14:00:00.000Z'
    });
  });

  it('does not mutate or publish when the existing flag already satisfies the requested policy', async () => {
    const api = tooling();
    api.query.mockResolvedValue(page([row()]));
    const events = await run(
      api,
      Effect.gen(function* () {
        const service = yield* TraceFlagService;
        const subscription = yield* PubSub.subscribe(service.traceFlagsChanged);
        yield* service.ensureTraceFlag(USER_ID, Duration.minutes(15), 'DEVELOPER_LOG', LEVEL_ID);
        return Chunk.toReadonlyArray(yield* Queue.takeAll(subscription));
      })
    );
    expect(api.create).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it.each([
    { records: [], deleted: false },
    { records: [row()], deleted: false },
    { records: [row({ ExpirationDate: '2026-11-09T11:00:00.000Z' })], deleted: true }
  ])('cleanup returns $deleted for the current user and only deletes expired flags', async ({ records, deleted }) => {
    const api = tooling();
    api.query.mockResolvedValueOnce(page(records));
    const result = await run(
      api,
      Effect.gen(function* () {
        yield* getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, { userId: USER_ID })));
        return yield* TraceFlagService.cleanupExpired();
      })
    );
    expect(result).toBe(deleted);
    expect(api.delete.mock.calls).toEqual(deleted ? [['TraceFlag', FLAG_ID]] : []);
    expect(api.query).toHaveBeenCalledWith(expect.stringContaining(`TracedEntityId='${USER_ID}'`));
  });

  it('keeps UserIdNotFoundError when cleanup has no current user', async () => {
    const api = tooling();
    const error = await run(api, TraceFlagService.cleanupExpired().pipe(Effect.flip));
    expect(error._tag).toBe('UserIdNotFoundError');
    expect(api.query).not.toHaveBeenCalled();
  });

  it.each(
    (
      [
        { operation: 'createDebugLevel', tag: 'DebugLevelCreateError' },
        { operation: 'deleteDebugLevel', tag: 'DebugLevelDeleteError' },
        { operation: 'createTraceFlag', tag: 'TraceFlagCreateError' },
        { operation: 'updateTraceFlag', tag: 'TraceFlagUpdateError' },
        { operation: 'deleteTraceFlag', tag: 'TraceFlagUpdateError' },
        { operation: 'changeTraceFlagDebugLevel', tag: 'TraceFlagUpdateError' }
      ] as const
    ).flatMap(testCase =>
      (['rejection', 'unsuccessful result', 'malformed result'] as const).map(failure => ({ ...testCase, failure }))
    )
  )('maps $operation $failure to $tag without publishing', async ({ operation, tag, failure }) => {
    const api = tooling();
    if (failure === 'rejection') {
      api.create.mockRejectedValue(new Error('write rejected'));
      api.update.mockRejectedValue(new Error('write rejected'));
      api.delete.mockRejectedValue(new Error('write rejected'));
    } else {
      const response =
        failure === 'unsuccessful result'
          ? { success: false, errors: [{ statusCode: 'INVALID_OPERATION', message: 'write rejected' }] }
          : { success: true, errors: [] };
      api.create.mockResolvedValue(response);
      api.update.mockResolvedValue(response);
      api.delete.mockResolvedValue(response);
    }
    const result = await run(
      api,
      Effect.gen(function* () {
        const service = yield* TraceFlagService;
        const subscription = yield* PubSub.subscribe(service.traceFlagsChanged);
        const writes = {
          createDebugLevel: service.createDebugLevel(debugLevel),
          deleteDebugLevel: service.deleteDebugLevel(LEVEL_ID),
          createTraceFlag: service.createTraceFlag(USER_ID, LEVEL_ID),
          updateTraceFlag: service.updateTraceFlag(FLAG_ID),
          deleteTraceFlag: service.deleteTraceFlag(FLAG_ID),
          changeTraceFlagDebugLevel: service.changeTraceFlagDebugLevel(FLAG_ID, LEVEL_ID)
        };
        const error = yield* Effect.all([writes[operation]]).pipe(Effect.flip);
        return { error, events: Chunk.toReadonlyArray(yield* Queue.takeAll(subscription)) };
      })
    );
    expect(result.error._tag).toBe(tag);
    expect(result.error.message).toContain(
      {
        rejection: 'write rejected',
        'unsuccessful result': 'returned errors',
        'malformed result': 'Invalid Tooling mutation response'
      }[failure]
    );
    expect(result.events).toEqual([]);
  });

  it.each(['getTraceFlags', 'getDebugLevels', 'getTraceFlagForUser', 'ensureTraceFlag'] as const)(
    'preserves TraceFlagNotFoundError when %s cannot query Tooling',
    async operation => {
      const api = tooling();
      api.query.mockRejectedValue(new Error('query rejected'));
      const error = await run(
        api,
        Effect.gen(function* () {
          const service = yield* TraceFlagService;
          const reads = {
            getTraceFlags: service.getTraceFlags(),
            getDebugLevels: service.getDebugLevels(),
            getTraceFlagForUser: service.getTraceFlagForUser(USER_ID),
            ensureTraceFlag: service.ensureTraceFlag(USER_ID, Duration.minutes(15), 'DEVELOPER_LOG', LEVEL_ID)
          };
          return yield* Effect.all([reads[operation]]).pipe(Effect.flip);
        })
      );
      expect(error).toMatchObject({ _tag: 'TraceFlagNotFoundError', message: 'query rejected' });
    }
  );

  it('preserves the successful-delete event when expired-flag recreation fails', async () => {
    const api = tooling();
    api.query.mockResolvedValueOnce(page([row({ ExpirationDate: '2026-11-09T11:00:00.000Z' })]));
    api.create.mockRejectedValue(new Error('create rejected'));
    const result = await run(
      api,
      Effect.gen(function* () {
        const service = yield* TraceFlagService;
        const subscription = yield* PubSub.subscribe(service.traceFlagsChanged);
        const error = yield* service
          .ensureTraceFlag(USER_ID, Duration.minutes(15), 'DEVELOPER_LOG', LEVEL_ID)
          .pipe(Effect.flip);
        return { error, events: Chunk.toReadonlyArray(yield* Queue.takeAll(subscription)) };
      })
    );
    expect(result.error._tag).toBe('TraceFlagCreateError');
    expect(result.events).toEqual([[]]);
  });
});
