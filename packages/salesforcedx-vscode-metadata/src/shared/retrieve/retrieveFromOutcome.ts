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
import { RetrieveCompletedWithErrorsError } from './retrieveOutcome';

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

  // Check for errors in the outcome (data-only version)
  const RETRIEVE_FAILURE_STATUSES = new Set(['Failed', 'FinalizingFailed', 'SucceededPartial']);
  const hasFileFailures = outcome.fileResponses.some(fr => fr.state === 'Failed');
  const hasStatusFailure = RETRIEVE_FAILURE_STATUSES.has(outcome.status);

  if (hasFileFailures || !outcome.success || hasStatusFailure) {
    const channel = yield* channelService.getChannel;
    yield* Effect.sync(() => channel.show());
    return yield* new RetrieveCompletedWithErrorsError({
      userMessage: nls.localize('retrieve_completed_with_errors_message')
    });
  }
});
