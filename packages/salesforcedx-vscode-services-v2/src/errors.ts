/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';

const MessageWithCause = { message: Schema.String, cause: Schema.optional(Schema.instanceOf(Error)) };

export class SettingsError extends Schema.TaggedError<SettingsError>()('MissingSettingsError', {
  cause: Schema.Unknown,
  key: Schema.String,
  section: Schema.optional(Schema.String),
  message: Schema.String
}) {}

export class NoWorkspaceOpenError extends Schema.TaggedError<NoWorkspaceOpenError>()('NoWorkspaceOpenError', {
  message: Schema.String
}) {}

export class FailedToCreateConfigAggregatorError extends Schema.TaggedError<FailedToCreateConfigAggregatorError>()(
  'FailedToCreateConfigAggregatorError',
  MessageWithCause
) {}

export class FailedToCreateAuthInfoError extends Schema.TaggedError<FailedToCreateAuthInfoError>()(
  'FailedToCreateAuthInfoError',
  MessageWithCause
) {}

export class FailedToCreateConnectionError extends Schema.TaggedError<FailedToCreateConnectionError>()(
  'FailedToCreateConnectionError',
  MessageWithCause
) {}

export class NoTargetOrgConfiguredError extends Schema.TaggedError<NoTargetOrgConfiguredError>()(
  'NoTargetOrgConfiguredError',
  { message: Schema.String }
) {}

export class AccessTokenExpiredError extends Schema.TaggedError<AccessTokenExpiredError>()('AccessTokenExpiredError', {
  message: Schema.String,
  username: Schema.optional(Schema.String)
}) {}
