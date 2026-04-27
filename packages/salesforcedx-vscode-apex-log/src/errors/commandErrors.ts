/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export class LogGetNoLogsError extends Schema.TaggedError<LogGetNoLogsError>()('LogGetNoLogsError', {
  message: Schema.String
}) {}

export class OpenLogsFolderError extends Schema.TaggedError<OpenLogsFolderError>()('OpenLogsFolderError', {
  message: Schema.String,
  cause: Schema.instanceOf(Error)
}) {}

export class DebugLevelCreateError extends Schema.TaggedError<DebugLevelCreateError>()('DebugLevelCreateError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export class DebugLevelDeleteError extends Schema.TaggedError<DebugLevelDeleteError>()('DebugLevelDeleteError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export class TraceFlagOrphanedDebugLevelError extends Schema.TaggedError<TraceFlagOrphanedDebugLevelError>()(
  'TraceFlagOrphanedDebugLevelError',
  { message: Schema.String, traceFlagId: Schema.String, debugLevelId: Schema.String }
) {}
