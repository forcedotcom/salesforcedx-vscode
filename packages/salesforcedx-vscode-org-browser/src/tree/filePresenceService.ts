/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import type * as vscode from 'vscode';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { getIconPath, OrgBrowserTreeItem } from './orgBrowserNode';

/** Request to check if a metadata component exists locally */
export type FilePresenceRequest = {
  treeItem: OrgBrowserTreeItem;
  member: MetadataMember;
  /** Node ID this check belongs to (for batch tracking) */
  batchId: string;
  /** Called when the check completes with whether the file is present */
  onComplete: (filePresent: boolean) => void;
};

/** State for tracking a batch of file presence checks */
type BatchState = {
  nodeId: string;
  pending: number;
  resolve: () => void;
  reject: (reason?: unknown) => void;
  cancelled: boolean;
};

/** Callback for progress state changes */
export type ProgressCallback = (busy: boolean) => void;

/** Callback for batch completion */
export type BatchCompleteCallback = (batchId: string) => void;

export type FilePresenceService = {
  /** Queue a file presence check request */
  readonly check: (request: FilePresenceRequest) => Effect.Effect<void>;
  /** Start the background worker. Returns a disposable to stop it. */
  readonly start: () => vscode.Disposable;
  /** Start tracking a batch for a node; returns promise that resolves when batch completes */
  readonly startBatch: (nodeId: string, count: number) => Promise<void>;
  /** Cancel a specific node's batch */
  readonly cancelBatch: (nodeId: string) => void;
  /** Cancel all batches (for org change) */
  readonly cancelAllBatches: () => void;
  /** Returns true if any batch has pending work */
  readonly hasPendingBatches: () => boolean;
  /** Set callback to be notified when busy state changes */
  readonly setProgressCallback: (callback: ProgressCallback | undefined) => void;
  /** Set callback to be notified when a batch completes */
  readonly setBatchCompleteCallback: (callback: BatchCompleteCallback | undefined) => void;
};

export const FilePresenceService = Context.GenericTag<FilePresenceService>('FilePresenceService');

// Module-level state for batch tracking
const batches = new Map<string, BatchState>();

// Progress callback
// eslint-disable-next-line functional/no-let
let progressCallback: ProgressCallback | undefined;

// Batch complete callback
// eslint-disable-next-line functional/no-let
let batchCompleteCallback: BatchCompleteCallback | undefined;

// Track if we're currently showing busy state
// eslint-disable-next-line functional/no-let
let isBusy = false;

/** Notify progress callback of state change */
const notifyProgress = (busy: boolean): void => {
  if (isBusy !== busy) {
    isBusy = busy;
    progressCallback?.(busy);
  }
};

/** Returns true if any batch has pending work */
const hasPendingBatches = (): boolean =>
  Array.from(batches.values()).some(batch => !batch.cancelled && batch.pending > 0);

/** Start tracking a batch for a node */
const startBatch = (nodeId: string, count: number): Promise<void> => {
  // Cancel any existing batch for this node
  cancelBatch(nodeId);

  if (count === 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    batches.set(nodeId, {
      nodeId,
      pending: count,
      resolve,
      reject,
      cancelled: false
    });
    notifyProgress(true);
  });
};

/** Cancel a specific node's batch */
const cancelBatch = (nodeId: string): void => {
  const batch = batches.get(nodeId);
  if (batch && !batch.cancelled) {
    batch.cancelled = true;
    batch.reject(new Error('Batch cancelled'));
    batches.delete(nodeId);
    if (!hasPendingBatches()) {
      notifyProgress(false);
    }
  }
};

/** Cancel all batches (for org change) */
const cancelAllBatches = (): void => {
  batches.forEach(batch => {
    if (!batch.cancelled) {
      batch.cancelled = true;
      batch.reject(new Error('All batches cancelled'));
    }
  });
  batches.clear();
  notifyProgress(false);
};

/** Decrement batch count and resolve if complete */
const decrementBatch = (batchId: string): void => {
  const batch = batches.get(batchId);
  if (batch && !batch.cancelled) {
    batch.pending--;
    if (batch.pending <= 0) {
      batch.resolve();
      batches.delete(batchId);
      // Notify batch completion
      batchCompleteCallback?.(batchId);
      if (!hasPendingBatches()) {
        notifyProgress(false);
      }
    }
  }
};

/** Check if a batch is cancelled */
const isBatchCancelled = (batchId: string): boolean => {
  const batch = batches.get(batchId);
  return batch?.cancelled ?? true; // Treat missing batch as cancelled
};

/** Process a batch of file presence checks with a single SDR call */
// TypeScript can't infer that Effect.provide eliminates dependencies
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processBatch = (requests: FilePresenceRequest[]): any =>
  Effect.gen(function* () {
    if (requests.length === 0) {
      return;
    }

    const batchId = requests[0].batchId;
    if (isBatchCancelled(batchId)) {
      return;
    }

    // Get all members
    const members = requests.map(req => req.member);

    // Single SDR call for all members - provide dependencies
    const presenceMap = yield* getFilePresenceBatch(members).pipe(Effect.provide(AllServicesLayer));

    // Check again after async operation
    if (isBatchCancelled(batchId)) {
      return;
    }

    // Update all tree items with results
    requests.forEach(req => {
      const filePresent = presenceMap.get(req.member.fullName) ?? false;
      req.onComplete(filePresent);
    });
  }).pipe(
    Effect.catchAll(error => {
      console.error('Batch file presence check failed', error);
      return Effect.succeed(undefined);
    }),
    Effect.ensuring(
      Effect.sync(() => {
        // Decrement batch counter for each request
        requests.forEach(req => decrementBatch(req.batchId));
      })
    ),
    Effect.withSpan('processBatchFilePresence', {
      attributes: { count: requests.length, batchId: requests[0]?.batchId }
    })
  );

