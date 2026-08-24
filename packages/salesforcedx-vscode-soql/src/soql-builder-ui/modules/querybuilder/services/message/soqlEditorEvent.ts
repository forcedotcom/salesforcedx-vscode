/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const MessageType = {
  UI_ACTIVATED: 'ui_activated',
  UI_SOQL_CHANGED: 'ui_soql_changed',
  UI_TELEMETRY: 'ui_telemetry',
  SOBJECT_METADATA_REQUEST: 'sobject_metadata_request',
  SOBJECT_METADATA_RESPONSE: 'sobject_metadata_response',
  SOBJECTS_REQUEST: 'sobjects_request',
  SOBJECTS_RESPONSE: 'sobjects_response',
  TEXT_SOQL_CHANGED: 'text_soql_changed',
  RUN_SOQL_QUERY: 'run_query',
  CONNECTION_CHANGED: 'connection_changed',
  RUN_SOQL_QUERY_DONE: 'run_query_done',
  NO_DEFAULT_ORG: 'no_default_org',
  GET_QUERY_PLAN: 'get_query_plan',
  GET_QUERY_PLAN_DONE: 'get_query_plan_done',
  SET_DEFAULT_ORG: 'set_default_org'
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const RequestIdSchema = Schema.String.pipe(Schema.brand('@soql/RequestId'));
export type RequestId = Schema.Schema.Type<typeof RequestIdSchema>;

// Deliberately duplicated rather than shared from @salesforce/vscode-services: this file is bundled by the
// legacy rollup pipeline (rollup.config.mjs), where a CJS require of that package transitively hits effect's
// CJS Schema build, which unconditionally requires fast-check and fails to resolve under rollup.
const SObjectFieldSchema = Schema.Struct({
  aggregatable: Schema.Boolean,
  custom: Schema.Boolean,
  defaultValue: Schema.NullOr(Schema.Unknown),
  extraTypeInfo: Schema.NullOr(Schema.String),
  filterable: Schema.Boolean,
  groupable: Schema.Boolean,
  inlineHelpText: Schema.NullOr(Schema.String),
  label: Schema.String,
  length: Schema.optional(Schema.Number),
  name: Schema.String,
  nillable: Schema.Boolean,
  picklistValues: Schema.Array(
    Schema.Struct({
      active: Schema.Boolean,
      label: Schema.NullOr(Schema.String),
      value: Schema.String
    })
  ),
  precision: Schema.optional(Schema.Number),
  referenceTo: Schema.Array(Schema.String),
  relationshipName: Schema.NullOr(Schema.String),
  scale: Schema.optional(Schema.Number),
  sortable: Schema.Boolean,
  type: Schema.String
});

const SObjectMetadataSchema = Schema.Struct({
  name: Schema.String,
  label: Schema.String,
  custom: Schema.Boolean,
  queryable: Schema.Boolean,
  childRelationships: Schema.Array(
    Schema.Struct({
      childSObject: Schema.String,
      field: Schema.String,
      relationshipName: Schema.NullOr(Schema.String)
    })
  ),
  fields: Schema.Array(SObjectFieldSchema)
});

export type SObjectMetadata = Pick<typeof SObjectMetadataSchema.Type, 'fields'>;

const eventWithoutPayload = <T extends MessageType>(type: T) => Schema.Struct({ type: Schema.Literal(type) });

const UiActivatedEventSchema = eventWithoutPayload(MessageType.UI_ACTIVATED);
const SObjectsRequestEventSchema = Schema.Struct({
  type: Schema.Literal(MessageType.SOBJECTS_REQUEST),
  requestId: Schema.optional(RequestIdSchema)
});
const RunSoqlQueryEventSchema = eventWithoutPayload(MessageType.RUN_SOQL_QUERY);
const RunSoqlQueryDoneEventSchema = eventWithoutPayload(MessageType.RUN_SOQL_QUERY_DONE);
const ConnectionChangedEventSchema = eventWithoutPayload(MessageType.CONNECTION_CHANGED);
const NoDefaultOrgEventSchema = eventWithoutPayload(MessageType.NO_DEFAULT_ORG);
const GetQueryPlanEventSchema = eventWithoutPayload(MessageType.GET_QUERY_PLAN);
const GetQueryPlanDoneEventSchema = eventWithoutPayload(MessageType.GET_QUERY_PLAN_DONE);
const SetDefaultOrgEventSchema = eventWithoutPayload(MessageType.SET_DEFAULT_ORG);
const UiSoqlChangedEventSchema = Schema.Struct({
  type: Schema.Literal(MessageType.UI_SOQL_CHANGED),
  payload: Schema.String
});
const UiTelemetryEventSchema = Schema.Struct({
  type: Schema.Literal(MessageType.UI_TELEMETRY),
  payload: Schema.Record({ key: Schema.String, value: Schema.Unknown })
});
const SObjectMetadataRequestEventSchema = Schema.Struct({
  type: Schema.Literal(MessageType.SOBJECT_METADATA_REQUEST),
  payload: Schema.String,
  requestId: Schema.optional(RequestIdSchema)
});
const SObjectMetadataResponseEventSchema = Schema.Struct({
  type: Schema.Literal(MessageType.SOBJECT_METADATA_RESPONSE),
  payload: SObjectMetadataSchema,
  requestId: Schema.optional(RequestIdSchema)
});
const SObjectsResponseEventSchema = Schema.Struct({
  type: Schema.Literal(MessageType.SOBJECTS_RESPONSE),
  payload: Schema.Array(Schema.String),
  requestId: Schema.optional(RequestIdSchema)
});
const TextSoqlChangedEventSchema = Schema.Struct({
  type: Schema.Literal(MessageType.TEXT_SOQL_CHANGED),
  payload: Schema.String
});

export const UiToHostSoqlEditorEventSchema = Schema.Union(
  UiActivatedEventSchema,
  SObjectsRequestEventSchema,
  RunSoqlQueryEventSchema,
  GetQueryPlanEventSchema,
  SetDefaultOrgEventSchema,
  UiSoqlChangedEventSchema,
  UiTelemetryEventSchema,
  SObjectMetadataRequestEventSchema
);

export type UiToHostSoqlEditorEvent = typeof UiToHostSoqlEditorEventSchema.Type;

export const HostToUiSoqlEditorEventSchema = Schema.Union(
  SObjectMetadataResponseEventSchema,
  SObjectsResponseEventSchema,
  TextSoqlChangedEventSchema,
  ConnectionChangedEventSchema,
  NoDefaultOrgEventSchema,
  RunSoqlQueryDoneEventSchema,
  GetQueryPlanDoneEventSchema
);

export type HostToUiSoqlEditorEvent = typeof HostToUiSoqlEditorEventSchema.Type;

export type SoqlEditorEvent = UiToHostSoqlEditorEvent | HostToUiSoqlEditorEvent;
