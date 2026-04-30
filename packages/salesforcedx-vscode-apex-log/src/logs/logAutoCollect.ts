/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { type LogCollectorState, LogCollectorStateRef, CurrentTraceFlags } from '../services/apexLogState';
import { getExecAnonLogIds, saveLog } from './logStorage';

const toDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

const isAfterTraceFlagStart =
  (startDateByUser: Map<string, Date>) =>
  (log: { LogUserId?: string; StartTime?: Date | string }): boolean => {
    const uid = log.LogUserId;
    const st =
      log.StartTime === undefined ? undefined : log.StartTime instanceof Date ? log.StartTime : new Date(log.StartTime);
    if (!uid || !st) return true;
    const userStart = startDateByUser.get(uid);
    return userStart === undefined || st >= userStart;
  };

const collectNewLogs = Effect.fn('LogAutoCollect.collectNewLogs')(function* (
  knownIdsRef: Ref.Ref<Set<string>>,
  collectorRef: SubscriptionRef.SubscriptionRef<LogCollectorState>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const knownIds = yield* Ref.get(knownIdsRef);

  const channelService = yield* api.services.ChannelService;
  const items = yield* SubscriptionRef.get(yield* CurrentTraceFlags);
  const activeItems = items.filter(r => r.isActive);
  if (activeItems.length === 0) return;

  const execAnonIds: Set<string> = yield* Effect.catchAll(getExecAnonLogIds(), () => Effect.succeed(new Set<string>()));

  const startDateByUser = new Map(
    [
      ...Map.groupBy(
        activeItems.filter(r => r.tracedEntityId?.startsWith('005') && r.startDate),
        r => r.tracedEntityId!
      )
    ].map(([userId, recs]) => [userId, recs.map(r => toDate(r.startDate!)).reduce((a, b) => (a < b ? a : b))])
  );
  const userIds = [
    ...new Set(
      activeItems
        .map(r => r.tracedEntityId)
        .filter(isString)
        .filter(id => id.startsWith('005'))
    )
  ];
  const minStart =
    startDateByUser.size > 0 ? [...startDateByUser.values()].reduce((a, b) => (a < b ? a : b)) : undefined;

  const newLogs = (yield* api.services.ApexLogService.listLogs(
    25,
    userIds.length > 0 && minStart ? { userIds, startTimeAfter: minStart.toISOString() } : undefined
  ).pipe(
    Effect.catchAll(e =>
      channelService.appendToChannel(`[LogAutoCollect] listLogs failed: ${e.message}`).pipe(Effect.as([]))
    )
  ))
    .filter(isAfterTraceFlagStart(startDateByUser))
    .filter(l => !knownIds.has(l.Id) && !execAnonIds.has(l.Id));

  if (newLogs.length === 0) return;

  yield* SubscriptionRef.update(collectorRef, s => ({
    ...s,
    isCollecting: true,
    collectedCount: s.collectedCount + newLogs.length
  }));

  yield* Stream.fromIterable(newLogs).pipe(
    Stream.runForEach(log =>
      api.services.ApexLogService.getLogBody(log.Id).pipe(
        Effect.flatMap(body => saveLog(log.Id, body)),
        Effect.flatMap(() =>
          channelService.appendToChannel(
            nls.localize('log_auto_collect_fetched', log.Id, log.LogUser?.Name ?? 'Unknown', log.Operation ?? '')
          )
        ),
        Effect.tap(() => Ref.update(knownIdsRef, set => new Set(set).add(log.Id))),
        Effect.catchAll(e => Effect.log('LogAutoCollect: failed to save log', { logId: log.Id, error: String(e) }))
      )
    )
  );
});

const getPollIntervalSeconds = (): number =>
  vscode.workspace.getConfiguration('salesforcedx-vscode-apex-log').get<number>('logPollIntervalSeconds', 30);

/** Polling stream that auto-collects Apex logs when trace flags are active. Writes to collectorRef for status bar display. */
export const createLogAutoCollect = Effect.fn('ApexLog.createLogAutoCollect')(function* () {
  const traceFlagRefreshRef = yield* CurrentTraceFlags;
  const collectorRef = yield* LogCollectorStateRef;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const knownIdsRef = yield* Ref.make(new Set<string>());
  const targetOrgRef = yield* api.services.TargetOrgRef();

  const settingsChangePubSub = yield* api.services.SettingsChangePubSub;
  const pollIntervalRef = yield* SubscriptionRef.make(Duration.seconds(getPollIntervalSeconds()));

  // watch the setting to update poll freq
  yield* Effect.fork(
    Stream.fromPubSub(settingsChangePubSub).pipe(
      Stream.filter(event => event.affectsConfiguration('salesforcedx-vscode-apex-log.logPollIntervalSeconds')),
      Stream.runForEach(() => SubscriptionRef.set(pollIntervalRef, Duration.seconds(getPollIntervalSeconds())))
    )
  );

  // when the org changes, clear the knownIds
  yield* Effect.fork(
    targetOrgRef.changes.pipe(
      Stream.map(orgInfo => orgInfo.orgId),
      Stream.changes,
      Stream.as(undefined),
      Stream.runForEach(() => Ref.set(knownIdsRef, new Set()).pipe(Effect.asVoid))
    )
  );

  const dynamicPollStream = pollIntervalRef.changes.pipe(
    Stream.filter(d => Duration.greaterThan(d, Duration.zero)), // 0 means don't poll
    Stream.flatMap(
      interval => Stream.fromSchedule(Schedule.spaced(interval)).pipe(Stream.filter(() => vscode.window.state.active)),
      // With switch: true: When the interval changes, the previous schedule stream is interrupted and a new one starts.
      // So changing the poll interval immediately replaces the old schedule with the new one instead of stacking them.
      { switch: true }
    )
  );
  const refreshStream = traceFlagRefreshRef.changes.pipe(Stream.as(undefined));
  // When org becomes ready, status bar fetches trace flags and sets the ref. LogAutoCollect must also
  // react to org changes so it doesn't miss the initial ref update (race on workspace reload).
  const orgChangeStream = targetOrgRef.changes.pipe(
    Stream.map(orgInfo => orgInfo.orgId),
    Stream.changes,
    Stream.as(undefined)
  );

  yield* Effect.fork(
    // run when we know something changed OR when it's time based on polling
    Stream.mergeAll([dynamicPollStream, refreshStream, orgChangeStream], { concurrency: 'unbounded' }).pipe(
      // if the polling interval === the debounce, events don't make it through the stream
      // 1s is fine except when the polling interval is very low
      Stream.debounce(calculateDebounce(getPollIntervalSeconds())),
      Stream.runForEach(() => collectNewLogs(knownIdsRef, collectorRef))
    )
  );

  yield* Effect.sleep(Duration.infinity);
});

const calculateDebounce = (pollIntervalSeconds: number) =>
  Duration.millis(pollIntervalSeconds === 0 ? 1000 : Math.min(1000, pollIntervalSeconds * 1000 * 0.8));
