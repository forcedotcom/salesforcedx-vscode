/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import type { RetrieveOutcome } from 'salesforcedx-vscode-services';

/** Retrieve finished but the org reported failures (file responses and/or retrieve status). */
export class RetrieveCompletedWithErrorsError extends Data.TaggedError('RetrieveCompletedWithErrorsError')<{
  readonly userMessage: string;
}> {
  public override get message(): string {
    return this.userMessage;
  }
}

const RETRIEVE_FAILURE_STATUSES: ReadonlySet<string> = new Set(['Failed', 'FinalizingFailed', 'SucceededPartial']);

/**
 * Whether retrieve should be treated as failed for UX (no success toast, surface
 * {@link RetrieveCompletedWithErrorsError}). File-level failures are primary; also
 * handle API status when SDR does not surface every issue as a failed file response.
 * Now operates on owned RetrieveOutcome (sync).
 */
export const retrieveHasErrors = (outcome: RetrieveOutcome): boolean => {
  if (outcome.fileResponses.some(fr => fr.state === 'Failed')) {
    return true;
  }
  if (outcome.success === false) {
    return true;
  }
  return RETRIEVE_FAILURE_STATUSES.has(outcome.status);
};
