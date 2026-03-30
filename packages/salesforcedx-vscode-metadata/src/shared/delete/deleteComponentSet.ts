/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { NonEmptyComponentSet } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { formatDeployOutput } from '../deploy/formatDeployOutput';
import { DeleteSourceFailedError } from './deleteErrors';

/** Delete a ComponentSet, handling conflict checking, cancellation, and local file deletion */
export const deleteComponentSet = Effect.fn('deleteComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
}) {
  const { componentSet } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [channelService, componentSetService, sourceTrackingService] = yield* Effect.all(
    [api.services.ChannelService, api.services.ComponentSetService, api.services.SourceTrackingService],
    { concurrency: 'unbounded' }
  );

  // Check for conflicts if source-tracked
  if (yield* sourceTrackingService.hasTracking()) {
    yield* sourceTrackingService.checkConflicts();
  }

  // Mark components for deletion
  const deleteSet = yield* api.services.MetadataDeleteService.markComponentsForDeletion(componentSet);

  yield* channelService.appendToChannel(`Deleting ${deleteSet.size} component${deleteSet.size === 1 ? '' : 's'}...`);

  const result = yield* api.services.MetadataDeployService.deploy(deleteSet);

  // Handle cancellation
  if (typeof result === 'string') {
    return yield* channelService.appendToChannel('Delete cancelled by user');
  }

  // Check if deploy failed
  // I'd love to use the value but because status is a <expletive> enum (instead of a string union) you'd have to import all of SDR to get it
  // or export is as part of the services API
  if (result.response?.status.toString() !== 'Succeeded') {
    return yield* new DeleteSourceFailedError({
      cause: new Error(nls.localize('delete_source_operation_failed')),
      result
    });
  }

  // Delete local files after successful deploy
  yield* api.services.MetadataDeleteService.deleteLocalFiles(componentSet, result);
  yield* channelService.appendToChannel(yield* formatDeployOutput(result));

  const { isSDRFailure } = componentSetService;
  if (result.getFileResponses().some(isSDRFailure)) {
    yield* Effect.sync(() => {
      void vscode.window.showErrorMessage(nls.localize('delete_completed_with_errors_message'));
    });
  }
});
