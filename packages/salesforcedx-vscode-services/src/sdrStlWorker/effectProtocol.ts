/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';
import {
  ComponentSetCreated,
  ComponentSummaryCreated,
  Disposed,
  MetadataZipCreated,
  PackageXmlCreated,
  PROTOCOL_VERSION,
  RemoteHandle,
  LocalChangesCreated,
  LocalChangesDeployed,
  SourceTrackingStatus,
  SourceTrackingSessionCreated,
  SourceTrackingKeyCreated
} from './protocol';

export class SdrWorkerFailure extends Schema.TaggedError<SdrWorkerFailure>()('SdrWorkerFailure', {
  name: Schema.String,
  message: Schema.String,
  stack: Schema.optional(Schema.String)
}) {}

export class CreateComponentSetFromSourceRequest extends Schema.TaggedRequest<CreateComponentSetFromSourceRequest>()(
  'CreateComponentSetFromSource',
  {
    failure: SdrWorkerFailure,
    success: ComponentSetCreated,
    payload: {
      protocolVersion: Schema.Literal(PROTOCOL_VERSION),
      requestId: Schema.String,
      projectDirectory: Schema.String,
      paths: Schema.Array(Schema.String)
    }
  }
) {}

export class CreateComponentSetFromManifestRequest extends Schema.TaggedRequest<CreateComponentSetFromManifestRequest>()(
  'CreateComponentSetFromManifest',
  {
    failure: SdrWorkerFailure,
    success: ComponentSetCreated,
    payload: {
      protocolVersion: Schema.Literal(PROTOCOL_VERSION),
      requestId: Schema.String,
      manifestPath: Schema.String
    }
  }
) {}

export class GetPackageXmlRequest extends Schema.TaggedRequest<GetPackageXmlRequest>()('GetPackageXml', {
  failure: SdrWorkerFailure,
  success: PackageXmlCreated,
  payload: { protocolVersion: Schema.Literal(PROTOCOL_VERSION), requestId: Schema.String, handle: RemoteHandle }
}) {}

export class GetComponentSummaryRequest extends Schema.TaggedRequest<GetComponentSummaryRequest>()(
  'GetComponentSummary',
  {
    failure: SdrWorkerFailure,
    success: ComponentSummaryCreated,
    payload: { protocolVersion: Schema.Literal(PROTOCOL_VERSION), requestId: Schema.String, handle: RemoteHandle }
  }
) {}

export class CreateMetadataZipRequest extends Schema.TaggedRequest<CreateMetadataZipRequest>()('CreateMetadataZip', {
  failure: SdrWorkerFailure,
  success: MetadataZipCreated,
  payload: {
    protocolVersion: Schema.Literal(PROTOCOL_VERSION),
    requestId: Schema.String,
    handle: RemoteHandle,
    packageName: Schema.optional(Schema.String)
  }
}) {}

export class DisposeHandleRequest extends Schema.TaggedRequest<DisposeHandleRequest>()('DisposeHandle', {
  failure: SdrWorkerFailure,
  success: Disposed,
  payload: { protocolVersion: Schema.Literal(PROTOCOL_VERSION), requestId: Schema.String, handle: RemoteHandle }
}) {}

export class GetSourceTrackingKeyRequest extends Schema.TaggedRequest<GetSourceTrackingKeyRequest>()(
  'GetSourceTrackingKey',
  {
    failure: SdrWorkerFailure,
    success: SourceTrackingKeyCreated,
    payload: {
      protocolVersion: Schema.Literal(PROTOCOL_VERSION),
      requestId: Schema.String,
      type: Schema.String,
      name: Schema.String
    }
  }
) {}

export class CreateSourceTrackingSessionRequest extends Schema.TaggedRequest<CreateSourceTrackingSessionRequest>()(
  'CreateSourceTrackingSession',
  {
    failure: SdrWorkerFailure,
    success: SourceTrackingSessionCreated,
    payload: {
      protocolVersion: Schema.Literal(PROTOCOL_VERSION),
      requestId: Schema.String,
      projectDirectory: Schema.String,
      instanceUrl: Schema.String,
      accessToken: Schema.String,
      apiVersion: Schema.optional(Schema.String),
      ignoreConflicts: Schema.optional(Schema.Boolean)
    }
  }
) {}

export class GetLocalChangesRequest extends Schema.TaggedRequest<GetLocalChangesRequest>()('GetLocalChanges', {
  failure: SdrWorkerFailure,
  success: LocalChangesCreated,
  payload: {
    protocolVersion: Schema.Literal(PROTOCOL_VERSION),
    requestId: Schema.String,
    handle: RemoteHandle,
    byPackageDirectory: Schema.optional(Schema.Boolean)
  }
}) {}

export class GetSourceTrackingStatusRequest extends Schema.TaggedRequest<GetSourceTrackingStatusRequest>()(
  'GetSourceTrackingStatus',
  {
    failure: SdrWorkerFailure,
    success: SourceTrackingStatus,
    payload: {
      protocolVersion: Schema.Literal(PROTOCOL_VERSION),
      requestId: Schema.String,
      handle: RemoteHandle,
      local: Schema.Boolean,
      remote: Schema.Boolean
    }
  }
) {}

export class DeployLocalChangesRequest extends Schema.TaggedRequest<DeployLocalChangesRequest>()('DeployLocalChanges', {
  failure: SdrWorkerFailure,
  success: LocalChangesDeployed,
  payload: {
    protocolVersion: Schema.Literal(PROTOCOL_VERSION),
    requestId: Schema.String,
    handle: RemoteHandle
  }
}) {}

export const AllSdrWorkerRequests = Schema.Union(
  CreateComponentSetFromSourceRequest,
  CreateComponentSetFromManifestRequest,
  GetPackageXmlRequest,
  GetComponentSummaryRequest,
  CreateMetadataZipRequest,
  DisposeHandleRequest,
  GetSourceTrackingKeyRequest,
  CreateSourceTrackingSessionRequest,
  GetLocalChangesRequest,
  GetSourceTrackingStatusRequest,
  DeployLocalChangesRequest
);
export type SdrWorkerRequest = Schema.Schema.Type<typeof AllSdrWorkerRequests>;
