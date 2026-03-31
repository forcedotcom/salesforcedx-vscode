/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { calculateBackground, calculateCounts, dedupeStatus, getCommand, separateChanges } from './helpers';
import { buildCombinedHoverText } from './hover';

/** Refresh the status bar's data using data from tracking service */
const refresh = Effect.fn('statusBarRefresh')(
  function* (statusBarItem: vscode.StatusBarItem) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const sourceTrackingService = yield* api.services.SourceTrackingService;

    const hasTracking = yield* sourceTrackingService.hasTracking();

    if (!hasTracking) {
      statusBarItem.hide();
      void vscode.commands.executeCommand('setContext', 'sf:has_conflicts', false);
      return;
    }

    const status = yield* sourceTrackingService.getStatus({ local: true, remote: true });
    updateDisplay(statusBarItem)(dedupeStatus(status));
  },
  Effect.catchAll(() => Effect.void) // ignore errors in refresh
);

/** Update the status bar display */
const updateDisplay =
  (statusBarItem: vscode.StatusBarItem) =>
  (dedupedStatus: StatusOutputRow[]): void => {
    // Build combined text - always show remote and local, only show conflicts if > 0
    const counts = calculateCounts(dedupedStatus);
    statusBarItem.text = [
      counts.conflicts > 0 ? `${counts.conflicts}$(warning)` : undefined,
      `${counts.remote}$(arrow-down)`,
      `${counts.local}$(arrow-up)`
    ]
      .filter(Boolean)
      .join(' ');

    // Build combined tooltip
    statusBarItem.tooltip = buildCombinedHoverText(separateChanges(dedupedStatus), counts);
    statusBarItem.command = getCommand(counts);
    statusBarItem.backgroundColor = calculateBackground(counts);
    void vscode.commands.executeCommand('setContext', 'sf:has_conflicts', counts.conflicts > 0);

    statusBarItem.show();
  };

/** Helper to read polling interval config */
const getPollingIntervalSeconds = (): number =>
  vscode.workspace.getConfiguration('salesforcedx-vscode-metadata')
    .get<number>('sourceTracking.pollingIntervalSeconds', 60);

/** Create and initialize source tracking status bar */
export const createSourceTrackingStatusBar = Effect.fn('createSourceTrackingStatusBar')(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;

    const statusBarItem = vscode.window.createStatusBarItem(
      'source-tracking-status-bar',
      vscode.StatusBarAlignment.Left,
      45
    );
    statusBarItem.name = 'Salesforce: Source Tracking';
    const fileWatcherService = yield* api.services.FileWatcherService;
    const dequeue = yield* PubSub.subscribe(fileWatcherService.pubsub);

    const targetOrgRef = yield* api.services.TargetOrgRef();

    // Setup dynamic polling interval that responds to config changes
    const settingsWatcher = yield* api.services.SettingsWatcherService;
    const pollIntervalRef = yield* SubscriptionRef.make(Duration.seconds(getPollingIntervalSeconds()));

    // Watch setting changes to update poll frequency dynamically
    yield* Effect.fork(
      Stream.fromPubSub(settingsWatcher.pubsub).pipe(
        Stream.filter(event => event.affectsConfiguration('salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds')),
        Stream.runForEach(() => SubscriptionRef.set(pollIntervalRef, Duration.seconds(getPollingIntervalSeconds())))
      )
    );
    const orgChangeStream = Stream.concat(
      Stream.fromEffect(SubscriptionRef.get(targetOrgRef)), // if initial state has already been set
      targetOrgRef.changes // ongoing org changes
    ).pipe(
      Stream.filter(orgInfo => orgInfo && typeof orgInfo === 'object' && 'tracksSource' in orgInfo),
      Stream.tap(orgInfo =>
        Effect.sync(() => {
          if (!orgInfo.tracksSource || !orgInfo.orgId) {
            statusBarItem.hide();
          }
        })
      ),
      Stream.map(orgInfo => orgInfo.orgId),
      Stream.changes,
      Stream.as('orgChange')
    );

    // Dynamic poll stream that restarts when interval changes
    const dynamicPollStream = Stream.concat(
      Stream.make(yield* SubscriptionRef.get(pollIntervalRef)),
      pollIntervalRef.changes
    ).pipe(
      Stream.filter(d => Duration.greaterThan(d, Duration.zero)), // 0 means don't poll
      Stream.flatMap(
        interval => Stream.fromSchedule(Schedule.fixed(interval)).pipe(
          Stream.filter(() => vscode.window.state.active)
        ),
        { switch: true } // Restart schedule when interval changes
      )
    );

    const fileChangeStream = Stream.merge(
      // Subscribe to file changes TODO: maybe filter out some changes by type or uri
      Stream.fromQueue(dequeue).pipe(Stream.debounce(Duration.millis(500))),
      // Poll for remote changes with configurable interval
      dynamicPollStream
    ).pipe(
      Stream.debounce(Duration.millis(500)),
      // we don't care about file events if source tracking is not enabled
      Stream.filterEffect(() =>
        SubscriptionRef.get(targetOrgRef).pipe(Effect.andThen(orgInfo => Boolean(orgInfo.tracksSource)))
      ),
      Stream.as('refresh')
    );

    yield* Effect.fork(
      Stream.merge(orgChangeStream, fileChangeStream).pipe(
        Stream.debounce(Duration.millis(500)),
        Stream.runForEach(() => refresh(statusBarItem))
      )
    );

    // Now that the pubsub is running, if the org ref is not set, get the connection which will set it
    yield* api.services.ConnectionService.getConnection().pipe(
      // If there is no connection or an error, that's fine.
      Effect.catchAll(e => Effect.logError(e).pipe(Effect.as(undefined)))
    );
    yield* Effect.addFinalizer(() => Effect.sync(() => statusBarItem.dispose()));
    yield* Effect.sleep(Duration.infinity); // persist the ui component until the extensionscope closes
});
