/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
import { getDeployOnSaveEnabled, getIgnoreConflicts } from '../settings/deployOnSaveSettings';
import { AllServicesLayer, ExtensionProviderService } from './extensionProvider';

const ENQUEUE_DELAY_MS = 1000;

/** File filtering - exclude files that shouldn't be deployed */
export const shouldDeploy = Effect.fn('deployOnSave:shouldDeploy')(function* (uri: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const workspaceInfo = yield* (yield* api.services.WorkspaceService).getWorkspaceInfoOrThrow;

  if (!uri.fsPath.startsWith(workspaceInfo.fsPath)) return false;
  const basename = uri.fsPath.split(/[/\\]/).pop() ?? '';

  // Exclude dot files
  if (basename.startsWith('.')) return false;

  // Exclude .soql files
  if (basename.endsWith('.soql')) return false;

  // Exclude anonymous apex files
  if (basename.endsWith('.apex')) return false;

  return true;
});

/** Deploy queued files using MetadataDeployService */

const deployQueuedFiles = Effect.fn('deployOnSave:deployQueuedFiles')(function* (paths: Set<string>) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const deployService = yield* api.services.MetadataDeployService;

  const ignoreConflicts = getIgnoreConflicts();
  yield* channelService.appendToChannel(`Deploy on save triggered (ignoreConflicts: ${ignoreConflicts})`);

  const componentSet = yield* deployService.getComponentSetFromPaths(paths);

  if (componentSet.size === 0) {
    return yield* channelService.appendToChannel('Deploy on save: No changes to deploy');
  }

  yield* channelService.appendToChannel(
    `Deploying ${componentSet.size} component${componentSet.size === 1 ? '' : 's'}...`
  );

  const result = yield* deployService.deploy(componentSet);

  // Handle cancellation
  if (typeof result === 'string') {
    return yield* channelService.appendToChannel('Deploy on save cancelled');
  }

  const failedCount = result.getFileResponses().filter(r => String(r.state) === 'Failed').length;
  const successCount = result.getFileResponses().length - failedCount;

  yield* channelService.appendToChannel(
    `Deploy on save complete: ${successCount} succeeded${failedCount > 0 ? `, ${failedCount} failed` : ''}`
  );
});

const isInPackageDirectories = Effect.fn('deployOnSave:isInPackageDirectories')(function* (uri: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const packageDirs = (yield* (yield* api.services.ProjectService).getSfProject).getPackageDirectories();
  return packageDirs.some(dir => uri.fsPath.startsWith(dir.fullPath));
});

/** Handle errors from deploy on save */
const handleDeployError = (error: unknown) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for specific error types
    if (errorMessage.includes('NoTargetOrgSet') || errorMessage.includes('No default org')) {
      yield* channelService.appendToChannel(nls.localize('deploy_on_save_error_no_target_org'));
      void vscode.window.showErrorMessage(nls.localize('deploy_on_save_error_no_target_org'));
    } else {
      const msg = nls.localize('deploy_on_save_error_generic', errorMessage);
      yield* channelService.appendToChannel(msg);
      void vscode.window.showErrorMessage(msg);
    }
  }).pipe(
    Effect.provide(AllServicesLayer),
    Effect.catchAll(() => Effect.void)
  );

/** Create and start the deploy on save service */
export const createDeployOnSaveService = () =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;

    // Create a sliding queue to collect saved URIs
    const saveQueue = yield* Queue.unbounded<URI>();

    // Start the stream processor that batches and deploys
    yield* Stream.fromQueue(saveQueue).pipe(
      Stream.tap(uri => channelService.appendToChannel(`Deploy on save service received URI: ${uri.fsPath}`)),
      Stream.filterEffect(() => getDeployOnSaveEnabled()),
      Stream.filterEffect(shouldDeploy),
      Stream.filterEffect(isInPackageDirectories),
      Stream.tap(uri =>
        channelService.appendToChannel(`Passed shouldDeploy and isInPackageDirectories: ${uri.fsPath}`)
      ),
      Stream.groupedWithin(10_000, Duration.millis(ENQUEUE_DELAY_MS)),
      Stream.runForEach(chunk =>
        deployQueuedFiles(new Set(Chunk.toReadonlyArray(chunk).map(uri => uri.path))).pipe(
          Effect.catchAll(handleDeployError)
        )
      ),
      Effect.provide(AllServicesLayer),
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
  }).pipe(Effect.provide(AllServicesLayer));
