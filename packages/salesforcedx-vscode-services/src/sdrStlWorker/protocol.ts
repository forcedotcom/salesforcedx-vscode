/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';

export const PROTOCOL_VERSION = 1 as const;

export const RemoteHandle = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  workerId: Schema.String,
  id: Schema.String,
  kind: Schema.Literal('componentSet', 'sourceTracking')
});
export type RemoteHandle = Schema.Schema.Type<typeof RemoteHandle>;

const FromSourceRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('ComponentSetFromSource'),
  projectDirectory: Schema.String,
  paths: Schema.Array(Schema.String)
});
type FromSourceRequest = Schema.Schema.Type<typeof FromSourceRequest>;

const FromManifestRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('ComponentSetFromManifest'),
  manifestPath: Schema.String
});
type FromManifestRequest = Schema.Schema.Type<typeof FromManifestRequest>;

const DisposeRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('Dispose'),
  handle: RemoteHandle
});
type DisposeRequest = Schema.Schema.Type<typeof DisposeRequest>;

const ConvertToMetadataZipRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('ConvertToMetadataZip'),
  handle: RemoteHandle,
  packageName: Schema.optional(Schema.String)
});
type ConvertToMetadataZipRequest = Schema.Schema.Type<typeof ConvertToMetadataZipRequest>;

const GetPackageXmlRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('GetPackageXml'),
  handle: RemoteHandle
});
type GetPackageXmlRequest = Schema.Schema.Type<typeof GetPackageXmlRequest>;

const GetComponentSummaryRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('GetComponentSummary'),
  handle: RemoteHandle
});
type GetComponentSummaryRequest = Schema.Schema.Type<typeof GetComponentSummaryRequest>;

const GetSourceTrackingKeyRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('GetSourceTrackingKey'),
  type: Schema.String,
  name: Schema.String
});
type GetSourceTrackingKeyRequest = Schema.Schema.Type<typeof GetSourceTrackingKeyRequest>;

const CreateSourceTrackingSessionRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('CreateSourceTrackingSession'),
  projectDirectory: Schema.String,
  instanceUrl: Schema.String,
  accessToken: Schema.String,
  apiVersion: Schema.optional(Schema.String),
  ignoreConflicts: Schema.optional(Schema.Boolean)
});
type CreateSourceTrackingSessionRequest = Schema.Schema.Type<typeof CreateSourceTrackingSessionRequest>;

const GetLocalChangesRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('GetLocalChanges'),
  handle: RemoteHandle,
  byPackageDirectory: Schema.optional(Schema.Boolean)
});
type GetLocalChangesRequest = Schema.Schema.Type<typeof GetLocalChangesRequest>;

const GetSourceTrackingStatusRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('GetSourceTrackingStatus'),
  handle: RemoteHandle,
  local: Schema.Boolean,
  remote: Schema.Boolean
});
type GetSourceTrackingStatusRequest = Schema.Schema.Type<typeof GetSourceTrackingStatusRequest>;

const DeployLocalChangesRequest = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('DeployLocalChanges'),
  handle: RemoteHandle
});
type DeployLocalChangesRequest = Schema.Schema.Type<typeof DeployLocalChangesRequest>;

export const WorkerRequest = Schema.Union(
  FromSourceRequest,
  FromManifestRequest,
  DisposeRequest,
  ConvertToMetadataZipRequest,
  GetPackageXmlRequest,
  GetComponentSummaryRequest,
  GetSourceTrackingKeyRequest,
  CreateSourceTrackingSessionRequest,
  GetLocalChangesRequest,
  GetSourceTrackingStatusRequest,
  DeployLocalChangesRequest
);
export type WorkerRequest = Schema.Schema.Type<typeof WorkerRequest>;

export const ComponentSetCreated = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('ComponentSetCreated'),
  handle: RemoteHandle,
  componentCount: Schema.Number
});

const ComponentDescriptor = Schema.Struct({
  fullName: Schema.String,
  type: Schema.String,
  isSourceBacked: Schema.Boolean
});

export const Disposed = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('Disposed'),
  handle: RemoteHandle
});

export const MetadataZipCreated = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('MetadataZipCreated'),
  zip: Schema.Uint8ArrayFromSelf,
  zipFileCount: Schema.Number
});

export const PackageXmlCreated = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('PackageXmlCreated'),
  xml: Schema.String
});

export const ComponentSummaryCreated = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('ComponentSummaryCreated'),
  components: Schema.Array(ComponentDescriptor)
});

export const SourceTrackingKeyCreated = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('SourceTrackingKeyCreated'),
  key: Schema.String
});

export const SourceTrackingSessionCreated = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('SourceTrackingSessionCreated'),
  handle: RemoteHandle
});

export const LocalChangesCreated = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('LocalChangesCreated'),
  handles: Schema.Array(RemoteHandle)
});

export const LocalChangesDeployed = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('LocalChangesDeployed'),
  status: Schema.String,
  components: Schema.Array(ComponentDescriptor),
  fileResponseCount: Schema.Number
});

const SourceTrackingStatusRow = Schema.Struct({
  fullName: Schema.String,
  type: Schema.String,
  origin: Schema.Literal('local', 'remote'),
  state: Schema.Literal('add', 'delete', 'modify', 'nondelete'),
  filePath: Schema.optional(Schema.String),
  conflict: Schema.optional(Schema.Boolean),
  ignored: Schema.optional(Schema.Boolean)
});

const SourceTrackingRemoteChange = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
  revisionCounter: Schema.optional(Schema.Number),
  lastModifiedDate: Schema.optional(Schema.String),
  memberIdOrName: Schema.optional(Schema.String),
  deleted: Schema.optional(Schema.Boolean),
  modified: Schema.optional(Schema.Boolean)
});

export const SourceTrackingStatus = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('SourceTrackingStatus'),
  status: Schema.Array(SourceTrackingStatusRow),
  remoteChanges: Schema.Array(SourceTrackingRemoteChange)
});

const WorkerFailure = Schema.Struct({
  protocolVersion: Schema.Literal(PROTOCOL_VERSION),
  requestId: Schema.String,
  _tag: Schema.Literal('Failure'),
  error: Schema.Struct({
    name: Schema.String,
    message: Schema.String,
    stack: Schema.optional(Schema.String)
  })
});

export const WorkerResponse = Schema.Union(
  ComponentSetCreated,
  Disposed,
  MetadataZipCreated,
  PackageXmlCreated,
  ComponentSummaryCreated,
  SourceTrackingKeyCreated,
  SourceTrackingSessionCreated,
  LocalChangesCreated,
  SourceTrackingStatus,
  LocalChangesDeployed,
  WorkerFailure
);
export type WorkerResponse = Schema.Schema.Type<typeof WorkerResponse>;
