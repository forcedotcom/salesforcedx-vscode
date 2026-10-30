/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';
import { OrgId } from './defaultOrgInfo.js';

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

export class ConfigWriteError extends Schema.TaggedError<ConfigWriteError>()('ConfigWriteError', MessageWithCause) {}

export class FsServiceError extends Schema.TaggedError<FsServiceError>()('FsServiceError', {
  cause: Schema.instanceOf(Error),
  message: Schema.String,
  function: Schema.String,
  filePath: Schema.String
}) {}

export class HostFileNotFoundError extends Schema.TaggedError<HostFileNotFoundError>()('HostFileNotFoundError', {
  message: Schema.String,
  path: Schema.String
}) {}

export class HostFileWatchError extends Schema.TaggedError<HostFileWatchError>()('HostFileWatchError', {
  message: Schema.String,
  path: Schema.String,
  code: Schema.optional(Schema.String)
}) {}

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

export class FailedToSaveAuthInfoError extends Schema.TaggedError<FailedToSaveAuthInfoError>()(
  'FailedToSaveAuthInfoError',
  MessageWithCause
) {}

export class FailedToListAuthorizationsError extends Schema.TaggedError<FailedToListAuthorizationsError>()(
  'FailedToListAuthorizationsError',
  MessageWithCause
) {}

export class GetAuthFieldsError extends Schema.TaggedError<GetAuthFieldsError>()('GetAuthFieldsError', {
  message: Schema.String,
  username: Schema.optional(Schema.String)
}) {}

export class InactiveOrgOperationError extends Schema.TaggedError<InactiveOrgOperationError>()(
  'InactiveOrgOperationError',
  {
    message: Schema.String,
    expectedOrgId: OrgId,
    observedOrgId: Schema.optional(OrgId)
  }
) {}
