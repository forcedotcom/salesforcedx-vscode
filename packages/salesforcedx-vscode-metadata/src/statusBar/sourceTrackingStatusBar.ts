/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as PubSub from 'effect/PubSub';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { calculateCounts, dedupeStatus, getCommand, separateChanges } from './helpers';
import { buildCombinedHoverText } from './hover';

/* eslint-disable functional/no-let */
let fileWatcherSubscription: Fiber.RuntimeFiber<void, Error> | undefined;

/** Handle org change events */
const handleOrgChange =
  (statusBarItem: vscode.StatusBarItem) =>
  (orgInfo: { tracksSource?: boolean; orgId?: string }): Effect.Effect<void, Error, ExtensionProviderService> =>
    Effect.gen(function* () {
      if (!statusBarItem || !orgInfo.tracksSource || !orgInfo.orgId) {
        statusBarItem?.hide();
        stopFileWatcherSubscription();
        return;
      }

      yield* startFileWatcherSubscription(statusBarItem);
      yield* refresh(statusBarItem);
    });

/** Subscribe to the centralized file watcher PubSub with debouncing */
const startFileWatcherSubscription = (
  statusBarItem: vscode.StatusBarItem
): Effect.Effect<void, Error, ExtensionProviderService> =>
  Effect.gen(function* () {
    stopFileWatcherSubscription();
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    fileWatcherSubscription = yield* Effect.scoped(
      Effect.gen(function* () {
        const fileWatcherService = yield* api.services.FileWatcherService;
        const dequeue = yield* PubSub.subscribe(fileWatcherService.pubsub);

        // Subscribe to file changes with debouncing - we don't care which files changed, just that something changed
        yield* Stream.fromQueue(dequeue).pipe(
          // TODO: maybe filter out some changes by type or uri
          Stream.debounce(Duration.millis(500)),
          Stream.runForEach(() => refresh(statusBarItem))
        );
      })
    ).pipe(Effect.provide(AllServicesLayer), Effect.forkDaemon);
  });

/** Stop the file watcher subscription */
const stopFileWatcherSubscription = (): void => {
  if (fileWatcherSubscription) {
    Effect.runPromise(Fiber.interrupt(fileWatcherSubscription)).catch(() => {
      // Ignore errors when interrupting
    });
    fileWatcherSubscription = undefined;
  }
};

/** Refresh the status bar's data using data from tracking service */
const refresh = (statusBarItem: vscode.StatusBarItem): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    console.log('refresh source tracking status bar');
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const sourceTrackingService = yield* api.services.SourceTrackingService;

    const tracking = yield* sourceTrackingService.getSourceTracking();

    if (!tracking) {
      statusBarItem.hide();
      return;
    }

    yield* Effect.promise(() => tracking.reReadLocalTrackingCache());
    const status = yield* Effect.tryPromise(() => tracking.getStatus({ local: true, remote: true }));
    console.log('status from stl', JSON.stringify(status, null, 2));
    updateDisplay(statusBarItem)(dedupeStatus(status));
  }).pipe(
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

    // Apply styling
    if (counts.conflicts > 0) {
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (counts.local > 0 && process.env.ESBUILD_PLATFORM === 'web') {
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      statusBarItem.backgroundColor = undefined;
    }

    statusBarItem.show();
  };

/** Create and initialize source tracking status bar */
export const createSourceTrackingStatusBar = (): Effect.Effect<void, Error, Scope.Scope> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;

    const [channelService, connectionService] = yield* Effect.all(
      [api.services.ChannelService, api.services.ConnectionService],
      { concurrency: 'unbounded' }
    );
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 47);

    yield* Effect.fork(
      Stream.concat(
        Stream.fromEffect(SubscriptionRef.get(api.services.TargetOrgRef)), // initial org state has already been set
        api.services.TargetOrgRef.changes // Second scenario: org state changes laster
      ).pipe(
        Stream.tap(orgInfo => channelService.appendToChannel(`target org change: ${JSON.stringify(orgInfo)}`)),
        Stream.filter(orgInfo => orgInfo && typeof orgInfo === 'object' && 'tracksSource' in orgInfo),
        Stream.runForEach(orgInfo => handleOrgChange(statusBarItem)(orgInfo).pipe(Effect.catchAll(() => Effect.void)))
      )
    );

    // Now that the pubsub is running, if the org ref is not set, get the connection which will set it
    yield* connectionService.getConnection.pipe(
      // If there is no connection or an error, that's fine.
      Effect.catchAll(e => Effect.logError(e).pipe(Effect.as(undefined)))
    );
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        stopFileWatcherSubscription();
        statusBarItem.dispose();
      })
    );
    yield* Effect.sleep(Duration.infinity); // persist the ui component until the extensionscope closes
  }).pipe(Effect.provide(AllServicesLayer));
