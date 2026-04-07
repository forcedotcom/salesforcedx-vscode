/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, FileResponse } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { maybeStoreRetrieveResult } from '../../conflict/resultStorage';
import { nls } from '../../messages';
import { formatRetrieveOutput } from './formatRetrieveOutput';

/** Retrieve a ComponentSet, handling empty sets, cancellation, and output formatting */
export const retrieveComponentSet = Effect.fn('retrieveComponentSet')(function* (options: {
  componentSet: ComponentSet;
  ignoreConflicts?: boolean;
  fileResponsesFromDelete?: FileResponse[];
}) {
  const { componentSet, ignoreConflicts, fileResponsesFromDelete } = options;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;

  const componentCount = componentSet.size;
  yield* channelService.appendToChannel(`Retrieving ${componentCount} component${componentCount === 1 ? '' : 's'}...`);

  const result = yield* api.services.MetadataRetrieveService.retrieveComponentSet(componentSet, { ignoreConflicts });

  yield* channelService.appendToChannel(yield* formatRetrieveOutput(result, fileResponsesFromDelete));

  yield* maybeStoreRetrieveResult(result);

  const { isSDRFailure } = yield* api.services.ComponentSetService;
  if (result.getFileResponses().some(isSDRFailure)) {
    const channel = yield* channelService.getChannel;
    yield* Effect.sync(() => channel.show());
    yield* Effect.sync(() => {
      void vscode.window.showErrorMessage(nls.localize('retrieve_completed_with_errors_message'));
    });
  }
});
