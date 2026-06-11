/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { NonEmptyComponentSet } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { maybeStoreDeployResult } from '../../conflict/resultStorage';
import { nls } from '../../messages';
import { type CommandKey, getProgressLocation } from '../../utils/notificationMode';
import { applyDeployDiagnostics, clearDeployDiagnostics } from './deployDiagnostics';
import { DeployCompletedWithErrorsError } from './deployErrors';
import { formatDeployOutput } from './formatDeployOutput';
import { getMergedDeployFailures } from './getMergedDeployFailures';

/** Deploy a ComponentSet, handling empty sets, cancellation, and output formatting */
export const deployComponentSet = Effect.fn('deployComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
  command?: CommandKey;
}) {
  const { componentSet, command } = options;
  clearDeployDiagnostics();

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel('Starting metadata deployment...');

  const progressLocation = command ? getProgressLocation(command) : vscode.ProgressLocation.Notification;
  const result = yield* api.services.MetadataDeployService.deploy(componentSet, { progressLocation });

  yield* channelService.appendToChannel(yield* formatDeployOutput(result));

  yield* maybeStoreDeployResult(result);

  const failedResponses = yield* getMergedDeployFailures(result);
  const failedWithPaths = failedResponses.filter(
    (fr): fr is typeof fr & { filePath: string } => typeof fr.filePath === 'string' && fr.filePath.length > 0
  );
  if (failedResponses.length > 0) {
    if (failedWithPaths.length > 0) {
      yield* applyDeployDiagnostics(failedWithPaths);
    }
    yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
    return yield* new DeployCompletedWithErrorsError({
      userMessage: nls.localize('deploy_completed_with_errors_message')
    });
  }
});
