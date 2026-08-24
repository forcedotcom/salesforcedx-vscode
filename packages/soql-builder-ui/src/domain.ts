/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChildRelationshipSchema, SObjectFieldSchema } from '@salesforce/vscode-services';
import * as Effect from 'effect/Effect';
import * as ParseResult from 'effect/ParseResult';
import * as Schema from 'effect/Schema';

const SoqlObjectMetadataSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  label: Schema.NonEmptyTrimmedString,
  queryable: Schema.Boolean
});

const SoqlBuilderMetadataSchema = Schema.Struct({
  objects: Schema.Array(SoqlObjectMetadataSchema),
  fields: Schema.Array(SObjectFieldSchema),
  childRelationships: Schema.Array(ChildRelationshipSchema),
  selectedObjectName: Schema.optional(Schema.NonEmptyTrimmedString)
});

const SoqlOrderBySchema = Schema.Struct({
  field: Schema.NonEmptyTrimmedString,
  order: Schema.optional(Schema.Literal('ASC', 'DESC')),
  nulls: Schema.optional(Schema.Literal('NULLS FIRST', 'NULLS LAST'))
});

const SoqlLiteralSchema = Schema.Struct({
  kind: Schema.optional(Schema.Literal('literal')),
  type: Schema.Literal('BOOLEAN', 'CURRENCY', 'DATE', 'NULL', 'NUMBER', 'STRING'),
  value: Schema.String
});

export type SoqlLiteral = typeof SoqlLiteralSchema.Type;

const SoqlWhereConditionSchema = Schema.Struct({
  index: Schema.NonNegativeInt,
  condition: Schema.Struct({
    kind: Schema.optional(Schema.Literal('fieldCompare', 'includes', 'inList')),
    field: Schema.Struct({
      kind: Schema.optional(Schema.Literal('fieldRef')),
      fieldName: Schema.NonEmptyTrimmedString
    }),
    operator: Schema.Literal('=', '!=', '<>', '<=', '>=', '<', '>', 'LIKE', 'IN', 'NOT IN', 'INCLUDES', 'EXCLUDES'),
    compareValue: Schema.optional(SoqlLiteralSchema),
    values: Schema.optional(SoqlLiteralSchema.pipe(Schema.Array))
  })
});

export type SoqlWhereCondition = typeof SoqlWhereConditionSchema.Type;

const SoqlParseErrorSchema = Schema.Struct({
  type: Schema.String,
  message: Schema.String,
  lineNumber: Schema.Number,
  charInLine: Schema.Number,
  grammarRule: Schema.optional(Schema.String)
});

const SoqlUnsupportedSyntaxSchema = Schema.Struct({
  unmodeledSyntax: Schema.String,
  reason: Schema.Struct({
    reasonCode: Schema.String,
    message: Schema.String
  })
});

const SoqlBuilderQuerySchema = Schema.Struct({
  headerComments: Schema.optional(Schema.String),
  allRows: Schema.Boolean,
  fields: Schema.Array(Schema.NonEmptyTrimmedString),
  limit: Schema.optional(Schema.String),
  orderBy: Schema.Array(SoqlOrderBySchema),
  originalSoqlStatement: Schema.optional(Schema.String),
  parseErrors: Schema.Array(SoqlParseErrorSchema),
  sObject: Schema.optional(Schema.String),
  unsupportedSyntax: Schema.Array(SoqlUnsupportedSyntaxSchema),
  where: Schema.Struct({
    andOr: Schema.optional(Schema.Literal('AND', 'OR')),
    conditions: Schema.Array(SoqlWhereConditionSchema)
  })
});

export type SoqlBuilderQuery = typeof SoqlBuilderQuerySchema.Type;

export const SoqlBuilderStateSchema = Schema.Struct({
  metadata: SoqlBuilderMetadataSchema,
  errorMessage: Schema.optional(Schema.String),
  hasNoDefaultOrg: Schema.Boolean,
  isFieldsLoading: Schema.Boolean,
  isObjectsLoading: Schema.Boolean,
  isQueryPlanRunning: Schema.Boolean,
  isQueryRunning: Schema.Boolean,
  notificationsDismissed: Schema.Boolean,
  query: SoqlBuilderQuerySchema
});

