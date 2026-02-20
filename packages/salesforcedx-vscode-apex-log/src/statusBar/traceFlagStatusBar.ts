/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { LogCollectorState } from '../logs/logAutoCollect';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Array from 'effect/Array';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Order from 'effect/Order';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { TraceFlagItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { messages } from '../messages/i18n';
import { LogCollectorStateRef, CurrentTraceFlags } from '../services/apexLogState';

const STATUS_BAR_ID = 'apex-trace-flag-status';
const STATUS_BAR_PRIORITY = 48;

const stopLink = (rec: TraceFlagItem) =>
  ` [${nls.localize('trace_flag_tooltip_stop')}](command:sf.apex.traceFlags.deleteForId?${encodeURIComponent(rec.id)})`;

const byName = Order.mapInput(Order.string, (r: TraceFlagItem) => r.tracedEntityName ?? r.tracedEntityId ?? '');

const byExpirationDesc = Order.mapInput(Order.reverse(Order.Date), (r: TraceFlagItem) => r.expirationDate);

const toLogTypeKey = (r: TraceFlagItem): 'DEVELOPER_LOG' | 'USER_DEBUG' | 'CLASS_TRACING' | 'TRIGGERS' | 'OTHER' => {
  if (r.tracedEntityId?.startsWith('01q')) return 'TRIGGERS';
  const { logType } = r;
  return logType === 'DEVELOPER_LOG' || logType === 'USER_DEBUG' || logType === 'CLASS_TRACING' ? logType : 'OTHER';
};

const LOG_TYPE_ORDER: ('DEVELOPER_LOG' | 'USER_DEBUG' | 'CLASS_TRACING' | 'TRIGGERS' | 'OTHER')[] = [
  'DEVELOPER_LOG',
  'USER_DEBUG',
  'CLASS_TRACING',
  'TRIGGERS',
  'OTHER'
];

const LABEL_KEYS: Record<(typeof LOG_TYPE_ORDER)[number], keyof typeof messages> = {
  DEVELOPER_LOG: 'trace_flag_tooltip_developer_log',
  USER_DEBUG: 'trace_flag_tooltip_user_debug',
  CLASS_TRACING: 'trace_flag_tooltip_classes',
  TRIGGERS: 'trace_flag_tooltip_triggers',
  OTHER: 'trace_flag_tooltip_other'
};

export const createTraceFlagStatusBar = () =>
  Effect.gen(function* () {
    const currentTraceFlagsRef = yield* CurrentTraceFlags;
    const collectorRef = yield* LogCollectorStateRef;
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const statusBarItem = vscode.window.createStatusBarItem(
      STATUS_BAR_ID,
      vscode.StatusBarAlignment.Left,
      STATUS_BAR_PRIORITY
    );
    // these never change
    statusBarItem.name = 'Salesforce: Trace Flag';
    statusBarItem.command = 'sf.apex.traceFlags.open';

    const targetOrgRef = yield* api.services.TargetOrgRef();
    yield* Effect.fork(
      Stream.mergeAll(
        [
          // because the org changed
          Stream.concat(Stream.fromEffect(SubscriptionRef.get(targetOrgRef)), targetOrgRef.changes).pipe(
            Stream.map(orgInfo => orgInfo.orgId),
            Stream.changes,
            Stream.as(undefined)
          ),
          // because the trace flags changed
          currentTraceFlagsRef.changes.pipe(Stream.as(undefined)),
          // because new logs
          collectorRef.changes.pipe(Stream.as(undefined))
        ],
        {
          concurrency: 'unbounded'
        }
      ).pipe(
        Stream.debounce(Duration.millis(300)),
        Stream.runForEach(() => refresh(statusBarItem))
      )
    );
    yield* api.services.ConnectionService.getConnection().pipe(Effect.catchAll(() => Effect.succeed(undefined)));
    yield* Effect.addFinalizer(() => Effect.sync(() => statusBarItem.dispose()));
    yield* Effect.sleep(Duration.infinity);
  });

const refresh = Effect.fn('ApexLog.traceFlagStatusBar.refresh', { root: true })(function* (
  statusBarItem: vscode.StatusBarItem
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  const { orgId } = yield* SubscriptionRef.get(ref);
  if (!orgId) {
    return statusBarItem.hide();
  }
  const traceFlagsRef = yield* CurrentTraceFlags;
  const activeRecords = (yield* SubscriptionRef.get(traceFlagsRef))
    .filter(rec => rec.isActive)
    .toSorted(byExpirationDesc);

  const collectorRef = yield* LogCollectorStateRef;
  const collectorState = yield* SubscriptionRef.get(collectorRef);
  statusBarItem.tooltip = buildTooltip(activeRecords, collectorState);
  statusBarItem.text = getStatusBarText(collectorState, activeRecords[0]);
  statusBarItem.show();
});

/** Build the tooltip for the status bar item */
const buildTooltip = (activeRecords: TraceFlagItem[], collectorState: LogCollectorState): vscode.MarkdownString => {
  const byKey = LOG_TYPE_ORDER.reduce<Record<(typeof LOG_TYPE_ORDER)[number], TraceFlagItem[]>>(
    (acc, key) => ({
      ...acc,
      [key]: Array.sort(
        activeRecords.filter(r => toLogTypeKey(r) === key),
        byName
      )
    }),
    { DEVELOPER_LOG: [], USER_DEBUG: [], CLASS_TRACING: [], TRIGGERS: [], OTHER: [] }
  );
  const tooltip = new vscode.MarkdownString();
  tooltip.isTrusted = true;
  const sections = LOG_TYPE_ORDER.map(key => ({ recs: byKey[key], labelKey: LABEL_KEYS[key] }));
  sections
    .filter(s => s.recs.length > 0)
    .forEach((s, i) => {
      if (i > 0) tooltip.appendMarkdown('\n---\n\n');
      tooltip.appendMarkdown(`**${nls.localize(s.labelKey)}**\n`);
      s.recs.forEach(r => {
        tooltip.appendMarkdown(`- ${r.tracedEntityName ?? r.tracedEntityId ?? r.id}${stopLink(r)}\n`);
      });
    });
  if (collectorState.isCollecting && collectorState.collectedCount > 0) {
    tooltip.appendMarkdown(
      `\n\n---\n\n**${nls.localize('log_auto_collect_tooltip', String(collectorState.collectedCount))}**\n`
    );
    tooltip.appendMarkdown(`[${nls.localize('log_auto_collect_open_folder')}](command:sf.apex.log.openFolder)\n`);
  }
  tooltip.appendMarkdown(`\n\n---\n\n**${nls.localize('trace_flag_tooltip_users')}**\n`);
  tooltip.appendMarkdown(
    `[${nls.localize('trace_flag_tooltip_add_user')}](command:sf.apex.traceFlags.createForUser)\n`
  );
  tooltip.appendMarkdown(
    `\n---\n\n[${nls.localize('trace_flag_tooltip_full_details')}](command:sf.apex.traceFlags.open)`
  );
  return tooltip;
};

/** Get the text for the status bar item */
const getStatusBarText = (collectorState: LogCollectorState, traceFlag?: TraceFlagItem | undefined) => {
  if (!traceFlag) {
    return `$(debug-disconnect) ${nls.localize('trace_flag_inactive')}`;
  }
  const until = traceFlag.expirationDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
  const collectIcon = collectorState.isCollecting && collectorState.collectedCount > 0 ? ' $(cloud-download)' : '';
  return `$(debug-alt) ${nls.localize('trace_flag_active', until)}${collectIcon}`;
};
