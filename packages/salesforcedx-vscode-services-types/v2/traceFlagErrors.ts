/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';

const withCause = { message: Schema.String, cause: Schema.optional(Schema.Unknown) };
export class TraceFlagCreateError extends Schema.TaggedError<TraceFlagCreateError>()(
  'TraceFlagCreateError',
  withCause
) {}
export class TraceFlagUpdateError extends Schema.TaggedError<TraceFlagUpdateError>()('TraceFlagUpdateError', {
  ...withCause,
  traceFlagId: Schema.optional(Schema.String)
}) {}
export class TraceFlagNotFoundError extends Schema.TaggedError<TraceFlagNotFoundError>()('TraceFlagNotFoundError', {
  message: Schema.String,
  userId: Schema.optional(Schema.String)
}) {}
export class DebugLevelCreateError extends Schema.TaggedError<DebugLevelCreateError>()(
  'DebugLevelCreateError',
  withCause
) {}
export class DebugLevelDeleteError extends Schema.TaggedError<DebugLevelDeleteError>()(
  'DebugLevelDeleteError',
  withCause
) {}
export class UserIdNotFoundError extends Schema.TaggedError<UserIdNotFoundError>()('UserIdNotFoundError', {
  message: Schema.String
}) {}
