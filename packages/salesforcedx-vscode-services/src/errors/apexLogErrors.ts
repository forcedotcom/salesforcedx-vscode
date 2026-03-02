/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export class ApexLogQueryError extends Schema.TaggedError<ApexLogQueryError>()(
  'ApexLogQueryError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

export class ApexLogBodyFetchError extends Schema.TaggedError<ApexLogBodyFetchError>()(
  'ApexLogBodyFetchError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}
