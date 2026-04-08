/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';

export class SourceTrackingFailedError extends Data.TaggedError('SourceTrackingFailedError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
