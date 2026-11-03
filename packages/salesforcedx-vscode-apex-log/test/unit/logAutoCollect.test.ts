/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  ApexLogService,
  ChannelService,
  FsService,
  OrgId,
  SettingsChangePubSub,
  SettingsService,
  TargetOrgRef,
  WorkspaceService,
  type ApexLogListItem,
  type DefaultOrgInfo,
  type ListLogsOptions,
  type SalesforceVSCodeServicesApiV2,
  type TraceFlagItem
} from '@salesforce/vscode-services/v2';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as Schema from 'effect/Schema';
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
  const targetOrgRef = yield* SubscriptionRef.make<DefaultOrgInfo>({
    orgId: Schema.decodeUnknownSync(OrgId)('00D000000000001AAA')
  });
  const traceFlagsRef = yield* SubscriptionRef.make([
    traceFlag(userOne, '2026-10-23T10:00:00.000Z'),
    traceFlag(userTwo, '2026-10-23T11:00:00.000Z')
  ]);
  const knownIdsRef = yield* Ref.make(HashSet.empty<string>());
  const collectorRef = yield* SubscriptionRef.make({ isCollecting: false, collectedCount: 0 });
  const intervalRef = yield* Ref.make(1);
  const settingsChanges = yield* PubSub.unbounded<vscode.ConfigurationChangeEvent>();
  const listLogs = vi.fn((_limit = 25, _options?: ListLogsOptions) =>
    SubscriptionRef.get(targetOrgRef).pipe(
      Effect.map(({ orgId }) => (orgId === undefined ? [] : [log('07Lgood') as ApexLogListItem]))
    )
  );
  const request = vi.fn((_orgId: string, _logId: string) => Promise.resolve('body'));
  const writeFile = vi.fn((_uri: URI, _body: string) => Effect.void);
  const services = {
    ApexLogService,
    ChannelService,
    FsService,
    SettingsChangePubSub,
    SettingsService,
    TargetOrgRef,
    WorkspaceService
  };
  const servicesApi = { v2: { services } } as unknown as SalesforceVSCodeServicesApiV2;
  const workspaceInfo = {
    uri: URI.file('/project'),
    path: '/project',
    fsPath: '/project',
    isEmpty: false,
    isVirtualFs: false,
    cwd: '/project'
  };
  yield* createLogAutoCollect().pipe(
    Effect.provideService(ExtensionProviderService, {
      getServicesApi: Effect.succeed(servicesApi)
    } as unknown as ExtensionProviderService['Service']),
    Effect.provideService(CurrentTraceFlags, traceFlagsRef),
    Effect.provideService(KnownLogIdsRef, knownIdsRef),
    Effect.provideService(LogCollectorStateRef, collectorRef),
    Effect.provideService(ApexLogService, {
      listLogs,
      getLogBody: (bodyLogId: string) =>
        SubscriptionRef.get(targetOrgRef).pipe(
          Effect.flatMap(({ orgId }) => Effect.tryPromise(() => request(String(orgId), bodyLogId)))
        )
    } as unknown as ApexLogService['Service']),
    Effect.provideService(ChannelService, {
      appendToChannel: () => Effect.void
    } as unknown as ChannelService['Service']),
    Effect.provideService(TargetOrgRef, targetOrgRef),
    Effect.provideService(SettingsChangePubSub, settingsChanges),
    Effect.provideService(SettingsService, {
      getValueOrElse: () => Ref.get(intervalRef)
    } as unknown as SettingsService['Service']),
    Effect.provideService(WorkspaceService, {
      getWorkspaceInfoOrThrow: () => Effect.succeed(workspaceInfo)
    } as unknown as WorkspaceService['Service']),
    Effect.provideService(FsService, {
      readDirectory: () =>
        Effect.succeed([URI.file(`/project/execute-anonymous-2026-10-23T12-00-00-${log('07Lexec').Id}`)]),
      isDirectory: () => Effect.succeed(true),
      writeFile
    } as unknown as FsService['Service']),
    Effect.forkScoped
  );
  const advance = (seconds: number) => Effect.sleep(Duration.seconds(seconds));
  const setInterval = (seconds: number) =>
    Ref.set(intervalRef, seconds).pipe(
      Effect.flatMap(() => PubSub.publish(settingsChanges, { affectsConfiguration: () => true }))
    );
  return {
    targetOrgRef,
    traceFlagsRef,
    knownIdsRef,
    collectorRef,
    listLogs,
    request,
    writeFile,
    advance,
    setInterval
  };
});

beforeEach(() => {
  Object.defineProperty(vscode.window, 'state', { configurable: true, value: { active: true } });
});

