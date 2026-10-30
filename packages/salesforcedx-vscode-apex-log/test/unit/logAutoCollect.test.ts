/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import type { TraceFlagItem } from 'salesforcedx-vscode-services';
import { ApexLogService } from 'salesforcedx-vscode-services/src/core/apexLogService';
import { ConnectionService } from 'salesforcedx-vscode-services/src/core/connectionService';
import { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { SettingsChangePubSub } from 'salesforcedx-vscode-services/src/vscode/settingsChangePubSub';
import { SettingsService } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { createLogAutoCollect } from '../../src/logs/logAutoCollect';
import { CurrentTraceFlags, KnownLogIdsRef, LogCollectorStateRef } from '../../src/services/apexLogState';

const userOne = '005000000000001AAA';
const userTwo = '005000000000002AAA';

const traceFlag = (tracedEntityId: string, startDate: string): TraceFlagItem => ({
  id: `trace-${tracedEntityId}`,
  tracedEntityId,
  startDate: new Date(startDate),
  expirationDate: new Date(Date.now() + 60_000),
  logType: 'DEVELOPER_LOG',
  isActive: true
});
const logId = (id: string): string =>
  id.length === 15 || id.length === 18 ? id : `07L${id.replace(/^07L/u, '').padStart(15, '0')}`;
const log = (Id: string, LogUserId = userOne, StartTime = '2026-10-23T12:00:00.000Z') => ({
  Id: logId(Id),
  LogUserId,
  StartTime,
  LogLength: 10,
  Status: 'Success'
});

const setup = Effect.gen(function* () {
  const targetOrgRef = yield* SubscriptionRef.make<{ orgId?: string }>({ orgId: '00Done' });
  const traceFlagsRef = yield* SubscriptionRef.make([
    traceFlag(userOne, '2026-10-23T10:00:00.000Z'),
    traceFlag(userTwo, '2026-10-23T11:00:00.000Z')
  ]);
  const knownIdsRef = yield* Ref.make(HashSet.empty<string>());
  const collectorRef = yield* SubscriptionRef.make({ isCollecting: false, collectedCount: 0 });
  const intervalRef = yield* Ref.make(1);
  const settingsChanges = yield* PubSub.unbounded<vscode.ConfigurationChangeEvent>();
  const query = vi.fn().mockResolvedValue({ totalSize: 1, records: [log('07Lgood')] });
  const request = vi.fn().mockResolvedValue('body');
  const writeFile = vi.fn((_uri: URI, _body: string) => Effect.void);
  const getConnection = Ref.get(targetOrgRef).pipe(
    Effect.map(
      ({ orgId }) =>
        ({
          tooling: { query },
          request: (options: unknown) => request(orgId, options),
          instanceUrl: 'https://example.my.salesforce.com',
          getApiVersion: () => '67.0'
        }) as unknown as Connection
    )
  );
  const logService = yield* ApexLogService.pipe(
    Effect.provide(ApexLogService.DefaultWithoutDependencies),
    Effect.provideService(ConnectionService, { getConnection: () => getConnection } as unknown as ConnectionService)
  );
  const services = {
    ApexLogService,
    ChannelService,
    FsService,
    WorkspaceService,
    TargetOrgRef: () => Effect.succeed(targetOrgRef),
    SettingsChangePubSub,
    SettingsService
  };
  yield* createLogAutoCollect().pipe(
    Effect.provideService(ExtensionProviderService, {
      getServicesApi: Effect.succeed({ services })
    } as unknown as ExtensionProviderService),
    Effect.provideService(CurrentTraceFlags, traceFlagsRef),
    Effect.provideService(KnownLogIdsRef, knownIdsRef),
    Effect.provideService(LogCollectorStateRef, collectorRef),
    Effect.provideService(ApexLogService, logService),
    Effect.provideService(ChannelService, { appendToChannel: () => Effect.void } as unknown as ChannelService),
    Effect.provideService(SettingsService, {
      getValueOrElse: () => Ref.get(intervalRef)
    } as unknown as SettingsService),
    Effect.provideService(SettingsChangePubSub, new SettingsChangePubSub(settingsChanges)),
    Effect.provideService(WorkspaceService, {
      getWorkspaceInfoOrThrow: () => Effect.succeed({ uri: URI.file('/project') })
    } as unknown as WorkspaceService),
    Effect.provideService(FsService, {
      readDirectory: () =>
        Effect.succeed([URI.file(`/project/execute-anonymous-2026-10-23T12-00-00-${log('07Lexec').Id}`)]),
      isDirectory: () => Effect.succeed(true),
      writeFile
    } as unknown as FsService),
    Effect.forkScoped
  );
  const advance = (seconds: number) => TestClock.adjust(Duration.seconds(seconds));
  const setInterval = (seconds: number) =>
    Ref.set(intervalRef, seconds).pipe(
      Effect.zipRight(PubSub.publish(settingsChanges, { affectsConfiguration: () => true }))
    );
  return { targetOrgRef, traceFlagsRef, knownIdsRef, collectorRef, query, request, writeFile, advance, setInterval };
});

beforeEach(() => {
  Object.defineProperty(vscode.window, 'state', { configurable: true, value: { active: true } });
});

describe('log auto collection', () => {
  it('retains traced users, each user start, exec-anon exclusion, dedupe, storage, and collector state', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { query, request, collectorRef, writeFile, advance } = yield* setup;
          query.mockResolvedValue({
            totalSize: 4,
            records: [
              log('07Lold', userOne, '2026-10-23T09:00:00.000Z'),
              log('07Learly', userTwo, '2026-10-23T10:30:00.000Z'),
              log('07Lexec'),
              log('07Lgood')
            ]
          });
          yield* advance(1);
          yield* Effect.promise(() =>
            vi.waitFor(() =>
              expect(writeFile).toHaveBeenCalledWith(
                expect.objectContaining({ path: `/project/.sfdx/tools/debug/logs/${log('07Lgood').Id}.log` }),
                'body'
              )
            )
          );
          expect(query.mock.calls[0][0]).toContain(
            `WHERE LogUserId IN ('${userOne}','${userTwo}') AND StartTime >= 2026-10-23T10:00:00.000Z ORDER BY StartTime ASC, Id ASC`
          );
          yield* advance(3);
          expect(query.mock.calls.length).toBeGreaterThan(1);
          expect(request).toHaveBeenCalledTimes(1);
          expect(yield* SubscriptionRef.get(collectorRef)).toEqual({ isCollecting: true, collectedCount: 1 });
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
  });

  it('gates scheduled polls on window activity and replaces the schedule when the interval becomes zero', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { query, advance, setInterval, traceFlagsRef } = yield* setup;
          Object.defineProperty(vscode.window, 'state', { configurable: true, value: { active: false } });
          yield* advance(1);
          yield* Effect.promise(() => vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1)));
          yield* advance(3);
          expect(query).toHaveBeenCalledTimes(1);
          Object.defineProperty(vscode.window, 'state', { configurable: true, value: { active: true } });
          yield* advance(2);
          expect(query.mock.calls.length).toBeGreaterThan(1);
          yield* setInterval(0);
          yield* advance(1);
          const callsAfterDisable = query.mock.calls.length;
          yield* advance(5);
          expect(query).toHaveBeenCalledTimes(callsAfterDisable);
          // Disabling the timer does not disable explicit trace-flag refresh collection.
          yield* SubscriptionRef.update(traceFlagsRef, flags => [...flags]);
          yield* advance(1);
          expect(query).toHaveBeenCalledTimes(callsAfterDisable + 1);
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
  });

  it('continues from the latest StartTime and ID cursor', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { query, advance } = yield* setup;
          const startTime = new Date(Date.now() - 120_000).toISOString();
          query.mockResolvedValue({ totalSize: 1, records: [log('07Lcursor', userOne, startTime)] });

          yield* advance(1);
          yield* Effect.promise(() => vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1)));
          yield* advance(1);
          yield* Effect.promise(() => vi.waitFor(() => expect(query).toHaveBeenCalledTimes(2)));

          expect(query.mock.calls[0][0]).toContain('ORDER BY StartTime ASC, Id ASC');
          expect(query.mock.calls[0][0]).not.toContain(' LIMIT ');
          expect(query.mock.calls[1][0]).toContain(
            `StartTime > ${startTime} OR (StartTime = ${startTime} AND Id > '${log('07Lcursor').Id}')`
          );
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
  });

  it('collects more than 500 logs without a SOQL result cap', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { query, writeFile, advance } = yield* setup;
          const startTime = new Date().toISOString();
          const logs = Array.from({ length: 503 }, (_, index) =>
            log(`07L${String(index).padStart(12, '0')}`, userOne, startTime)
          );
          query.mockResolvedValue({ totalSize: logs.length, records: logs });
          yield* advance(1);
          yield* Effect.promise(() =>
            vi.waitFor(() => expect(writeFile).toHaveBeenCalledTimes(logs.length), { timeout: 5000 })
          );
          expect(query).toHaveBeenCalledTimes(1);
          expect(query.mock.calls[0][0]).not.toContain(' LIMIT ');
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
  });

  it('interrupts old-org bodies, resets known IDs on org change, and stops when the org is cleared', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { targetOrgRef, knownIdsRef, request, writeFile, advance } = yield* setup;
          request.mockImplementation((orgId: string) =>
            orgId === '00Done' ? new Promise<string>(() => {}) : Promise.resolve('new org body')
          );
          yield* advance(1);
          yield* Effect.promise(() => vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1)));
          yield* Ref.set(knownIdsRef, HashSet.make(log('07Lgood').Id));
          yield* SubscriptionRef.set(targetOrgRef, { orgId: '00Dtwo' });
          yield* advance(1);
          yield* Effect.promise(() =>
            vi.waitFor(() =>
              expect(writeFile).toHaveBeenCalledWith(
                expect.objectContaining({ path: `/project/.sfdx/tools/debug/logs/${log('07Lgood').Id}.log` }),
                'new org body'
              )
            )
          );
          expect(writeFile).toHaveBeenCalledTimes(1);
          yield* SubscriptionRef.set(targetOrgRef, {});
          yield* advance(5);
          expect(request).toHaveBeenCalledTimes(2);
          expect(HashSet.size(yield* Ref.get(knownIdsRef))).toBe(0);
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
  });

  it('keeps settings-only restarts activity-gated but permits trace refresh collection while inactive', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { query, advance, setInterval, traceFlagsRef } = yield* setup;
          yield* advance(1);
          yield* Effect.promise(() => vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1)));
          Object.defineProperty(vscode.window, 'state', { configurable: true, value: { active: false } });
          yield* setInterval(2);
          yield* advance(5);
          expect(query).toHaveBeenCalledTimes(1);
          yield* SubscriptionRef.update(traceFlagsRef, flags => [...flags]);
          yield* advance(1);
          expect(query).toHaveBeenCalledTimes(2);
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
  });

  it.each([
    ['trace flags', 'body'],
    ['settings', 'body'],
    ['trace flags', 'storage'],
    ['settings', 'storage']
  ])('finishes in-flight %s refresh collection during %s', async (trigger, stage) => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { traceFlagsRef, knownIdsRef, query, request, writeFile, advance, setInterval } = yield* setup;
          const finish = yield* Deferred.make<string>();
          if (stage === 'body') {
            request.mockImplementation(() => Effect.runPromise(Deferred.await(finish)));
          } else {
            writeFile.mockImplementation(() => Deferred.await(finish).pipe(Effect.asVoid));
          }
          yield* advance(1);
          yield* Effect.promise(() => vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1)));
          if (stage === 'storage') {
            yield* Effect.promise(() => vi.waitFor(() => expect(writeFile).toHaveBeenCalledTimes(1)));
          }
          if (trigger === 'trace flags') {
            yield* SubscriptionRef.set(traceFlagsRef, []);
          } else {
            yield* setInterval(0);
          }
          yield* advance(2);
          yield* Deferred.succeed(finish, 'body');
          yield* Effect.promise(() =>
            vi.waitFor(() =>
              expect(Effect.runSync(Ref.get(knownIdsRef)).pipe(HashSet.has(log('07Lgood').Id))).toBe(true)
            )
          );
          expect(writeFile).toHaveBeenCalledTimes(1);
          expect(request).toHaveBeenCalledTimes(1);
          const callsAfterRefresh = query.mock.calls.length;
          yield* advance(3);
          expect(query).toHaveBeenCalledTimes(callsAfterRefresh);
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
  });

  it('rechecks trace expiration on each poll without requiring a trace-ref update', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { traceFlagsRef, query, advance } = yield* setup;
          const flags = yield* SubscriptionRef.get(traceFlagsRef);
          yield* advance(1);
          yield* Effect.promise(() => vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1)));
          // Move the wall clock past expiry without publishing a new ref value.
          const now = vi.spyOn(Date, 'now').mockReturnValue(flags[0].expirationDate.getTime() + 1);
          yield* advance(3);
          now.mockRestore();
          expect(query).toHaveBeenCalledTimes(1);
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
  });
});
