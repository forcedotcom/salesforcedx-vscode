/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
// eslint-disable-next-line import/no-extraneous-dependencies -- toDeployOutcome is a pure mapper function
import { toDeployOutcome, type NonEmptyComponentSet } from 'salesforcedx-vscode-services';
import { nls } from '../../messages';
import { formatDeployOutput } from '../deploy/formatDeployOutput';
import { DeleteSourceFailedError } from './deleteErrors';

/** Delete a ComponentSet, handling cancellation, and local file deletion */
export const deleteComponentSet = Effect.fn('deleteComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
}) {
  const { componentSet } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;

  // Mark components for deletion
  const deleteSet = yield* api.services.MetadataDeleteService.markComponentsForDeletion(componentSet);

  yield* channelService.appendToChannel(`Deleting ${deleteSet.size} component${deleteSet.size === 1 ? '' : 's'}...`);

  const result = yield* api.services.MetadataDeployService.deploy(deleteSet);
  const outcome = toDeployOutcome(result);

  if (outcome.fileResponses.some(fr => fr.state === 'Failed')) {
    return yield* new DeleteSourceFailedError({
      cause: new Error(nls.localize('delete_source_operation_failed', outcome.errorMessage ?? 'Unknown error')),
      outcome
    });
  }

  // Delete local files after successful deploy
  yield* api.services.MetadataDeleteService.deleteLocalFiles(componentSet);
  yield* channelService.appendToChannel(formatDeployOutput(outcome));
});
