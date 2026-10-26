/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Arr from 'effect/Array';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import { isString, isUndefined } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { ApexLogListItem, ListLogsOptions, TraceFlagItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { APEX_LOG_SETTINGS_SECTION } from '../constants';
import { nls } from '../messages';
import { KnownLogIdsRef, LogCollectorStateRef, CurrentTraceFlags } from '../services/apexLogState';
import { isTraceFlagActive } from '../traceFlags/traceFlagActive';
import { getExecAnonLogIds, saveLog } from './logStorage';

type LogCursor = NonNullable<ListLogsOptions['cursor']>;

const LOG_POLL_LIMIT = 500;
// Re-query recent StartTimes in case a log becomes visible after its transaction completes.

const cursorPollOptions = (cursor: LogCursor, filters: ListLogsOptions, lookbackStart: string): ListLogsOptions => {
  if (cursor.startTime <= lookbackStart) return { ...filters, cursor };
  return {
    ...filters,
    startTimeAfter:
      isUndefined(filters.startTimeAfter) || lookbackStart > filters.startTimeAfter
        ? lookbackStart
        : filters.startTimeAfter
  };
};

const isCursorAfter = (candidate: { startTime: string; id: string }, current: LogCursor): boolean =>
  candidate.startTime > current.startTime ||
  (candidate.startTime === current.startTime && (isUndefined(current.id) || candidate.id > current.id));

const isAfterTraceFlagStart =
  (startDateByUser: Map<string, Date>) =>
  (log: ApexLogListItem): boolean => {
    const uid = log.LogUserId;
    if (!uid) return true;
    const userStart = startDateByUser.get(uid);
    return isUndefined(userStart) || new Date(log.StartTime) >= userStart;
  };

const getPollInterval = Effect.fn('ApexLog.getPollInterval')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const settings = yield* api.services.SettingsService;
  return yield* settings
    .getValueOrElse(APEX_LOG_SETTINGS_SECTION, 'logPollIntervalSeconds', 30)
    .pipe(Effect.map(Duration.seconds));
});

const getTraceLogFilters = (items: TraceFlagItem[]) => {
  const activeItems = items.filter(isTraceFlagActive);
  const startDateByUser = new Map(
    [
      ...Map.groupBy(
        activeItems.filter(r => r.tracedEntityId?.startsWith('005') && r.startDate),
        r => r.tracedEntityId!
      )
    ].map(([userId, recs]) => [userId, recs.map(r => r.startDate!).reduce((a, b) => (a < b ? a : b))])
  );
  const userIds = Arr.dedupe(
    activeItems
      .map(r => r.tracedEntityId)
      .filter(isString)
      .filter(id => id.startsWith('005'))
  );
  const minStart =
    startDateByUser.size > 0 ? [...startDateByUser.values()].reduce((a, b) => (a < b ? a : b)) : undefined;

  return {
    activeItems,
    startDateByUser,
    cursorKey: JSON.stringify([
      userIds,
      [...startDateByUser].map(([userId, startDate]) => [userId, startDate.toISOString()])
    ]),
    filters: userIds.length > 0 && minStart ? { userIds, startTimeAfter: minStart.toISOString() } : {}
  };
};

