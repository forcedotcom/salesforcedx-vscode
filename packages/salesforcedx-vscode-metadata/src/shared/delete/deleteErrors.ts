/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';

export class DeleteSourceConflictError extends Data.TaggedError('DeleteSourceConflictError')<{
  readonly conflicts: string[]; // conflict details
}> {}

export class DeleteSourceFailedError extends Data.TaggedError('DeleteSourceFailedError')<{
  readonly cause?: Error;
}> {}
