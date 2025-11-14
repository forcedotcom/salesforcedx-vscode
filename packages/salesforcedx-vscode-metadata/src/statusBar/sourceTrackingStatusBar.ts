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
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { AllServicesLayer } from '../services/extensionProvider';
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

/** Status bar items that display source tracking changes */
export class SourceTrackingStatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private fileWatcherSubscription?: Fiber.RuntimeFiber<void, never>;
  private orgChangeSubscription?: Fiber.RuntimeFiber<void, never>;
  private lastDetails?: SourceTrackingDetails;

  private constructor(private readonly servicesApi: SalesforceVSCodeServicesApi) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 48);
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
            console.log('target org change');
            if (orgInfo && typeof orgInfo === 'object' && 'tracksSource' in orgInfo) {
              instance.handleOrgChange(orgInfo);
            }
          })
        )
      );
    }).pipe(Effect.forkDaemon, Effect.provide(AllServicesLayer));

    instance.orgChangeSubscription = await Effect.runPromise(subscriptionEffect);
    Effect.runSync(
      Effect.flatMap(servicesApi.services.ConnectionService, svc => svc.getConnection).pipe(
        Effect.provide(AllServicesLayer)
      )
    );

    return instance;
  };

  /** Handle org change events */
  private handleOrgChange = (orgInfo: { tracksSource?: boolean; orgId?: string }): void => {
    console.log('handleOrgChange', JSON.stringify(orgInfo, null, 2));
    if (!orgInfo.tracksSource || !orgInfo.orgId) {
      this.statusBarItem.hide();
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

    this.fileWatcherSubscription = Effect.runSync(subscriptionEffect);
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
        self.statusBarItem.hide();
        return;
      }

      yield* Effect.promise(() => tracking.reReadLocalTrackingCache());
      const status = yield* Effect.tryPromise(() => tracking.getStatus({ local: true, remote: true }));
      console.log('status from stl', JSON.stringify(status, null, 2));

      self.lastDetails = separateChanges(status);
      self.updateDisplay(calculateCounts(status));
    });

    await Effect.runPromise(Effect.provide(refreshEffect, AllServicesLayer));
  };

  /** Update the status bar display */
  private updateDisplay = (counts: SourceTrackingCounts): void => {
    if (!this.lastDetails || (counts.remote === 0 && counts.local === 0 && counts.conflicts === 0)) {
      this.statusBarItem.hide();
      return;
    }

    // Build combined text showing all present indicators
    this.statusBarItem.text = [
      counts.conflicts > 0 ? nls.localize('source_tracking_conflicts_text', counts.conflicts) : undefined,
      counts.remote > 0 ? nls.localize('source_tracking_remote_text', counts.remote) : undefined,
      counts.local > 0 ? nls.localize('source_tracking_local_text', counts.local) : undefined
    ]
      .filter(Boolean)
      .join(' ');

    // Build combined tooltip
    this.statusBarItem.tooltip = buildCombinedHoverText(this.lastDetails, counts);

    this.statusBarItem.command = getCommand(counts);

    // Apply styling
    if (counts.conflicts > 0) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.statusBarItem.color = undefined;
    } else if (counts.local > 0 && process.env.ESBUILD_PLATFORM === 'web') {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.statusBarItem.color = undefined;
    } else {
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.color = new vscode.ThemeColor('charts.blue');
    }

    this.statusBarItem.show();
  };

  /** Dispose of all resources */
  public dispose = (): void => {
    this.stopFileWatcherSubscription();
    this.statusBarItem.dispose();

    if (this.orgChangeSubscription) {
      void Effect.runPromise(Fiber.interrupt(this.orgChangeSubscription));
    }
  };
}

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
