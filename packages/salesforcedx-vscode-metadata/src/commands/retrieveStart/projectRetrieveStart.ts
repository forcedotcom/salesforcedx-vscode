/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { AllServicesLayer, ExtensionProviderService } from '../../services/extensionProvider';
import { retrieveComponentSet } from '../../shared/retrieve/retrieveComponentSet';

// Type guard function to ensure result has expected shape
const isApplyResult = (
  value: unknown
): value is { componentSetFromNonDeletes: ComponentSet; fileResponsesFromDelete: unknown[] } =>
  value !== null &&
  typeof value === 'object' &&
  'componentSetFromNonDeletes' in value &&
  'fileResponsesFromDelete' in value;

const projectRetrieveStartEffect = (ignoreConflicts: boolean) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ ignoreConflicts });

    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const [sourceTrackingService, channelService] = yield* Effect.all(
      [api.services.SourceTrackingService, api.services.ChannelService],
      { concurrency: 'unbounded' }
    );

    const tracking = yield* sourceTrackingService.getSourceTrackingOrThrow({ ignoreConflicts });
    yield* Effect.all(
      [
        Effect.promise(() => tracking.reReadLocalTrackingCache()),
        Effect.promise(() => tracking.reReadRemoteTracking())
      ],
      { concurrency: 'unbounded' }
    );

    const result = yield* Effect.tryPromise({
      try: () => tracking.maybeApplyRemoteDeletesToLocal(true),
      catch: e =>
        new Error(nls.localize('error_source_tracking_components_failed', e instanceof Error ? e.message : String(e)))
    }).pipe(Effect.withSpan('maybeApplyRemoteDeletesToLocal'));

    if (!isApplyResult(result)) {
      return yield* Effect.fail(
        new Error(nls.localize('error_source_tracking_components_failed', 'Invalid result from source tracking'))
      );
    }

    const componentSet = result.componentSetFromNonDeletes;

    const changeCount = componentSet.size;
    yield* channelService.appendToChannel(
      `Found ${changeCount} remote change${changeCount === 1 ? '' : 's'} to retrieve`
    );

    if (componentSet.size === 0) {
      yield* channelService.appendToChannel('No remote changes to retrieve');
      return;
    }

    yield* retrieveComponentSet({ componentSet });
  }).pipe(
    Effect.withSpan('projectRetrieveStart', { attributes: { ignoreConflicts } }),
    Effect.provide(AllServicesLayer)
  );

/** Retrieve remote changes from the default org */
export const projectRetrieveStart = async (ignoreConflicts = false): Promise<void> =>
  Effect.runPromise(
    projectRetrieveStartEffect(ignoreConflicts).pipe(
      Effect.catchAll(error =>
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          const channelService = yield* api.services.ChannelService;
          const errorMessage = error instanceof Error ? error.message : String(error);
          yield* channelService.appendToChannel(`Retrieve failed: ${errorMessage}`);
          yield* Effect.promise(() => vscode.window.showErrorMessage(errorMessage));
        }).pipe(Effect.provide(AllServicesLayer), Effect.as(undefined))
      )
    )
  );