export type SoqlBuilderState = typeof SoqlBuilderStateSchema.Type;

export const SoqlBuilderActionSchema = Schema.Union(
  Schema.TaggedStruct('ObjectSelected', {
    objectName: Schema.NonEmptyTrimmedString
  }),
  Schema.TaggedStruct('FieldsSelected', {
    fieldNames: Schema.Array(Schema.NonEmptyTrimmedString)
  }),
  Schema.TaggedStruct('AllFieldsSelected', {}),
  Schema.TaggedStruct('AllFieldsCleared', {}),
  Schema.TaggedStruct('WhereConditionUpserted', {
    condition: SoqlWhereConditionSchema,
    andOr: Schema.optional(Schema.Literal('AND', 'OR'))
  }),
  Schema.TaggedStruct('WhereConditionRemoved', {
    index: Schema.NonNegativeInt
  }),
  Schema.TaggedStruct('WhereConjunctionChanged', {
    andOr: Schema.Literal('AND', 'OR')
  }),
  Schema.TaggedStruct('OrderByUpserted', {
    orderBy: SoqlOrderBySchema
  }),
  Schema.TaggedStruct('OrderByRemoved', {
    fieldName: Schema.NonEmptyTrimmedString
  }),
  Schema.TaggedStruct('LimitChanged', {
    limit: Schema.String
  }),
  Schema.TaggedStruct('AllRowsChanged', {
    allRows: Schema.Boolean
  }),
  Schema.TaggedStruct('NotificationsDismissed', {}),
  Schema.TaggedStruct('SetDefaultOrgRequested', {}),
  Schema.TaggedStruct('RunQueryRequested', {}),
  Schema.TaggedStruct('QueryPlanRequested', {})
);

export type SoqlBuilderAction = typeof SoqlBuilderActionSchema.Type;

export const SOQL_BUILDER_ACTION_EVENT = 'soql-builder-action';

export class InvalidSoqlBuilderMetadataError extends Schema.TaggedError<InvalidSoqlBuilderMetadataError>()(
  'InvalidSoqlBuilderMetadataError',
  {
    details: Schema.String
  }
) {
  public override get message(): string {
    return this.details;
  }
}

export class SoqlBuilderMessageChannelError extends Schema.TaggedError<SoqlBuilderMessageChannelError>()(
  'SoqlBuilderMessageChannelError',
  {
    details: Schema.String
  }
) {
  public override get message(): string {
    return this.details;
  }
}

export class SoqlBuilderQueryError extends Schema.TaggedError<SoqlBuilderQueryError>()('SoqlBuilderQueryError', {
  details: Schema.String
}) {
  public override get message(): string {
    return this.details;
  }
}

/** The error channel shared by every `SoqlBuilderService` implementation: host-transport breakdowns, malformed SOQL, and invalid metadata. */
export type SoqlBuilderServiceError =
  | SoqlBuilderMessageChannelError
  | SoqlBuilderQueryError
  | InvalidSoqlBuilderMetadataError;

export const decodeSoqlBuilderMetadata = (input: unknown) =>
  Schema.decodeUnknown(SoqlBuilderMetadataSchema)(input).pipe(
    Effect.mapError(
      error =>
        new InvalidSoqlBuilderMetadataError({
          details: ParseResult.TreeFormatter.formatErrorSync(error)
        })
    )
  );

export const createInitialSoqlBuilderQuery = (): SoqlBuilderQuery => ({
  allRows: false,
  fields: [],
  orderBy: [],
  parseErrors: [],
  unsupportedSyntax: [],
  where: { conditions: [] }
});

export const createInitialSoqlBuilderState = (): SoqlBuilderState => ({
  metadata: {
    childRelationships: [],
    fields: [],
    objects: []
  },
  hasNoDefaultOrg: false,
  isFieldsLoading: false,
  isObjectsLoading: false,
  isQueryPlanRunning: false,
  isQueryRunning: false,
  notificationsDismissed: false,
  query: createInitialSoqlBuilderQuery()
});
