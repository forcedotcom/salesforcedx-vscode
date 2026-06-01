/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { ConnectionService } from '../../../src/core/connectionService';
import { TraceFlagService } from '../../../src/core/traceFlagService';

const emptyToolingResult = { totalSize: 0, records: [] as never[], done: true };

type MutationMocks = {
  create?: jest.Mock;
  update?: jest.Mock;
  delete?: jest.Mock;
};

const makeMockConnection = (queryMock: jest.Mock, mut: MutationMocks = {}): Connection =>
  ({
    tooling: {
      query: queryMock,
      create: mut.create ?? jest.fn().mockResolvedValue({ success: true, id: 'newFlagId' }),
      update: mut.update ?? jest.fn().mockResolvedValue({ success: true, id: 'updatedFlagId' }),
      delete: mut.delete ?? jest.fn().mockResolvedValue({ success: true, id: 'deletedFlagId' })
    }
  }) as unknown as Connection;

const createMockConnectionLayer = (queryMock: jest.Mock, mut: MutationMocks = {}): Layer.Layer<ConnectionService> =>
  Layer.succeed(
    ConnectionService,
    ConnectionService.make({
      getConnection: () => Effect.succeed(makeMockConnection(queryMock, mut)),
      invalidateCachedConnections: () => Effect.void
    })
  );

/**
 * Use .DefaultWithoutDependencies so the mock ConnectionService overrides the baked-in dependency.
 * .Default = Layer.provide(DefaultWithoutDependencies, deps) — passing .Default would re-apply the real
 * ConnectionService and ignore our mock.
 */
/**
 * `Layer.fresh` defeats Effect's default cross-runtime layer memoization so each test gets a brand-new
 * TraceFlagService instance with its own caches + adaptive state. Prevents test pollution.
 */
const createTestLayer = (queryMock: jest.Mock, mut: MutationMocks = {}) =>
  Layer.fresh(Layer.provide(TraceFlagService.DefaultWithoutDependencies, createMockConnectionLayer(queryMock, mut)));

