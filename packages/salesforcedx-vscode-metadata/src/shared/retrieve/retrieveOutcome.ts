/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  type FileResponse,
  type RetrieveResult,
  RequestStatus
} from '@salesforce/source-deploy-retrieve';
import * as Data from 'effect/Data';

/** Retrieve finished but the org reported failures (file responses and/or retrieve status). */
export class RetrieveCompletedWithErrorsError extends Data.TaggedError('RetrieveCompletedWithErrorsError')<{
  readonly userMessage: string;
}> {
  public override get message(): string {
    return this.userMessage;
  }
}

/**
 * Whether retrieve should be treated as failed for UX (no success toast, surface
 * {@link RetrieveCompletedWithErrorsError}). File-level failures are primary; also
 * handle API status when SDR does not surface every issue as a failed file response.
 */
export const retrieveHasErrors = (
  result: RetrieveResult,
  isSDRFailure: (fr: FileResponse) => boolean
): boolean => {
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
  switch (resp.status) {
    case RequestStatus.Failed:
    case RequestStatus.FinalizingFailed:
    case RequestStatus.SucceededPartial:
      return true;
    default:
      return false;
  }
};
