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
import { AllServicesLayer } from '../services/extensionProvider';
import { calculateBackground, calculateCounts, dedupeStatus, getCommand, separateChanges } from './helpers';
import { buildCombinedHoverText } from './hover';

/** Refresh the status bar's data using data from tracking service */
const refresh = (statusBarItem: vscode.StatusBarItem) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const sourceTrackingService = yield* api.services.SourceTrackingService;

    const tracking = yield* sourceTrackingService.getSourceTracking();

    if (!tracking) {
      statusBarItem.hide();
      return;
    }

    yield* Effect.all(
      [
        Effect.promise(() => tracking.reReadLocalTrackingCache()),
        Effect.promise(() => tracking.reReadRemoteTracking())
      ],
      { concurrency: 'unbounded' }
    );
    const status = yield* Effect.tryPromise(() => tracking.getStatus({ local: true, remote: true }));
    updateDisplay(statusBarItem)(dedupeStatus(status));
  }).pipe(
    Effect.withSpan('statusBarRefresh'),
    Effect.provide(AllServicesLayer),
    Effect.catchAll(() => Effect.succeed(undefined)) // ignore errors in refresh
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

    statusBarItem.show();
  };

/** Create and initialize source tracking status bar */
export const createSourceTrackingStatusBar = () =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;

    const statusBarItem = vscode.window.createStatusBarItem(
      'source-tracking-status-bar',
      vscode.StatusBarAlignment.Left,
      45
    );
    statusBarItem.name = 'Salesforce: Source Tracking';
    const fileWatcherService = yield* api.services.FileWatcherService;
    const dequeue = yield* PubSub.subscribe(fileWatcherService.pubsub);

    const targetOrgRef = yield* api.services.TargetOrgRef();
    const orgChangeStream = Stream.concat(
      Stream.fromEffect(SubscriptionRef.get(targetOrgRef)), // if initial state has already been set
      targetOrgRef.changes // ongoing org changes
    ).pipe(
      Stream.tap(orgInfo => channelService.appendToChannel(`target org change: ${JSON.stringify(orgInfo)}`)),
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

    const fileChangeStream = Stream.merge(
      // Subscribe to file changes TODO: maybe filter out some changes by type or uri
      Stream.fromQueue(dequeue).pipe(Stream.debounce(Duration.millis(500))),
      // poll for remote changes TODO: make this a configurable Setting for polling frequency
      Stream.fromSchedule(Schedule.fixed(Duration.minutes(1))).pipe(Stream.filter(() => vscode.window.state.active))
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
