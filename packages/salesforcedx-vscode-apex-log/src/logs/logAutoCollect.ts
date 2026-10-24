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
import { isDate, isString, isUndefined } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { ApexLogListItem, TraceFlagItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { APEX_LOG_SETTINGS_SECTION } from '../constants';
import { nls } from '../messages';
import { KnownLogIdsRef, LogCollectorStateRef, CurrentTraceFlags } from '../services/apexLogState';
import { isTraceFlagActive } from '../traceFlags/traceFlagActive';
import { getExecAnonLogIds, saveLog } from './logStorage';

const toDate = (d: Date | string): Date => (isDate(d) ? d : new Date(d));

const isAfterTraceFlagStart =
  (startDateByUser: Map<string, Date>) =>
  (log: { LogUserId?: string; StartTime?: Date | string }): boolean => {
    const uid = log.LogUserId;
    const st = isUndefined(log.StartTime) ? undefined : isDate(log.StartTime) ? log.StartTime : new Date(log.StartTime);
    if (!uid || !st) return true;
    const userStart = startDateByUser.get(uid);
    return isUndefined(userStart) || st >= userStart;
  };

const getPollIntervalSeconds = Effect.fn('ApexLog.getPollIntervalSeconds')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const settings = yield* api.services.SettingsService;
  return yield* settings.getValueOrElse(APEX_LOG_SETTINGS_SECTION, 'logPollIntervalSeconds', 30);
});

const getTraceLogFilters = (items: TraceFlagItem[]) => {
  const activeItems = items.filter(isTraceFlagActive);
  const startDateByUser = new Map(
    [
      ...Map.groupBy(
        activeItems.filter(r => r.tracedEntityId?.startsWith('005') && r.startDate),
        r => r.tracedEntityId!
      )
    ].map(([userId, recs]) => [userId, recs.map(r => toDate(r.startDate!)).reduce((a, b) => (a < b ? a : b))])
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
    filters: userIds.length > 0 && minStart ? { userIds, startTimeAfter: minStart.toISOString() } : {}
  };
};

const createCollectionStream = Effect.fn('LogAutoCollect.createCollectionStream')(function* (
  collectWhileInactive: boolean
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const logService = yield* api.services.ApexLogService;
  const channelService = yield* api.services.ChannelService;
  const collectorRef = yield* LogCollectorStateRef;
  const knownIdsRef = yield* KnownLogIdsRef;
  const traceFlagsRef = yield* CurrentTraceFlags;
  const logStorageContext = yield* Effect.context<Effect.Effect.Context<ReturnType<typeof getExecAnonLogIds>>>();

  const pollOptions = Effect.fn('LogAutoCollect.pollOptions')(function* () {
    const { activeItems, filters } = getTraceLogFilters(yield* SubscriptionRef.get(traceFlagsRef));
    return (collectWhileInactive || vscode.window.state.active) && activeItems.length > 0
      ? Option.some(filters)
      : Option.none();
  });

  const filterLogs = Effect.fn('LogAutoCollect.filterLogs')(function* (logs: readonly ApexLogListItem[]) {
    const { startDateByUser } = getTraceLogFilters(yield* SubscriptionRef.get(traceFlagsRef));
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

  const reportLogError = (logId: string, error: { message: string }) =>
    Effect.log('LogAutoCollect: failed to save log', { logId, error: String(error) });
  return logService
    .streamLogs({
      // Timer replacement must not interrupt this poll's query, body retrieval, or storage.
      schedule: Schedule.recurs(0),
      pollOptions,
      filterLogs
    })
    .pipe(
      Stream.mapEffect(event =>
        Match.value(event).pipe(
          Match.tag('QueryError', ({ error }) =>
            channelService.appendToChannel(`[LogAutoCollect] listLogs failed: ${error.message}`)
          ),
          Match.tag('BodyError', ({ log, error }) => reportLogError(log.Id, error)),
          Match.tag('Log', ({ log, body }) =>
            saveLog(log.Id, body).pipe(
              Effect.flatMap(() =>
                channelService.appendToChannel(
                  nls.localize('log_auto_collect_fetched', log.Id, log.LogUser?.Name ?? 'Unknown', log.Operation ?? '')
                )
              ),
              Effect.tap(() => Ref.update(knownIdsRef, set => HashSet.add(set, log.Id))),
              Effect.catchTags({
                FsServiceError: error => reportLogError(log.Id, error),
                NoWorkspaceOpenError: error => reportLogError(log.Id, error),
                ServicesExtensionNotFoundError: error => reportLogError(log.Id, error),
                InvalidServicesApiError: error => reportLogError(log.Id, error)
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
  const interval = yield* getPollIntervalSeconds();
  return Stream.repeatEffectWithSchedule(
    Effect.void,
    interval > 0 ? Schedule.spaced(Duration.seconds(interval)) : Schedule.recurs(0)
  ).pipe(
    Stream.zipWithIndex,
    Stream.map(([, index]) => index === 0 && collectWhileInactive)
  );
});

/** Collects apex-node log streams; the extension owns triggers, filters, dedupe state, and storage. */
export const createLogAutoCollect = Effect.fn('ApexLog.createLogAutoCollect')(function* () {
  const traceFlagsRef = yield* CurrentTraceFlags;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const knownIdsRef = yield* KnownLogIdsRef;
  const targetOrgRef = yield* api.services.TargetOrgRef();
  const settingsChangePubSub = yield* api.services.SettingsChangePubSub;
  const pollIntervalSeconds = yield* getPollIntervalSeconds();

  yield* targetOrgRef.changes.pipe(
    Stream.map(orgInfo => orgInfo.orgId),
    Stream.changes,
    Stream.flatMap(
      orgId =>
        Stream.fromEffect(Ref.set(knownIdsRef, HashSet.empty<string>())).pipe(
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
                  Stream.debounce(calculateDebounce(pollIntervalSeconds)),
                  // Replace only timer emissions. Serial collection downstream finishes before the next poll.
                  Stream.flatMap(collectWhileInactive => Stream.unwrap(createPollTriggers(collectWhileInactive)), {
                    switch: true
                  }),
                  Stream.flatMap(collectWhileInactive => Stream.unwrap(createCollectionStream(collectWhileInactive)))
                )
          )
        ),
      // Org changes interrupt the old connection's stream, including in-flight body retrieval/storage.
      { switch: true }
    ),
    Stream.runDrain
  );
});

const calculateDebounce = (pollIntervalSeconds: number) =>
  Duration.millis(pollIntervalSeconds === 0 ? 1000 : Math.min(1000, pollIntervalSeconds * 1000 * 0.8));
