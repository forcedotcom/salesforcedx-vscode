/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { DeployOutcome } from 'salesforcedx-vscode-services';
import { maybeStoreDeployResult } from '../../conflict/resultStorage';
import { nls } from '../../messages';
import { applyDeployDiagnostics, clearDeployDiagnostics } from './deployDiagnostics';
import { DeployCompletedWithErrorsError } from './deployErrors';
import { formatDeployOutput } from './formatDeployOutput';
import { getMergedDeployFailures } from './getMergedDeployFailures';

/** Present + persist an already-completed (data-only) deploy outcome. The deploy itself ran in services. */
export const deployFromOutcome = Effect.fn('deployFromOutcome')(function* (outcome: DeployOutcome) {
  clearDeployDiagnostics();
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(formatDeployOutput(outcome));
  yield* maybeStoreDeployResult(outcome);

  const failedResponses = getMergedDeployFailures(outcome);
  const failedWithPaths = failedResponses.filter(
    (fr): fr is typeof fr & { filePath: string } => typeof fr.filePath === 'string' && fr.filePath.length > 0
  );
  if (failedResponses.length > 0) {
    if (failedWithPaths.length > 0) yield* applyDeployDiagnostics(failedWithPaths);
    yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
    return yield* new DeployCompletedWithErrorsError({
      userMessage: nls.localize('deploy_completed_with_errors_message')
    });
  }
});
