/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';
import { OrgId } from './defaultOrgInfo.js';
import { UriSchema } from './uriSchema.js';

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

export class FailedToResolveSfProjectError extends Schema.TaggedError<FailedToResolveSfProjectError>()(
  'FailedToResolveSfProjectError',
  MessageWithCause
) {}
export class GetRegistryAccessError extends Schema.TaggedError<GetRegistryAccessError>()('GetRegistryAccessError', {
  message: Schema.String,
  cause: Schema.Unknown
}) {}
export class NotInPackageDirectoryError extends Schema.TaggedError<NotInPackageDirectoryError>()(
  'NotInPackageDirectoryError',
  { message: Schema.String, uris: Schema.Array(UriSchema) }
) {}

export class SoqlError extends Schema.TaggedError<SoqlError>()('SoqlError', {
  soql: Schema.String,
  errorCode: Schema.String,
  statusCode: Schema.Number,
  message: Schema.String
}) {}
export class FieldError extends Schema.TaggedError<FieldError>()('FieldError', {
  soql: Schema.String,
  errorCode: Schema.String,
  statusCode: Schema.Number,
  message: Schema.String,
  fields: Schema.Array(Schema.String)
}) {}
export class TransmogrifierError extends Schema.TaggedError<TransmogrifierError>()('TransmogrifierError', {
  source: Schema.Literals(['rest-sobject-describe', 'workspace-sobject-metadata', 'persisted-semantic-model']),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}
export class MetadataDescribeError extends Schema.TaggedError<MetadataDescribeError>()('MetadataDescribeError', {
  cause: Schema.Unknown,
  function: Schema.String,
  objectName: Schema.optional(Schema.String),
  message: Schema.String
}) {}
export class ListMetadataError extends Schema.TaggedError<ListMetadataError>()('ListMetadataError', {
  cause: Schema.Unknown,
  metadataType: Schema.String,
  folder: Schema.optional(Schema.String),
  message: Schema.String
}) {}
export class EmptyComponentSetError extends Schema.TaggedError<EmptyComponentSetError>()('EmptyComponentSetError', {
  message: Schema.String,
  size: Schema.Number
}) {}
export class FailedToBuildComponentSetError extends Schema.TaggedError<FailedToBuildComponentSetError>()(
  'FailedToBuildComponentSetError',
  MessageWithCause
) {}
export class MetadataRetrieveError extends Schema.TaggedError<MetadataRetrieveError>()('MetadataRetrieveError', {
  cause: Schema.Unknown,
  message: Schema.String
}) {}
export class UserCancellationError extends Schema.TaggedError<UserCancellationError>()('UserCancellationError', {
  message: Schema.String
}) {}
export class SourceTrackingError extends Schema.TaggedError<SourceTrackingError>()('SourceTrackingError', {
  message: Schema.String,
  cause: Schema.Unknown
}) {}
export class SourceTrackingNotEnabledError extends Schema.TaggedError<SourceTrackingNotEnabledError>()(
  'SourceTrackingNotEnabledError',
  {
    message: Schema.String
  }
) {}
export class SourceTrackingConflictError extends Schema.TaggedError<SourceTrackingConflictError>()(
  'SourceTrackingConflictError',
  {
    conflicts: Schema.Array(Schema.String)
  }
) {}
