/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';

/** Deploy finished but the org reported failures (file responses and/or API componentFailures). */
export class DeployCompletedWithErrorsError extends Data.TaggedError('DeployCompletedWithErrorsError')<{
  readonly userMessage: string;
}> {
  public override get message(): string {
    return this.userMessage;
  }
}
