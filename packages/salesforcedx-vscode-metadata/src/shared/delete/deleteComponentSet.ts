/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type { NonEmptyComponentSet } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { ExtensionProviderService } from '../../services/extensionProvider';
import { formatDeployOutput } from '../deploy/formatDeployOutput';
import { DeleteSourceFailedError } from './deleteErrors';

/** Check for conflicts if source-tracked */
const maybeCheckConflicts = Effect.fn('deleteComponentSet:checkConflicts')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const sourceTrackingService = yield* api.services.SourceTrackingService;
  const tracking = yield* sourceTrackingService.getSourceTracking();

  if (!tracking) {
    return; // Not source-tracked, no conflict check needed
  }

  // Use service method to check conflicts (displays in channel and returns typed error)
  yield* sourceTrackingService.checkConflicts(tracking);
});

/** Delete a ComponentSet, handling conflict checking, cancellation, and local file deletion */
export const deleteComponentSet = Effect.fn('deleteComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
}) {
  const { componentSet } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [channelService, deployService, deleteService, componentSetService] = yield* Effect.all(
    [
      api.services.ChannelService,
      api.services.MetadataDeployService,
      api.services.MetadataDeleteService,
      api.services.ComponentSetService
    ],
    { concurrency: 'unbounded' }
  );

  // Check for conflicts if source-tracked
  // TODO: we should only care if the conflicts are on the components we're deleting, not all components in the project
  yield* maybeCheckConflicts();

  // Mark components for deletion
  const deleteSet = yield* deleteService.markComponentsForDeletion(componentSet);

  yield* channelService.appendToChannel(`Deleting ${deleteSet.size} component${deleteSet.size === 1 ? '' : 's'}...`);

  const result = yield* deployService.deploy(deleteSet);

  // Handle cancellation
  if (typeof result === 'string') {
    return yield* channelService.appendToChannel('Delete cancelled by user');
  }

  // Check if deploy failed
  // I'd love to use the value but because status is a <expletive> enum (instead of a string union) you'd have to import all of SDR to get it
  // or export is as part of the services API
  if (result.response?.status.toString() !== 'Succeeded') {
    yield* channelService.appendToChannel(JSON.stringify(result, null, 2));
    yield* channelService.appendToChannel(yield* formatDeployOutput(result));
    return yield* Effect.fail(
      new DeleteSourceFailedError({
        cause: new Error(nls.localize('delete_source_operation_failed'))
      })
    );
  }

  // Delete local files after successful deploy
  yield* deleteService.deleteLocalFiles(componentSet, result);
  yield* channelService.appendToChannel(yield* formatDeployOutput(result));

  if (result.getFileResponses().some(componentSetService.isSDRFailure)) {
    yield* Effect.promise(() => vscode.window.showErrorMessage(nls.localize('delete_completed_with_errors_message')));
  }
});