const createCollectionStream = Effect.fn('LogAutoCollect.createCollectionStream')(function* (
  collectWhileInactive: boolean,
  cursorRef: Ref.Ref<Option.Option<LogCursor>>,
  cursorFilterKeyRef: Ref.Ref<Option.Option<string>>,
  pollFailedRef: Ref.Ref<boolean>,
  cursorOverlap: Duration.Duration
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const logService = yield* api.services.ApexLogService;
  const channelService = yield* api.services.ChannelService;
  const collectorRef = yield* LogCollectorStateRef;
  const knownIdsRef = yield* KnownLogIdsRef;
  const traceFlagsRef = yield* CurrentTraceFlags;
  const logStorageContext = yield* Effect.context<Effect.Effect.Context<ReturnType<typeof getExecAnonLogIds>>>();

  const pollOptions = Effect.fn('LogAutoCollect.pollOptions')(function* () {
    const { activeItems, cursorKey, filters } = getTraceLogFilters(yield* SubscriptionRef.get(traceFlagsRef));
    const previousFilterKey = yield* Ref.get(cursorFilterKeyRef);
    const filtersChanged = Option.match(previousFilterKey, {
      onNone: () => true,
      onSome: previous => previous !== cursorKey
    });
    if (filtersChanged) {
      yield* Ref.set(cursorFilterKeyRef, Option.some(cursorKey));
      yield* Ref.set(cursorRef, Option.none());
    }
    const cursor = filtersChanged ? Option.none<LogCursor>() : yield* Ref.get(cursorRef);
    yield* Ref.set(pollFailedRef, false);
    if (!(collectWhileInactive || vscode.window.state.active) || activeItems.length === 0) return Option.none();
    const lookbackStart = new Date(Date.now() - Duration.toMillis(cursorOverlap)).toISOString();
    return Option.some(
      Option.match(cursor, {
        onNone: () => ({ ...filters, orderBy: 'ASC' as const }),
        onSome: value =>
          value.startTime < lookbackStart
            ? { ...filters, cursor: value, orderBy: 'ASC' as const }
            : { ...cursorPollOptions(value, filters, lookbackStart), orderBy: 'ASC' as const }
      })
    );
  });

  const filterLogs = Effect.fn('LogAutoCollect.filterLogs')(function* (logs: readonly ApexLogListItem[]) {
    const { startDateByUser } = getTraceLogFilters(yield* SubscriptionRef.get(traceFlagsRef));
    const lastLog = logs.at(-1);
    if (!isUndefined(lastLog)) {
      const nextCursor = { startTime: lastLog.StartTime, id: lastLog.Id };
      const currentCursor = yield* Ref.get(cursorRef);
      yield* Ref.set(
        cursorRef,
        Option.some(
          Option.match(currentCursor, {
            onNone: () => nextCursor,
            onSome: current => (isCursorAfter(nextCursor, current) ? nextCursor : current)
          })
        )
      );
    }
    const knownIds = yield* Ref.get(knownIdsRef);
    const execAnonIds = yield* getExecAnonLogIds().pipe(
      Effect.provide(logStorageContext),
      Effect.catchTags({
        NoWorkspaceOpenError: () => Effect.succeed(new Set<string>()),
        ServicesExtensionNotFoundError: () => Effect.succeed(new Set<string>()),
        InvalidServicesApiError: () => Effect.succeed(new Set<string>())
      })
    );
    const newLogs = logs
      .filter(isAfterTraceFlagStart(startDateByUser))
      .filter(log => !HashSet.has(knownIds, log.Id) && !execAnonIds.has(log.Id));
    if (newLogs.length > 0) {
      yield* SubscriptionRef.update(collectorRef, state => ({
        ...state,
        isCollecting: true,
        collectedCount: state.collectedCount + newLogs.length
      }));
    }
    return newLogs;
  });

  const reportLogError = Effect.fn('LogAutoCollect.reportLogError')(function* (
    log: ApexLogListItem,
    error: { message: string }
  ) {
    if (!(yield* Ref.get(pollFailedRef))) {
      yield* Ref.set(pollFailedRef, true);
      yield* Ref.set(cursorRef, Option.some({ startTime: log.StartTime }));
    }
    yield* Effect.log('LogAutoCollect: failed to save log', { logId: log.Id, error: String(error) });
  });
  return logService
    .streamLogs({
      // Timer replacement must not interrupt this poll's query, body retrieval, or storage.
      schedule: Schedule.recurs(0),
      limit: LOG_POLL_LIMIT,
      pollOptions,
      filterLogs
    })
    .pipe(
      Stream.mapEffect(event =>
        Match.value(event).pipe(
          Match.tag('QueryError', ({ error }) =>
            channelService.appendToChannel(`[LogAutoCollect] listLogs failed: ${error.message}`)
          ),
          Match.tag('BodyError', ({ log, error }) => reportLogError(log, error)),
          Match.tag('Log', ({ log, body }) =>
            saveLog(log.Id, body).pipe(
              Effect.flatMap(() =>
                channelService.appendToChannel(
                  nls.localize('log_auto_collect_fetched', log.Id, log.LogUser?.Name ?? 'Unknown', log.Operation ?? '')
                )
              ),
              Effect.tap(() => Ref.update(knownIdsRef, set => HashSet.add(set, log.Id))),
              Effect.catchTags({
                FsServiceError: error => reportLogError(log, error),
                NoWorkspaceOpenError: error => reportLogError(log, error),
                ServicesExtensionNotFoundError: error => reportLogError(log, error),
                InvalidServicesApiError: error => reportLogError(log, error)
              })
            )
          ),
          Match.exhaustive
        )
      ),
      Stream.withSpan('LogAutoCollect.collectNewLogs', { root: true, attributes: { telemetryIgnore: true } })
    );
});

