/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import type { RequestStatusValue } from 'salesforcedx-vscode-services';

/** Retrieve finished but the org reported failures (file responses and/or retrieve status). */
export class RetrieveCompletedWithErrorsError extends Data.TaggedError('RetrieveCompletedWithErrorsError')<{
  readonly userMessage: string;
}> {
  public override get message(): string {
    return this.userMessage;
  }
}

const RETRIEVE_FAILURE_STATUSES: ReadonlySet<RequestStatusValue> = new Set([
  'Failed',
  'FinalizingFailed',
  'SucceededPartial'
]);

/**
 * Whether retrieve should be treated as failed for UX (no success toast, surface
 * {@link RetrieveCompletedWithErrorsError}). File-level failures are primary; also
 * handle API status when SDR does not surface every issue as a failed file response.
 */
export const retrieveHasErrors = Effect.fn('retrieveHasErrors')(function* (result: RetrieveResult) {
  const { isSDRFailure, toRequestStatus } = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services
    .ComponentSetService;

  if (result.getFileResponses().some(isSDRFailure)) {
    return true;
  }
  const resp = result.response;
  if (resp === undefined) {
    return false;
  }
  if (resp.success === false) {
    return true;
  }
  return RETRIEVE_FAILURE_STATUSES.has(toRequestStatus(resp.status));
});
