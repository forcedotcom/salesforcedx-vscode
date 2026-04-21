/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { ForceIgnore } from '@salesforce/source-deploy-retrieve';
import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
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
      return;
    }

    const status = yield* sourceTrackingService.getStatus({ local: true, remote: true });
    updateDisplay(statusBarItem)(dedupeStatus(status));
  },
  Effect.catchAll(() => Effect.void) // ignore errors in refresh
);

/** Show a transient refreshing state while a metadata operation is in flight */
const showRefreshingState = (statusBarItem: vscode.StatusBarItem): void => {
  statusBarItem.text = '$(sync~spin) Refreshing';
  statusBarItem.tooltip = new vscode.MarkdownString(nls.localize('source_tracking_status_bar_refreshing'));
  statusBarItem.command = undefined;
  statusBarItem.backgroundColor = undefined;
  statusBarItem.show();
};

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


/** Helper to read polling interval config */
const getPollingIntervalSeconds = (): number =>
  vscode.workspace
    .getConfiguration('salesforcedx-vscode-metadata')
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

  const targetOrgRef = yield* api.services.TargetOrgRef();
  const activeOpRef = yield* api.services.ActiveMetadataOperationRef();

  // Reusable stream transformer: suppress any stream while a metadata operation is in flight
  const suppressDuringOperation = Stream.filterEffect(() =>
    SubscriptionRef.get(activeOpRef).pipe(Effect.andThen(count => count === 0))
  );

  // Setup dynamic polling interval that responds to config changes
  const pollIntervalRef = yield* SubscriptionRef.make(Duration.seconds(getPollingIntervalSeconds()));

  // Watch setting changes to update poll frequency dynamically
  yield* Effect.fork(
    Stream.async<void>(emit => {
      const disposable = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds')) {
          void emit.single(undefined);
        }
      });
      return Effect.sync(() => disposable.dispose());
    }).pipe(
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
    suppressDuringOperation,
    Stream.as('orgChange')
  );

  // Dynamic poll stream that restarts when interval changes
  const dynamicPollStream = Stream.concat(
    Stream.make(yield* SubscriptionRef.get(pollIntervalRef)),
    pollIntervalRef.changes
  ).pipe(
    Stream.filter(d => Duration.greaterThan(d, Duration.zero)), // 0 means don't poll
    Stream.flatMap(
      interval => Stream.fromSchedule(Schedule.fixed(interval)).pipe(Stream.filter(() => vscode.window.state.active)),
      { switch: true } // Restart schedule when interval changes
    )
  );

  // File watcher scoped to package directories, filtered by .forceignore.
  // Rebuilds watchers when org changes, sfdx-project.json changes, or .forceignore changes.
  const fileChangeStream = Stream.concat(
    Stream.fromEffect(SubscriptionRef.get(targetOrgRef)),
    targetOrgRef.changes
  ).pipe(
    Stream.flatMap(orgInfo => {
      if (!orgInfo.tracksSource || !orgInfo.orgId) {
        return Stream.empty;
      }

      // Signal to rebuild watchers when project config or .forceignore changes
      const rebuildSignal = Stream.concat(
        Stream.void,
        Stream.async<void>(emit => {
          const projectWatcher = vscode.workspace.createFileSystemWatcher('**/sfdx-project.json');
          const ignoreWatcher = vscode.workspace.createFileSystemWatcher('**/.forceignore');
          const fire = () => { void emit.single(undefined); };
          projectWatcher.onDidChange(fire);
          projectWatcher.onDidCreate(fire);
          ignoreWatcher.onDidChange(fire);
          ignoreWatcher.onDidCreate(fire);
          ignoreWatcher.onDidDelete(fire);
          return Effect.sync(() => { projectWatcher.dispose(); ignoreWatcher.dispose(); });
        })
      );

      const scopedWatcherStream = rebuildSignal.pipe(
        Stream.flatMap(() =>
          Stream.fromEffect(
            Effect.gen(function* () {
              const project = yield* api.services.ProjectService.getSfProject();
              return project.getPackageDirectories();
            }).pipe(Effect.catchAll(() => Effect.succeed([])))
          ).pipe(
            Stream.flatMap(packageDirs => {
              if (packageDirs.length === 0) return Stream.empty;

              return Stream.async<void>(emit => {
                const forceIgnore = ForceIgnore.findAndCreate(packageDirs[0].fullPath);
                const watchers = packageDirs.map(dir =>
                  vscode.workspace.createFileSystemWatcher(
                    new vscode.RelativePattern(URI.file(dir.fullPath), '**/*')
                  )
                );

                // eslint-disable-next-line functional/no-let
                let timer: ReturnType<typeof setTimeout> | undefined;
                const fire = (uri: URI) => {
                  if (forceIgnore.denies(uri.fsPath)) return;
                  if (timer !== undefined) clearTimeout(timer);
                  timer = setTimeout(() => { timer = undefined; void emit.single(undefined); }, 500);
                };

                watchers.forEach(watcher => {
                  watcher.onDidCreate(fire);
                  watcher.onDidChange(fire);
                  watcher.onDidDelete(fire);
                });

                return Effect.sync(() => {
                  clearTimeout(timer);
                  watchers.forEach(watcher => watcher.dispose());
                });
              });
            })
          ),
          { switch: true }
        )
      );

      return Stream.merge(scopedWatcherStream, dynamicPollStream);
    }, { switch: true }),
    Stream.debounce(Duration.millis(500)),
    suppressDuringOperation
  );

  // Show spinner while in-flight; emit 'operationComplete' when it drains to 0
  const operationCompleteStream = activeOpRef.changes.pipe(
    Stream.tap(count => (count > 0 ? Effect.sync(() => showRefreshingState(statusBarItem)) : Effect.void)),
    Stream.filter(count => count === 0)
  );

  yield* Effect.fork(
    Stream.mergeAll({ concurrency: 'unbounded' })([orgChangeStream, fileChangeStream, operationCompleteStream]).pipe(
      Stream.debounce(Duration.millis(500)),
      Stream.flatMap(() => Stream.fromEffect(refresh(statusBarItem)), { switch: true }),
      Stream.runDrain
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
