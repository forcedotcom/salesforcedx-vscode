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
import { maybeStoreDeployResult } from '../../conflict/resultStorage';
import { nls } from '../../messages';
import { applyDeployDiagnostics, clearDeployDiagnostics } from './deployDiagnostics';
import { formatDeployOutput } from './formatDeployOutput';

/** Deploy a ComponentSet, handling empty sets, cancellation, and output formatting */
export const deployComponentSet = Effect.fn('deployComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
}) {
  const { componentSet } = options;
  clearDeployDiagnostics();

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [channelService, componentSetService] = yield* Effect.all(
    [api.services.ChannelService, api.services.ComponentSetService],
    { concurrency: 'unbounded' }
  );

  yield* channelService.appendToChannel(
    `Deploying ${componentSet.size} component${componentSet.size === 1 ? '' : 's'}...`
  );

  const result = yield* api.services.MetadataDeployService.deploy(componentSet);

  // Handle cancellation
  if (typeof result === 'string') {
    yield* channelService.appendToChannel('Deploy cancelled by user');
    return;
  }

  yield* channelService.appendToChannel(yield* formatDeployOutput(result));

  yield* maybeStoreDeployResult(result);

  const { isSDRFailure } = componentSetService;
  const failedResponses = result.getFileResponses().filter(isSDRFailure);
  if (failedResponses.length > 0) {
    yield* applyDeployDiagnostics(failedResponses);
    yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
    // we don't wait for the promise to complete (showErrorMessage being dismissed by the user)
    yield* Effect.sync(() => {
      void vscode.window.showErrorMessage(nls.localize('deploy_completed_with_errors_message'));
    });
  }
});
