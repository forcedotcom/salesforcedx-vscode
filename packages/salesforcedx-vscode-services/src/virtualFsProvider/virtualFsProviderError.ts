/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Data from 'effect/Data';

export class VirtualFsProviderError extends Data.TaggedError('VirtualFsProviderError')<{
  readonly cause?: Error;
  readonly message?: string;
  readonly path?: string;
}> {}
