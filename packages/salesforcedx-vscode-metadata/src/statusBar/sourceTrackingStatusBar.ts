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
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { AllServicesLayer } from '../services/extensionProvider';
import { buildConflictsHoverText, buildLocalHoverText, buildRemoteHoverText } from './hover';

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

/** Status bar item that displays source tracking changes */
export class SourceTrackingStatusBar implements vscode.Disposable {
  private localStatusBarItem: vscode.StatusBarItem;
  private remoteStatusBarItem: vscode.StatusBarItem;
  private conflictsStatusBarItem: vscode.StatusBarItem;
  private fileWatcherSubscription?: Fiber.RuntimeFiber<void, never>;
  private orgChangeSubscription?: Fiber.RuntimeFiber<void, never>;
  private lastDetails?: SourceTrackingDetails;

  private constructor(private readonly servicesApi: SalesforceVSCodeServicesApi) {
    // Order: remote (left) -> local (right) to match Git's convention (origin/main vs main)
    this.remoteStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 48.5);
    // Remote command will be added when pull command is implemented

    this.localStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 48.4);
    this.localStatusBarItem.command = 'sf.project.deploy.start';

    this.conflictsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 48.3);
  }

  /** Create and initialize a new source tracking status bar */
  public static create = async (servicesApi: SalesforceVSCodeServicesApi): Promise<SourceTrackingStatusBar> => {
    const instance = new SourceTrackingStatusBar(servicesApi);

    // Subscribe to org changes
    const subscriptionEffect = Effect.gen(function* () {
      const targetOrgRef = servicesApi.services.TargetOrgRef;

      // Get initial org state
      const initialOrg = yield* SubscriptionRef.get(targetOrgRef);
      if (initialOrg && typeof initialOrg === 'object' && 'tracksSource' in initialOrg) {
        instance.handleOrgChange(initialOrg);
      }

      // Subscribe to changes
      yield* targetOrgRef.changes.pipe(
        Stream.runForEach(orgInfo =>
          Effect.sync(() => {
            if (orgInfo && typeof orgInfo === 'object' && 'tracksSource' in orgInfo) {
              instance.handleOrgChange(orgInfo);
            }
          })
        )
      );
      // Proactively populate orgRef by attempting to get a connection in the background
      // This will trigger the subscription if a target-org is configured
      yield* Effect.flatMap(servicesApi.services.ConnectionService, svc => svc.getConnection).pipe(
        Effect.catchAll(() => Effect.void)
      );
    }).pipe(Effect.forkDaemon, Effect.provide(AllServicesLayer));

    instance.orgChangeSubscription = await Effect.runPromise(subscriptionEffect);

    return instance;
  };

  /** Handle org change events */
  private handleOrgChange = (orgInfo: { tracksSource?: boolean; orgId?: string }): void => {
    if (!orgInfo.tracksSource || !orgInfo.orgId) {
      this.hideAll();
      this.stopFileWatcherSubscription();
      return;
    }

    this.startFileWatcherSubscription();
    void this.refresh();
  };

  /** Subscribe to the centralized file watcher PubSub with debouncing */
  private startFileWatcherSubscription = (): void => {
    this.stopFileWatcherSubscription();

    const self = this;
    const subscriptionEffect = Effect.scoped(
      Effect.gen(function* () {
        const fileWatcherService = yield* self.servicesApi.services.FileWatcherService;
        const dequeue = yield* PubSub.subscribe(fileWatcherService.pubsub);

        // Subscribe to file changes with debouncing - we don't care which files changed, just that something changed
        yield* Stream.fromQueue(dequeue).pipe(
          // TODO: maybe filter out some changes by type or uri
          Stream.debounce(Duration.millis(500)),
          Stream.runForEach(() => Effect.promise(() => self.refresh()))
        );
      })
    ).pipe(Effect.provide(this.servicesApi.services.FileWatcherService.Default), Effect.forkDaemon);

    void Effect.runPromise(subscriptionEffect).then(fiber => {
      this.fileWatcherSubscription = fiber;
    });
  };

  /** Stop the file watcher subscription */
  private stopFileWatcherSubscription = (): void => {
    if (this.fileWatcherSubscription) {
      void Effect.runPromise(Fiber.interrupt(this.fileWatcherSubscription));
      this.fileWatcherSubscription = undefined;
    }
  };

  /** Refresh the status bar display */
  private refresh = async (): Promise<void> => {
    const self = this;
    const refreshEffect = Effect.gen(function* () {
      console.log('refresh source tracking status bar');
      const tracking = yield* Effect.flatMap(self.servicesApi.services.SourceTrackingService, svc =>
        svc.getSourceTracking()
      );

      if (!tracking) {
        self.hideAll();
        return;
      }

      yield* Effect.promise(() => tracking.reReadLocalTrackingCache());
      const status = yield* Effect.tryPromise(() => tracking.getStatus({ local: true, remote: true }));
      console.log('status', JSON.stringify(status, null, 2));

      self.lastDetails = separateChanges(status);
      self.updateDisplay(calculateCounts(status));
    }).pipe(Effect.catchAll(() => Effect.sync(() => self.hideAll())));

    await Effect.runPromise(
      Effect.provide(
        refreshEffect,
        Layer.mergeAll(
          this.servicesApi.services.SourceTrackingService.Default,
          this.servicesApi.services.ConnectionService.Default,
          this.servicesApi.services.ProjectService.Default,
          this.servicesApi.services.WorkspaceService.Default,
          this.servicesApi.services.ConfigService.Default,
          this.servicesApi.services.MetadataRegistryService.Default,
          this.servicesApi.services.SettingsService.Default,
          this.servicesApi.services.SdkLayer
        )
      )
    );
  };

  /** Update the status bar display */
  private updateDisplay = (counts: SourceTrackingCounts): void => {
    if (!this.lastDetails) {
      this.hideAll();
      return;
    }

    // Update remote changes item (leftmost to match Git convention)
    if (counts.remote > 0) {
      this.remoteStatusBarItem.text = nls.localize('source_tracking_remote_text', counts.remote);
      this.remoteStatusBarItem.tooltip = buildRemoteHoverText(this.lastDetails.remoteChanges);
      this.remoteStatusBarItem.backgroundColor = undefined;
      this.remoteStatusBarItem.color = new vscode.ThemeColor('charts.blue');
      this.remoteStatusBarItem.show();
    } else {
      this.remoteStatusBarItem.hide();
    }

    // Update local changes item
    if (counts.local > 0) {
      this.localStatusBarItem.text = nls.localize('source_tracking_local_text', counts.local);
      this.localStatusBarItem.tooltip = buildLocalHoverText(this.lastDetails.localChanges);
      this.localStatusBarItem.backgroundColor =
        process.env.ESBUILD_PLATFORM === 'web' ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
      this.localStatusBarItem.color = new vscode.ThemeColor('charts.blue');
      this.localStatusBarItem.show();
    } else {
      this.localStatusBarItem.hide();
    }

    // Update conflicts item
    if (counts.conflicts > 0) {
      this.conflictsStatusBarItem.text = nls.localize('source_tracking_conflicts_text', counts.conflicts);
      this.conflictsStatusBarItem.tooltip = buildConflictsHoverText(this.lastDetails.conflicts);
      this.conflictsStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.conflictsStatusBarItem.show();
    } else {
      this.conflictsStatusBarItem.hide();
    }
  };

  /** Hide all status bar items */
  private hideAll = (): void => {
    this.localStatusBarItem.hide();
    this.remoteStatusBarItem.hide();
    this.conflictsStatusBarItem.hide();
  };

  /** Dispose of all resources */
  public dispose = (): void => {
    this.stopFileWatcherSubscription();
    this.localStatusBarItem.dispose();
    this.remoteStatusBarItem.dispose();
    this.conflictsStatusBarItem.dispose();

    if (this.orgChangeSubscription) {
      void Effect.runPromise(Fiber.interrupt(this.orgChangeSubscription));
    }
  };
}
