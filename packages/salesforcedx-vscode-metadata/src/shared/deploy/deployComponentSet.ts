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
import { COMPONENT_STATUS_FAILED } from '../constants';
import { formatDeployOutput } from './formatDeployOutput';

/** Deploy a ComponentSet, handling empty sets, cancellation, and output formatting */
export const deployComponentSet = Effect.fn('deployComponentSet')(function* (options: {
  componentSet: NonEmptyComponentSet;
}) {
  const { componentSet } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const deployService = yield* api.services.MetadataDeployService;

  yield* channelService.appendToChannel(
    `Deploying ${componentSet.size} component${componentSet.size === 1 ? '' : 's'}...`
  );

  const result = yield* deployService.deploy(componentSet);

  // Handle cancellation
  if (typeof result === 'string') {
    yield* channelService.appendToChannel('Deploy cancelled by user');
    return;
  }

  yield* channelService.appendToChannel(formatDeployOutput(result));

  if (result.getFileResponses().some(r => String(r.state) === COMPONENT_STATUS_FAILED)) {
    yield* Effect.promise(() => vscode.window.showErrorMessage(nls.localize('deploy_completed_with_errors_message')));
  }
});