/** Get local file presence for multiple components of the same type (batch operation) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getFilePresenceBatch = (members: MetadataMember[]): any =>
  ExtensionProviderService.pipe(
    Effect.flatMap(svcProvider => svcProvider.getServicesApi),
    Effect.flatMap(api =>
      Effect.gen(function* () {
        if (members.length === 0) {
          return new Map<string, boolean>();
        }

        const metadataType = members[0].type;
        const [projectService, retrieveService] = yield* Effect.all(
          [api.services.ProjectService, api.services.MetadataRetrieveService],
          { concurrency: 'unbounded' }
        );

        const dirs = (yield* projectService.getSfProject).getPackageDirectories().map(directory => directory.fullPath);
        yield* Effect.annotateCurrentSpan({ packageDirectories: dirs });

        // Build component set from local files for this metadata type
        // Use wildcard to get all local components of this type
        const componentSet = yield* retrieveService.buildComponentSetFromSource(
          [{ type: metadataType, fullName: '*' }],
          dirs
        );
        yield* Effect.annotateCurrentSpan({ size: componentSet.size, metadataType });

        // Create lookup map of what's present locally
        const localComponents = Array.from(componentSet.getSourceComponents()).reduce((acc, component) => {
          acc.add(component.fullName);
          return acc;
        }, new Set<string>());

        // Map each remote component to its presence
        const presenceMap = members.reduce((acc, member) => {
          acc.set(member.fullName, localComponents.has(member.fullName));
          return acc;
        }, new Map<string, boolean>());

        return presenceMap;
      }).pipe(
        Effect.withSpan('getFilePresenceBatch', {
          attributes: { metadataType: members[0]?.type, count: members.length }
        })
      )
    ),
    Effect.provide(AllServicesLayer)
  );

/** Group requests by metadata type and batchId for batch processing */
const groupRequests = (requests: FilePresenceRequest[]): Map<string, FilePresenceRequest[]> =>
  requests.reduce((groups, req) => {
    const key = `${req.member.type}:${req.batchId}`;
    const group = groups.get(key) ?? [];
    group.push(req);
    groups.set(key, group);
    return groups;
  }, new Map<string, FilePresenceRequest[]>());

// Create queue at module level - shared across all service instances
// This ensures the same queue is used regardless of how many times the layer is instantiated
const filePresenceQueue: Queue.Queue<FilePresenceRequest> = Effect.runSync(Queue.unbounded<FilePresenceRequest>());

/** Live implementation of FilePresenceService */
export const FilePresenceServiceLive = Layer.sync(FilePresenceService, () => ({
  check: (request: FilePresenceRequest): Effect.Effect<void> => Queue.offer(filePresenceQueue, request),
  start: (): vscode.Disposable => {
    const streamEffect = Stream.fromQueue(filePresenceQueue).pipe(
      // Collect requests into chunks for batching
      Stream.groupedWithin(100, '50 millis'),
      // Group by metadata type and process each group as a batch
      Stream.mapEffect(
        chunk =>
          Effect.gen(function* () {
            const requests = Array.from(chunk);
            const groups = groupRequests(requests);
            // Process each group (same type + batchId) as a batch
            const groupArray = Array.from(groups.values());
            yield* Effect.all(
              groupArray.map(group => processBatch(group).pipe(Effect.provide(AllServicesLayer))),
              { concurrency: 5 }
            );
          }),
        { concurrency: 'unbounded' }
      ),
      Stream.runDrain
    );

    Effect.forkScoped(streamEffect.pipe(Effect.provide(AllServicesLayer)));

    return {
      dispose: (): void => {
        cancelAllBatches();
        // no interrupt needed; scope handles it
      }
    };
  },
  startBatch,
  cancelBatch,
  cancelAllBatches,
  hasPendingBatches,
  setProgressCallback: (callback: ProgressCallback | undefined): void => {
    progressCallback = callback;
  },
  setBatchCompleteCallback: (callback: BatchCompleteCallback | undefined): void => {
    batchCompleteCallback = callback;
  }
}));

/** Helper to queue a file presence check and update tree item icon */
export const queueFilePresenceCheck = (
  filePresenceService: FilePresenceService,
  treeItem: OrgBrowserTreeItem,
  member: MetadataMember,
  batchId: string,
  fireChangeEvent: (node?: OrgBrowserTreeItem) => void
): Effect.Effect<void> =>
  filePresenceService.check({
    treeItem,
    member,
    batchId,
    onComplete: (filePresent: boolean) => {
      // Update both the property and the icon
      treeItem.filePresent = filePresent;
      const iconPath = getIconPath(filePresent);
      if (iconPath !== treeItem.iconPath) {
        treeItem.iconPath = iconPath;
        fireChangeEvent();
      }
    }
  });