const createPollTriggers = Effect.fn('LogAutoCollect.createPollTriggers')(function* (collectWhileInactive: boolean) {
  const interval = yield* getPollInterval();
  const cursorOverlap = Duration.max(Duration.minutes(1), Duration.times(interval, 2));
  return Stream.repeatEffectWithSchedule(
    Effect.void,
    Duration.isZero(interval) ? Schedule.recurs(0) : Schedule.spaced(interval)
  ).pipe(
    Stream.zipWithIndex,
    Stream.map(([, index]) => ({ collectWhileInactive: index === 0 && collectWhileInactive, cursorOverlap }))
  );
});

/** Collects apex-node log streams; the extension owns triggers, filters, dedupe state, and storage. */
export const createLogAutoCollect = Effect.fn('ApexLog.createLogAutoCollect')(function* () {
  const traceFlagsRef = yield* CurrentTraceFlags;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const knownIdsRef = yield* KnownLogIdsRef;
  const cursorRef = yield* Ref.make(Option.none<LogCursor>());
  const cursorFilterKeyRef = yield* Ref.make(Option.none<string>());
  const pollFailedRef = yield* Ref.make(false);
  const targetOrgRef = yield* api.services.TargetOrgRef();
  const settingsChangePubSub = yield* api.services.SettingsChangePubSub;
  const pollInterval = yield* getPollInterval();

  yield* targetOrgRef.changes.pipe(
    Stream.map(orgInfo => orgInfo.orgId),
    Stream.changes,
    Stream.flatMap(
      orgId =>
        Stream.fromEffect(
          Effect.all([
            Ref.set(knownIdsRef, HashSet.empty<string>()),
            Ref.set(cursorRef, Option.none()),
            Ref.set(cursorFilterKeyRef, Option.none()),
            Ref.set(pollFailedRef, false)
          ])
        ).pipe(
          Stream.flatMap(() =>
            isUndefined(orgId)
              ? Stream.empty
              : Stream.merge(
                  traceFlagsRef.changes.pipe(Stream.as(true)),
                  Stream.fromPubSub(settingsChangePubSub).pipe(
                    Stream.filter(event =>
                      event.affectsConfiguration('salesforcedx-vscode-apex-log.logPollIntervalSeconds')
                    ),
                    Stream.as(false)
                  )
                ).pipe(
                  // Coalesce trace-flag refresh with org readiness, including workspace reload.
                  Stream.debounce(calculateDebounce(pollInterval)),
                  // Replace only timer emissions. Serial collection downstream finishes before the next poll.
                  Stream.flatMap(collectWhileInactive => Stream.unwrap(createPollTriggers(collectWhileInactive)), {
                    switch: true
                  }),
                  Stream.flatMap(({ collectWhileInactive, cursorOverlap }) =>
                    Stream.unwrap(
                      createCollectionStream(
                        collectWhileInactive,
                        cursorRef,
                        cursorFilterKeyRef,
                        pollFailedRef,
                        cursorOverlap
                      )
                    )
                  )
                )
          )
        ),
      // Org changes interrupt the old connection's stream, including in-flight body retrieval/storage.
      { switch: true }
    ),
    Stream.runDrain
  );
});

const calculateDebounce = (pollInterval: Duration.Duration): Duration.Duration =>
  Duration.isZero(pollInterval)
    ? Duration.millis(1000)
    : Duration.min(Duration.millis(1000), Duration.times(pollInterval, 0.8));
