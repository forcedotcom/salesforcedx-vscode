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
import { formatDeployOutput } from './formatDeployOutput';

/** Deploy a ComponentSet, handling empty sets, cancellation, and output formatting */
export const deployComponentSet = Effect.fn('deployComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
}) {
  const { componentSet } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [channelService, deployService, componentSetService] = yield* Effect.all(
    [api.services.ChannelService, api.services.MetadataDeployService, api.services.ComponentSetService],
    { concurrency: 'unbounded' }
  );

  yield* channelService.appendToChannel(
    `Deploying ${componentSet.size} component${componentSet.size === 1 ? '' : 's'}...`
  );

  const result = yield* deployService.deploy(componentSet);

  // Handle cancellation
  if (typeof result === 'string') {
    yield* channelService.appendToChannel('Deploy cancelled by user');
    return;
  }

  yield* channelService.appendToChannel(yield* formatDeployOutput(result));

  if (result.getFileResponses().some(componentSetService.isSDRFailure)) {
    yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
    yield* Effect.promise(() => vscode.window.showErrorMessage(nls.localize('deploy_completed_with_errors_message')));
  }
});
