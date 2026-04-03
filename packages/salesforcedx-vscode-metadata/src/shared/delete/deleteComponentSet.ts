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

/** Delete a ComponentSet, handling cancellation, and local file deletion */
export const deleteComponentSet = Effect.fn('deleteComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
}) {
  const { componentSet } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [channelService, componentSetService] = yield* Effect.all(
    [api.services.ChannelService, api.services.ComponentSetService],
    { concurrency: 'unbounded' }
  );

  // Mark components for deletion
  const deleteSet = yield* api.services.MetadataDeleteService.markComponentsForDeletion(componentSet);

  yield* channelService.appendToChannel(`Deleting ${deleteSet.size} component${deleteSet.size === 1 ? '' : 's'}...`);

  const result = yield* api.services.MetadataDeployService.deploy(deleteSet);

  // Handle cancellation
  if (typeof result === 'string') {
    return yield* channelService.appendToChannel('Delete cancelled by user');
  }

  console.log(result.response);

  const { isSDRFailure } = componentSetService;

  if (result.getFileResponses().some(isSDRFailure)) {
    return yield* new DeleteSourceFailedError({
      cause: new Error(
        nls.localize('delete_source_operation_failed', result.response?.errorMessage ?? 'Unknown error')
      ),
      result
    });
  }

  // Delete local files after successful deploy
  yield* api.services.MetadataDeleteService.deleteLocalFiles(componentSet);
  yield* channelService.appendToChannel(yield* formatDeployOutput(result));

  if (result.getFileResponses().some(isSDRFailure)) {
    yield* Effect.sync(() => {
      void vscode.window.showErrorMessage(nls.localize('delete_completed_with_errors_message'));
    });
  }
});
