/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { FileResponseInfo, RetrieveOutcome } from 'salesforcedx-vscode-services';
import { maybeStoreRetrieveResult } from '../../conflict/resultStorage';
import { nls } from '../../messages';
import { formatRetrieveOutput } from './formatRetrieveOutput';
import { retrieveHasErrors, RetrieveCompletedWithErrorsError } from './retrieveOutcome';

/** Present + persist an already-completed (data-only) retrieve outcome. The retrieve itself ran in services. */
export const retrieveFromOutcome = Effect.fn('retrieveFromOutcome')(function* (
  outcome: RetrieveOutcome,
  fileResponsesFromDelete?: readonly FileResponseInfo[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;

  // Print "Retrieved N components..." message (count available after retrieve completes)
  const componentCount = outcome.fileResponses.length;
  yield* channelService.appendToChannel(`Retrieved ${componentCount} component${componentCount === 1 ? '' : 's'}...`);

  yield* channelService.appendToChannel(formatRetrieveOutput(outcome, fileResponsesFromDelete));

  yield* maybeStoreRetrieveResult(outcome);

  if (retrieveHasErrors(outcome)) {
    const channel = yield* channelService.getChannel;
    yield* Effect.sync(() => channel.show());
    return yield* new RetrieveCompletedWithErrorsError({
      userMessage: nls.localize('retrieve_completed_with_errors_message')
    });
  }
});
