/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { detectConflictsFromTracking } from '../conflict/conflictDetection';
import { getConflictStateRef } from '../conflict/conflictTreeProvider';
import { conflictTreeProvider, ensureConflictView } from '../conflict/conflictView';
import { nls } from '../messages';
import { getDeployOnSaveEnabled, getIgnoreConflicts } from '../settings/deployOnSaveSettings';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';

const ENQUEUE_DELAY_MS = 1000;

/** File filtering - exclude files that shouldn't be deployed */
export const shouldDeploy = Effect.fn('deployOnSave:shouldDeploy')(function* (uri: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [workspaceInfo, fsService] = yield* Effect.all([
    api.services.WorkspaceService.getWorkspaceInfoOrThrow(),
    api.services.FsService
  ], { concurrency: 'unbounded' });
  const [uriPath, workspacePath] = yield* Effect.all([
    fsService.uriToPath(uri),
    fsService.uriToPath(workspaceInfo.uri)
  ], { concurrency: 'unbounded' });
  if (!uriPath.startsWith(workspacePath)) return false;
  const basename = uriPath.split(/[/\\]/).pop() ?? '';

  // Exclude dot files
  if (basename.startsWith('.')) return false;

  // Exclude .soql files
  if (basename.endsWith('.soql')) return false;

  // Exclude anonymous apex files
  if (basename.endsWith('.apex')) return false;

  return true;
});

/** Deploy queued files using MetadataDeployService */

const deployQueuedFiles = Effect.fn('deployOnSave:deployQueuedFiles')(function* (uris: readonly URI[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [channelService, componentSetService, sourceTrackingService] = yield* Effect.all(
    [api.services.ChannelService, api.services.ComponentSetService, api.services.SourceTrackingService],
    { concurrency: 'unbounded' }
  );

  const ignoreConflicts = getIgnoreConflicts();
  yield* channelService.appendToChannel(`Deploy on save triggered (ignoreConflicts: ${ignoreConflicts})`);

  const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
    yield* componentSetService.getComponentSetFromUris(uris)
  );

  if (!ignoreConflicts) {
    const tracking = yield* sourceTrackingService.getSourceTracking({ ignoreConflicts: false });
    if (tracking) {
      yield* Effect.all(
        [
          Effect.promise(() => tracking.reReadLocalTrackingCache()),
          Effect.promise(() => tracking.reReadRemoteTracking())
        ],
        { concurrency: 'unbounded' }
      );
      const conflicts = yield* Effect.tryPromise(() => tracking.getConflicts()).pipe(
        Effect.withSpan('STL.GetConflicts')
      );
      const deployedMembers = new Set(
        componentSet.getSourceComponents().toArray().map(c => `${c.type.name}:${c.fullName}`)
      );
      const relevant = conflicts.filter(c => c.type && c.name && deployedMembers.has(`${c.type}:${c.name}`));
      if (relevant.length > 0) {
        return yield* handleDeployConflict(componentSet);
      }
    }
  }

  return yield* deployComponentSet({ componentSet });
});

/** Handle deploy conflicts: populate conflict view scoped to the deployed component set */
const handleDeployConflict = Effect.fn('deployOnSave:handleDeployConflict')(function* (
  componentSet?: ComponentSet
) {
  yield* ensureConflictView();
  const pairs = yield* detectConflictsFromTracking(componentSet);
  const mode: 'conflicts' | 'diffs' = 'conflicts';
  yield* SubscriptionRef.update(getConflictStateRef(), () => ({
    title: `${pairs.length} file difference${pairs.length === 1 ? '' : 's'}`,
    mode,
    entries: pairs,
    emptyLabel: nls.localize('conflict_detect_no_conflicts')
  }));
  conflictTreeProvider.fireChange();
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const msg = nls.localize('deploy_source_conflicts_detected', [...pairs].map(p => p.fileName).join(', '));
  yield* channelService.appendToChannel(msg);
  yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
  void vscode.window.showErrorMessage(msg);
});

/** Handle residual errors from deploy on save */
const handleDeployError = Effect.fn('deployOnSave:handleDeployError')(function* (err: unknown) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const errorMessage = err instanceof Error ? err.message : JSON.stringify(err, null, 2);

  if (errorMessage.includes('NoTargetOrgSet') || errorMessage.includes('No default org')) {
    yield* channelService.appendToChannel(nls.localize('deploy_on_save_error_no_target_org'));
    void vscode.window.showErrorMessage(nls.localize('deploy_on_save_error_no_target_org'));
  } else {
    const msg = nls.localize('deploy_on_save_error_generic', errorMessage);
    yield* channelService.appendToChannel(msg);
    void vscode.window.showErrorMessage(msg);
  }
});

/** Create and start the deploy on save service */
export const createDeployOnSaveService = Effect.fn('deployOnSave:createDeployOnSaveService')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;

  // Create a sliding queue to collect saved URIs
  const saveQueue = yield* Queue.unbounded<URI>();

  // Start the stream processor that batches and deploys
  yield* Stream.fromQueue(saveQueue).pipe(
    Stream.filterEffect(() => getDeployOnSaveEnabled()),
    Stream.tap(uri =>
      api.services.FsService.uriToPath(uri).pipe(
        Effect.flatMap(path => channelService.appendToChannel(`Deploy on save service received URI: ${path}`))
      )
    ),
    Stream.filterEffect(shouldDeploy),
    Stream.filterEffect(api.services.ProjectService.isInPackageDirectories),
    Stream.tap(uri =>
      api.services.FsService.uriToPath(uri).pipe(
        Effect.flatMap(path => channelService.appendToChannel(`Passed shouldDeploy and isInPackageDirectories: ${path}`))
      )
    ),
    Stream.groupedWithin(10_000, Duration.millis(ENQUEUE_DELAY_MS)),
    Stream.runForEach(chunk =>
      deployQueuedFiles(Chunk.toReadonlyArray(chunk)).pipe(
        Effect.catchAll(error => handleDeployError(error)),
        Effect.catchAll(() => Effect.void)
      )
    ),
    Effect.forkDaemon
  );

  // Register the save handler
  const disposable = vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
    await Effect.runPromise(Queue.offer(saveQueue, URI.parse(document.uri.toString())));
  });

  yield* channelService.appendToChannel('Deploy on save service initialized');

  // Add cleanup on scope close
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      disposable.dispose();
    }).pipe(Effect.andThen(channelService.appendToChannel('Deploy on save service disposed')))
  );

  return disposable;
});
