/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export class TraceFlagCreateError extends Schema.TaggedError<TraceFlagCreateError>()(
  'TraceFlagCreateError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

export class TraceFlagUpdateError extends Schema.TaggedError<TraceFlagUpdateError>()(
  'TraceFlagUpdateError',
  {
    message: Schema.String,
    traceFlagId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown)
  }
) {}

export class TraceFlagNotFoundError extends Schema.TaggedError<TraceFlagNotFoundError>()(
  'TraceFlagNotFoundError',
  {
    message: Schema.String,
    userId: Schema.optional(Schema.String)
  }
) {}

export class DebugLevelCreateError extends Schema.TaggedError<DebugLevelCreateError>()(
  'DebugLevelCreateError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

export class UserIdNotFoundError extends Schema.TaggedError<UserIdNotFoundError>()(
  'UserIdNotFoundError',
  {
    message: Schema.String
  }
) {}