describe('log auto collection', () => {
  vi.setConfig({ testTimeout: 20_000 });

  it('retains traced users, each user start, exec-anon exclusion, dedupe, storage, and collector state', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { listLogs, request, collectorRef, writeFile, advance } = yield* setup;
          listLogs.mockReturnValue(
            Effect.succeed([
              log('07Lold', userOne, '2026-10-23T09:00:00.000Z'),
              log('07Learly', userTwo, '2026-10-23T10:30:00.000Z'),
              log('07Lexec'),
              log('07Lgood')
            ])
          );
          yield* advance(1);
          yield* Effect.promise(() =>
            vi.waitFor(() =>
              expect(writeFile).toHaveBeenCalledWith(
                expect.objectContaining({ path: `/project/.sfdx/tools/debug/logs/${log('07Lgood').Id}.log` }),
                'body'
              )
            )
          );
          expect(listLogs).toHaveBeenCalledWith(25, {
            userIds: [userOne, userTwo],
            startTimeAfter: '2026-10-23T10:00:00.000Z'
          });
          yield* advance(2);
          expect(listLogs.mock.calls.length).toBeGreaterThan(1);
          expect(request).toHaveBeenCalledTimes(1);
          expect(yield* SubscriptionRef.get(collectorRef)).toEqual({ isCollecting: true, collectedCount: 1 });
        })
      )
    );
  });

  it('gates scheduled polls on window activity and replaces the schedule when the interval becomes zero', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { listLogs, advance, setInterval, traceFlagsRef } = yield* setup;
          Object.defineProperty(vscode.window, 'state', { configurable: true, value: { active: false } });
          yield* advance(1);
          yield* Effect.promise(() => vi.waitFor(() => expect(listLogs).toHaveBeenCalledTimes(1)));
          yield* advance(3);
          expect(listLogs).toHaveBeenCalledTimes(1);
          Object.defineProperty(vscode.window, 'state', { configurable: true, value: { active: true } });
          yield* advance(2);
          expect(listLogs.mock.calls.length).toBeGreaterThan(1);
          yield* setInterval(0);
          yield* Effect.yieldNow;
          yield* advance(1);
          const callsAfterDisable = listLogs.mock.calls.length;
          yield* advance(5);
          expect(listLogs).toHaveBeenCalledTimes(callsAfterDisable);
          // Disabling the timer does not disable explicit trace-flag refresh collection.
          yield* SubscriptionRef.update(traceFlagsRef, flags => [...flags]);
          yield* advance(1);
          expect(listLogs).toHaveBeenCalledTimes(callsAfterDisable + 1);
        })
      )
    );
  });

  it('writes all logs returned by the V2 service', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { listLogs, writeFile, advance } = yield* setup;
          const startTime = new Date().toISOString();
          const logs = Array.from({ length: 503 }, (_, index) =>
            log(`07L${String(index).padStart(12, '0')}`, userOne, startTime)
          );
          listLogs.mockReturnValue(Effect.succeed(logs));
          yield* advance(1);
          yield* Effect.promise(() =>
            vi.waitFor(() => expect(writeFile).toHaveBeenCalledTimes(logs.length), { timeout: 5000 })
          );
          expect(listLogs).toHaveBeenCalledExactlyOnceWith(25, expect.anything());
        })
      )
    );
  });

  it('ignores old-org bodies, resets known IDs on org change, and stops when the org is cleared', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { targetOrgRef, knownIdsRef, request, writeFile, advance } = yield* setup;
          const oldBody = yield* Deferred.make<string>();
          request.mockImplementation((orgId: string) =>
            orgId === '00D000000000001AAA'
              ? Effect.runPromise(Deferred.await(oldBody))
              : Promise.resolve('new org body')
          );
          yield* advance(2);
          yield* Effect.promise(() => vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1)));
          yield* Ref.set(knownIdsRef, HashSet.make(log('07Lgood').Id));
          yield* SubscriptionRef.set(targetOrgRef, {
            orgId: Schema.decodeUnknownSync(OrgId)('00D000000000002AAA')
          });
          yield* Deferred.succeed(oldBody, 'old org body');
          yield* advance(2);
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
      )
    );
  });

  it('keeps settings-only restarts activity-gated but permits trace refresh collection while inactive', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { listLogs, advance, setInterval, traceFlagsRef } = yield* setup;
          yield* advance(1);
          yield* Effect.promise(() => vi.waitFor(() => expect(listLogs).toHaveBeenCalledTimes(1)));
          Object.defineProperty(vscode.window, 'state', { configurable: true, value: { active: false } });
          yield* setInterval(2);
          yield* advance(5);
          expect(listLogs).toHaveBeenCalledTimes(1);
          yield* SubscriptionRef.update(traceFlagsRef, flags => [...flags]);
          yield* advance(1);
          expect(listLogs).toHaveBeenCalledTimes(2);
        })
      )
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
          const { traceFlagsRef, knownIdsRef, listLogs, request, writeFile, advance, setInterval } = yield* setup;
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
          const callsAfterRefresh = listLogs.mock.calls.length;
          yield* advance(3);
          expect(listLogs).toHaveBeenCalledTimes(callsAfterRefresh);
        })
      )
    );
  });

  it('rechecks trace expiration on each poll without requiring a trace-ref update', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { traceFlagsRef, listLogs, advance } = yield* setup;
          const flags = yield* SubscriptionRef.get(traceFlagsRef);
          yield* advance(1);
          yield* Effect.promise(() => vi.waitFor(() => expect(listLogs).toHaveBeenCalledTimes(1)));
          // Move the wall clock past expiry without publishing a new ref value.
          const now = vi.spyOn(Date, 'now').mockReturnValue(flags[0].expirationDate.getTime() + 1);
          yield* advance(3);
          now.mockRestore();
          expect(listLogs).toHaveBeenCalledTimes(1);
        })
      )
    );
  });
});