describe('TraceFlagService \u2014 cache (TTL + dedupe + invalidation)', () => {
  describe('cascade-killer (concurrent dedupe)', () => {
    it('4 concurrent getTraceFlagForUser(sameUserId, sameLogType) \u2192 1 SOQL', async () => {
      const queryMock = jest.fn().mockResolvedValue(emptyToolingResult);
      const layer = createTestLayer(queryMock);

      const program = Effect.all(
        [
          TraceFlagService.getTraceFlagForUser('005xxxA'),
          TraceFlagService.getTraceFlagForUser('005xxxA'),
          TraceFlagService.getTraceFlagForUser('005xxxA'),
          TraceFlagService.getTraceFlagForUser('005xxxA')
        ],
        { concurrency: 'unbounded' }
      );

      await Effect.runPromise(program.pipe(Effect.provide(layer)));
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it('4 concurrent getTraceFlags() \u2192 1 SOQL', async () => {
      const queryMock = jest.fn().mockResolvedValue(emptyToolingResult);
      const layer = createTestLayer(queryMock);

      const program = Effect.all(
        [
          TraceFlagService.getTraceFlags(),
          TraceFlagService.getTraceFlags(),
          TraceFlagService.getTraceFlags(),
          TraceFlagService.getTraceFlags()
        ],
        { concurrency: 'unbounded' }
      );

      await Effect.runPromise(program.pipe(Effect.provide(layer)));
      expect(queryMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache hit within TTL (sequential dedupe)', () => {
    it('2 sequential getTraceFlagForUser \u2192 1 SOQL', async () => {
      const queryMock = jest.fn().mockResolvedValue(emptyToolingResult);
      const layer = createTestLayer(queryMock);

      const program = Effect.gen(function* () {
        yield* TraceFlagService.getTraceFlagForUser('005xxxA');
        yield* TraceFlagService.getTraceFlagForUser('005xxxA');
      });

      await Effect.runPromise(program.pipe(Effect.provide(layer)));
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it('2 sequential getTraceFlags \u2192 1 SOQL', async () => {
      const queryMock = jest.fn().mockResolvedValue(emptyToolingResult);
      const layer = createTestLayer(queryMock);

      const program = Effect.gen(function* () {
        yield* TraceFlagService.getTraceFlags();
        yield* TraceFlagService.getTraceFlags();
      });

      await Effect.runPromise(program.pipe(Effect.provide(layer)));
      expect(queryMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache key isolation (sanity)', () => {
    it('different userIds are isolated', async () => {
      const queryMock = jest.fn().mockResolvedValue(emptyToolingResult);
      const layer = createTestLayer(queryMock);

      const program = Effect.gen(function* () {
        yield* TraceFlagService.getTraceFlagForUser('005xxxA');
        yield* TraceFlagService.getTraceFlagForUser('005xxxB');
      });

      await Effect.runPromise(program.pipe(Effect.provide(layer)));
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it('different logTypes are isolated', async () => {
      const queryMock = jest.fn().mockResolvedValue(emptyToolingResult);
      const layer = createTestLayer(queryMock);

      const program = Effect.gen(function* () {
        yield* TraceFlagService.getTraceFlagForUser('005xxxA', 'DEVELOPER_LOG');
        yield* TraceFlagService.getTraceFlagForUser('005xxxA', 'USER_DEBUG');
      });

      await Effect.runPromise(program.pipe(Effect.provide(layer)));
      expect(queryMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('errors are NOT cached (Exit.match skip-on-failure)', () => {
    it('first call fails \u2192 second call retries (queries again)', async () => {
      const queryMock = jest
        .fn()
        .mockRejectedValueOnce(new Error('transient network failure'))
        .mockResolvedValueOnce(emptyToolingResult);
      const layer = createTestLayer(queryMock);

      /*
       * runPromiseExit + independent Effect.provide per call avoids a cross-file isolation issue where
       * Effect.catchAll's effect on a single-gen continuation appears affected by other test files'
       * module initialization. Each call is independent, so we directly inspect each Exit.
       */
      const firstExit = await Effect.runPromiseExit(
        TraceFlagService.getTraceFlagForUser('005xxxA').pipe(Effect.provide(layer))
      );
      expect(firstExit._tag).toBe('Failure');

      const secondExit = await Effect.runPromiseExit(
        TraceFlagService.getTraceFlagForUser('005xxxA').pipe(Effect.provide(layer))
      );
      expect(secondExit._tag).toBe('Success');
      expect(queryMock).toHaveBeenCalledTimes(2);
    });
  });

  /*
   * Every mutation must invalidate the cache AND reset adaptive TTL state so the next read
   * fetches fresh and starts at base TTL again.
   *
   * Pattern per test:
   *   1) prime cache via getTraceFlags() (cache miss, queryMock=1)
   *   2) confirm cache hit via another getTraceFlags()  (still queryMock=1)
   *   3) invoke mutation, which internally calls invalidateTraceFlagCaches + getTraceFlags for PubSub
   *      (queryMock=2 — the internal getTraceFlags after invalidation)
   *
   * If invalidation were broken, the post-mutation internal getTraceFlags would hit cache and queryMock would stay at 1.
   * Therefore an assertion of "queryMock called > 1 times after mutation" directly proves invalidation works.
   */
  describe('mutations invalidate cache (reset on user action)', () => {
    it('createTraceFlag invalidates cache', async () => {
      const queryMock = jest.fn().mockResolvedValue(emptyToolingResult);
      const layer = createTestLayer(queryMock);
      await Effect.runPromise(
        Effect.gen(function* () {
          yield* TraceFlagService.getTraceFlags();
          yield* TraceFlagService.getTraceFlags();
          expect(queryMock).toHaveBeenCalledTimes(1);
          yield* TraceFlagService.createTraceFlag('005xxxA', 'dbgLvl-1');
        }).pipe(Effect.provide(layer))
      );
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it('updateTraceFlag invalidates cache', async () => {
      const queryMock = jest.fn().mockResolvedValue(emptyToolingResult);
      const layer = createTestLayer(queryMock);
      await Effect.runPromise(
        Effect.gen(function* () {
          yield* TraceFlagService.getTraceFlags();
          yield* TraceFlagService.getTraceFlags();
          expect(queryMock).toHaveBeenCalledTimes(1);
          yield* TraceFlagService.updateTraceFlag('flag-1', { debugLevelId: 'dbgLvl-2' });
        }).pipe(Effect.provide(layer))
      );
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it('deleteTraceFlag invalidates cache', async () => {
      const queryMock = jest.fn().mockResolvedValue(emptyToolingResult);
      const layer = createTestLayer(queryMock);
      await Effect.runPromise(
        Effect.gen(function* () {
          yield* TraceFlagService.getTraceFlags();
          yield* TraceFlagService.getTraceFlags();
          expect(queryMock).toHaveBeenCalledTimes(1);
          yield* TraceFlagService.deleteTraceFlag('flag-1');
        }).pipe(Effect.provide(layer))
      );
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    it('changeTraceFlagDebugLevel invalidates cache', async () => {
      const queryMock = jest.fn().mockResolvedValue(emptyToolingResult);
      const layer = createTestLayer(queryMock);
      await Effect.runPromise(
        Effect.gen(function* () {
          yield* TraceFlagService.getTraceFlags();
          yield* TraceFlagService.getTraceFlags();
          expect(queryMock).toHaveBeenCalledTimes(1);
          yield* TraceFlagService.changeTraceFlagDebugLevel('flag-1', 'dbgLvl-3');
        }).pipe(Effect.provide(layer))
      );
      expect(queryMock).toHaveBeenCalledTimes(2);
    });
  });
});
