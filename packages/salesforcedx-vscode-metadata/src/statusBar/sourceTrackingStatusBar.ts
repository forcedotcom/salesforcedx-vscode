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
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { buildCombinedHoverText } from './hover';

type SourceTrackingCounts = {
  local: number;
  remote: number;
  conflicts: number;
};

type SourceTrackingDetails = {
  localChanges: StatusOutputRow[];
  remoteChanges: StatusOutputRow[];
  conflicts: StatusOutputRow[];
};

/* eslint-disable functional/no-let */
let statusBarItem: vscode.StatusBarItem | undefined;
let fileWatcherSubscription: Fiber.RuntimeFiber<void, Error> | undefined;
let lastDetails: SourceTrackingDetails | undefined;
/* eslint-enable functional/no-let */

/** Deduplicate status rows by fullName and type */
const dedupeStatus = (status: StatusOutputRow[]): StatusOutputRow[] => {
  const seen = new Set<string>();
  return status.filter(row => {
    const key = `${row.fullName}:${row.type}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/** Calculate counts from status output rows */
const calculateCounts = (status: StatusOutputRow[]): SourceTrackingCounts => {
  const local = status.filter(row => row.origin === 'local' && !row.conflict && !row.ignored).length;
  const remote = status.filter(row => row.origin === 'remote' && !row.conflict && !row.ignored).length;
  const conflicts = status.filter(row => row.conflict && !row.ignored).length;

  return { local, remote, conflicts };
};

/** Separate changes by type for hover details */
const separateChanges = (status: StatusOutputRow[]): SourceTrackingDetails => {
  const localChanges = status.filter(row => row.origin === 'local' && !row.conflict && !row.ignored);
  const remoteChanges = status.filter(row => row.origin === 'remote' && !row.conflict && !row.ignored);
  const conflicts = status.filter(row => row.conflict && !row.ignored);

  return { localChanges, remoteChanges, conflicts };
};

/** Handle org change events */
const handleOrgChange = (orgInfo: {
  tracksSource?: boolean;
  orgId?: string;
}): Effect.Effect<void, Error, ExtensionProviderService> =>
  Effect.gen(function* () {
    if (!statusBarItem || !orgInfo.tracksSource || !orgInfo.orgId) {
      statusBarItem?.hide();
      stopFileWatcherSubscription();
      return;
    }

    yield* startFileWatcherSubscription();
    yield* refresh();
  });

/** Subscribe to the centralized file watcher PubSub with debouncing */
const startFileWatcherSubscription = (): Effect.Effect<void, Error, ExtensionProviderService> =>
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
          Stream.runForEach(() => refresh())
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

/** Refresh the status bar's data */
const refresh = (): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (!statusBarItem) {
      return yield* Effect.succeed(undefined);
    }

    console.log('refresh source tracking status bar');
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const sourceTrackingService = yield* api.services.SourceTrackingService;

    const tracking = yield* sourceTrackingService.getSourceTracking();

    if (!tracking) {
      statusBarItem!.hide();
      return;
    }

    yield* Effect.promise(() => tracking.reReadLocalTrackingCache());
    const status = yield* Effect.tryPromise(() => tracking.getStatus({ local: true, remote: true }));
    console.log('status from stl', JSON.stringify(status, null, 2));

    const dedupedStatus = dedupeStatus(status);
    lastDetails = separateChanges(dedupedStatus);
    updateDisplay(calculateCounts(dedupedStatus));
  }).pipe(
    Effect.provide(AllServicesLayer),
    Effect.catchAll(() => Effect.succeed(undefined)) // ignore errors in refresh
  );

/** Update the status bar display */
const updateDisplay = (counts: SourceTrackingCounts): void => {
  if (!statusBarItem || !lastDetails) {
    return statusBarItem?.hide();
  }

  // Build combined text - always show remote and local, only show conflicts if > 0
  statusBarItem.text = [
    counts.conflicts > 0 ? `${counts.conflicts}$(warning)` : undefined,
    `${counts.remote}$(arrow-down)`,
    `${counts.local}$(arrow-up)`
  ]
    .filter(Boolean)
    .join(' ');

  // Build combined tooltip
  statusBarItem.tooltip = buildCombinedHoverText(lastDetails, counts);
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
export const createSourceTrackingStatusBar = (): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 47);

    yield* Stream.concat(
      Stream.fromEffect(SubscriptionRef.get(api.services.TargetOrgRef)), // initial org state has already been set
      api.services.TargetOrgRef.changes // Second scenario: org state changes laster
    ).pipe(
      Stream.tap(orgInfo => channelService.appendToChannel(`target org change: ${JSON.stringify(orgInfo)}`)),
      Stream.filter(orgInfo => orgInfo && typeof orgInfo === 'object' && 'tracksSource' in orgInfo),
      Stream.runForEach(orgInfo => handleOrgChange(orgInfo).pipe(Effect.catchAll(() => Effect.void))),
      Effect.forkDaemon
    );

    // in case the org ref is not set, get the connection to try to init it.  If there is no connection or an error, that's fine.
    yield* Effect.flatMap(api.services.ConnectionService, svc => svc.getConnection).pipe(
      Effect.catchAll(e => Effect.logError(e).pipe(Effect.as(undefined)))
    );
  }).pipe(Effect.provide(AllServicesLayer));

/** Dispose of all resources */
export const disposeSourceTrackingStatusBar = (): void => {
  stopFileWatcherSubscription();
  statusBarItem?.dispose();
  statusBarItem = undefined;
};

const getCommand = (counts: SourceTrackingCounts): string | undefined => {
  if (counts.remote > 0 && counts.local === 0 && counts.conflicts === 0) {
    return 'sf.metadata.retrieve.start';
  } else if (counts.local > 0 && counts.remote === 0 && counts.conflicts === 0) {
    return 'sf.metadata.deploy.start';
  } else if ((counts.remote > 0 && counts.local > 0) || counts.conflicts > 0) {
    return 'sf.metadata.source.tracking.details';
  }
  return undefined;
};
