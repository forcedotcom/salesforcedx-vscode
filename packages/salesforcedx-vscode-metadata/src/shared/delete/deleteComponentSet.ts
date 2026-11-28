/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { NonEmptyComponentSet } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { type ProgressAndSuccessCommandKey } from '../../utils/notificationMode';
import { formatDeployOutput } from '../deploy/formatDeployOutput';
import { DeleteSourceFailedError } from './deleteErrors';

/** Delete a ComponentSet, handling cancellation, and local file deletion */
export const deleteComponentSet = Effect.fn('deleteComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
  command?: ProgressAndSuccessCommandKey;
}) {
  const { componentSet, command } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationMode = yield* api.v2.services.NotificationModeService;
  const [channelService, componentSetService] = yield* Effect.all(
    [api.v2.services.ChannelService, api.v2.services.ComponentSetService],
    { concurrency: 'unbounded' }
  );

  // Mark components for deletion
  const deleteSet = yield* api.v2.services.MetadataDeleteService.use(service =>
    service.markComponentsForDeletion(componentSet)
  );

  yield* channelService.appendToChannel(`Deleting ${deleteSet.size} component${deleteSet.size === 1 ? '' : 's'}...`);

  const progressLocation = command
    ? yield* notificationMode.getProgressLocation(command)
    : vscode.ProgressLocation.Notification;
  const result = yield* api.v2.services.MetadataDeployService.use(service =>
    service.deploy(deleteSet, { progressLocation })
  );

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
  yield* api.v2.services.MetadataDeleteService.use(service => service.deleteLocalFiles(componentSet));
  yield* channelService.appendToChannel(yield* formatDeployOutput(result));
});
