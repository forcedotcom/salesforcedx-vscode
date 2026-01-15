/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
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
const processBatch = (requests: FilePresenceRequest[]): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (requests.length === 0) return;

    const batchId = requests[0].batchId;
    if (isBatchCancelled(batchId)) {
      return;
    }

    // Get all members
    const members = requests.map(req => req.member);

    // Single SDR call for all members
    const presenceMap = yield* getFilePresenceBatch(members);

    // Check again after async operation
    if (isBatchCancelled(batchId)) {
      return;
    }

    // Update all tree items with results
    for (const req of requests) {
      const filePresent = presenceMap.get(req.member.fullName) ?? false;
      req.onComplete(filePresent);
    }
  }).pipe(
    Effect.catchAll(error => {
      console.error('Batch file presence check failed', error);
      return Effect.succeed(undefined);
    }),
    Effect.ensuring(Effect.sync(() => {
      // Decrement batch counter for each request
      for (const req of requests) {
        decrementBatch(req.batchId);
      }
    })),
    Effect.withSpan('processBatchFilePresence', {
      attributes: { count: requests.length, batchId: requests[0]?.batchId }
    })
  );

/** Get local file presence for multiple components of the same type (batch operation) */
const getFilePresenceBatch = (members: MetadataMember[]): Effect.Effect<Map<string, boolean>, Error, never> =>
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
        const localComponents = new Set<string>();
        for (const component of componentSet.getSourceComponents()) {
          localComponents.add(component.fullName);
        }

        // Map each remote component to its presence
        const presenceMap = new Map<string, boolean>();
        for (const member of members) {
          presenceMap.set(member.fullName, localComponents.has(member.fullName));
        }

        return presenceMap;
      }).pipe(
        Effect.withSpan('getFilePresenceBatch', {
          attributes: { metadataType: members[0]?.type, count: members.length }
        })
      )
    ),
    Effect.provide(AllServicesLayer)
  ) as Effect.Effect<Map<string, boolean>, Error, never>;

// Create queue at module level - shared across all service instances
// This ensures the same queue is used regardless of how many times the layer is instantiated
const filePresenceQueue = Effect.runSync(Queue.unbounded<FilePresenceRequest>());

/** Group requests by metadata type and batchId for batch processing */
const groupRequests = (requests: FilePresenceRequest[]): Map<string, FilePresenceRequest[]> => {
  const groups = new Map<string, FilePresenceRequest[]>();
  for (const req of requests) {
    const key = `${req.member.type}:${req.batchId}`;
    const group = groups.get(key) ?? [];
    group.push(req);
    groups.set(key, group);
  }
  return groups;
};

/** Live implementation of FilePresenceService */
export const FilePresenceServiceLive = Layer.sync(FilePresenceService, () => ({
  check: (request: FilePresenceRequest): Effect.Effect<void> => Queue.offer(filePresenceQueue, request),
  start: (): vscode.Disposable => {
    const fiber = Effect.runFork(
      Stream.fromQueue(filePresenceQueue).pipe(
        // Collect requests into chunks for batching
        Stream.groupedWithin(100, '50 millis'),
        // Group by metadata type and process each group as a batch
        Stream.mapEffect(
          chunk =>
            Effect.gen(function* () {
              const requests = Array.from(chunk);
              const groups = groupRequests(requests);
              // Process each group (same type + batchId) as a batch
              yield* Effect.all(
                Array.from(groups.values()).map(group => processBatch(group)),
                { concurrency: 5 }
              );
            }),
          { concurrency: 'unbounded' }
        ),
        Stream.runDrain
      )
    );
    return {
      dispose: (): void => {
        cancelAllBatches();
        Effect.runSync(Fiber.interrupt(fiber));
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
