/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { ExtensionProviderService } from '../../services/extensionProvider';
import { formatRetrieveOutput } from './formatRetrieveOutput';

/** Retrieve a ComponentSet, handling empty sets, cancellation, and output formatting */
export const retrieveComponentSet = Effect.fn('retrieveComponentSet')(function* (options: {
  componentSet: ComponentSet;
  ignoreConflicts?: boolean;
}) {
  const { componentSet, ignoreConflicts } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [channelService, retrieveService, componentSetService] = yield* Effect.all(
    [api.services.ChannelService, api.services.MetadataRetrieveService, api.services.ComponentSetService],
    { concurrency: 'unbounded' }
  );

  const componentCount = componentSet.size;
  yield* channelService.appendToChannel(`Retrieving ${componentCount} component${componentCount === 1 ? '' : 's'}...`);

  const result = yield* retrieveService.retrieveComponentSet(componentSet, { ignoreConflicts });

  // Handle cancellation
  if (typeof result === 'string') {
    yield* channelService.appendToChannel('Retrieve cancelled by user');
    return;
  }

  yield* channelService.appendToChannel(yield* formatRetrieveOutput(result));

  if (result.getFileResponses().some(componentSetService.isSDRFailure)) {
    const channel = yield* channelService.getChannel;
    yield* Effect.sync(() => channel.show());
    yield* Effect.promise(() => vscode.window.showErrorMessage(nls.localize('retrieve_completed_with_errors_message')));
  }
});
