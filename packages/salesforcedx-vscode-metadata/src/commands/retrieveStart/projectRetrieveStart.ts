/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { retrieveComponentSet } from '../../shared/retrieve/retrieveComponentSet';

class SourceTrackingComponentsFailedError extends Schema.TaggedError<SourceTrackingComponentsFailedError>()(
  'SourceTrackingComponentsFailedError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

// Type guard function to ensure result has expected shape
const isApplyResult = (
  value: unknown
): value is { componentSetFromNonDeletes: ComponentSet; fileResponsesFromDelete: unknown[] } =>
  value !== null &&
  typeof value === 'object' &&
  'componentSetFromNonDeletes' in value &&
  'fileResponsesFromDelete' in value;

/** Retrieve remote changes from the default org */
export const projectRetrieveStartCommand = (ignoreConflicts: boolean) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ ignoreConflicts });

    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const [sourceTrackingService, channelService, componentSetService] = yield* Effect.all(
      [api.services.SourceTrackingService, api.services.ChannelService, api.services.ComponentSetService],
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

    if (!ignoreConflicts) {
      // check conflicts up here to avoid deletes (since the normal conflict check is in the retrieve service)
      yield* sourceTrackingService.checkConflicts(tracking);
    }

    const result = yield* Effect.tryPromise({
      try: () => tracking.maybeApplyRemoteDeletesToLocal(true),
      catch: e =>
        new SourceTrackingComponentsFailedError({
          message: nls.localize('error_source_tracking_components_failed', e instanceof Error ? e.message : String(e)),
          cause: e
        })
    }).pipe(Effect.withSpan('maybeApplyRemoteDeletesToLocal'));

    if (!isApplyResult(result)) {
      return yield* Effect.fail(
        new SourceTrackingComponentsFailedError({
          message: nls.localize('error_source_tracking_components_failed', 'Invalid result from source tracking')
        })
      );
    }

    const componentSet = result.componentSetFromNonDeletes;
    const nonEmpty = yield* componentSetService.ensureNonEmptyComponentSet(componentSet);
    yield* channelService.appendToChannel(
      `Found ${nonEmpty.size} remote change${nonEmpty.size === 1 ? '' : 's'} to retrieve`
    );
    yield* retrieveComponentSet({ componentSet: nonEmpty, ignoreConflicts: true });
  }).pipe(
    Effect.catchTag('EmptyComponentSetError', () =>
      Effect.sync(() => {
        void vscode.window.showInformationMessage(nls.localize('no_remote_changes_to_retrieve'));
      })
    )
  );
