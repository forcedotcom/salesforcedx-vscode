/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import { ChildRelationshipSchema, SObjectFieldSchema } from './sObjectSchema.js';

const NonEmptyTrimmedString = Schema.String.pipe(
  Schema.decodeTo(Schema.NonEmptyString, {
    decode: SchemaGetter.transform(value => value.trim()),
    encode: SchemaGetter.transform(value => value)
  })
);
const NonNegativeInt = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }));

const SoqlObjectMetadataSchema = Schema.Struct({
  name: NonEmptyTrimmedString,
  label: NonEmptyTrimmedString,
  queryable: Schema.Boolean
});

const SoqlBuilderMetadataSchema = Schema.Struct({
  objects: Schema.Array(SoqlObjectMetadataSchema),
  fields: Schema.Array(SObjectFieldSchema),
  childRelationships: Schema.Array(ChildRelationshipSchema),
  selectedObjectName: Schema.optional(NonEmptyTrimmedString)
});

const SoqlOrderBySchema = Schema.Struct({
  field: NonEmptyTrimmedString,
  order: Schema.optional(Schema.Literals(['ASC', 'DESC'])),
  nulls: Schema.optional(Schema.Literals(['NULLS FIRST', 'NULLS LAST']))
});

const SoqlLiteralSchema = Schema.Struct({
  kind: Schema.optional(Schema.Literal('literal')),
  type: Schema.Literals(['BOOLEAN', 'CURRENCY', 'DATE', 'NULL', 'NUMBER', 'STRING']),
  value: Schema.String
});

export type SoqlLiteral = typeof SoqlLiteralSchema.Type;

const SoqlWhereConditionSchema = Schema.Struct({
  index: NonNegativeInt,
  condition: Schema.Struct({
    kind: Schema.optional(Schema.Literals(['fieldCompare', 'includes', 'inList'])),
    field: Schema.Struct({
      kind: Schema.optional(Schema.Literal('fieldRef')),
      fieldName: NonEmptyTrimmedString
    }),
    operator: Schema.Literals(['=', '!=', '<>', '<=', '>=', '<', '>', 'LIKE', 'IN', 'NOT IN', 'INCLUDES', 'EXCLUDES']),
    compareValue: Schema.optional(SoqlLiteralSchema),
    values: SoqlLiteralSchema.pipe(Schema.Array, Schema.optional)
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

export const SoqlLimitSchema = Schema.Union([
  Schema.TaggedStruct('Empty', {}),
  Schema.TaggedStruct('Valid', {
    value: NonNegativeInt
  }),
  Schema.TaggedStruct('Invalid', {
    input: Schema.String.check(Schema.isMinLength(1))
  })
]);

export type SoqlLimit = typeof SoqlLimitSchema.Type;

export const soqlLimitFromInput = (input: string): SoqlLimit => {
  if (input.length === 0) return { _tag: 'Empty' };
  if (!/^\d+$/u.test(input)) return { _tag: 'Invalid', input };

  const value = Number(input);
  return Number.isSafeInteger(value) ? { _tag: 'Valid', value } : { _tag: 'Invalid', input };
};

const SoqlBuilderQuerySchema = Schema.Struct({
  headerComments: Schema.optional(Schema.String),
  allRows: Schema.Boolean,
  fields: Schema.Array(NonEmptyTrimmedString),
  limit: SoqlLimitSchema,
  orderBy: Schema.Array(SoqlOrderBySchema),
  originalSoqlStatement: Schema.optional(Schema.String),
  parseErrors: Schema.Array(SoqlParseErrorSchema),
  sObject: Schema.optional(Schema.String),
  unsupportedSyntax: Schema.Array(SoqlUnsupportedSyntaxSchema),
  where: Schema.Struct({
    andOr: Schema.optional(Schema.Literals(['AND', 'OR'])),
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

export const SoqlBuilderActionSchema = Schema.Union([
  Schema.TaggedStruct('ObjectSelected', {
    objectName: NonEmptyTrimmedString
  }),
  Schema.TaggedStruct('FieldsSelected', {
    fieldNames: Schema.Array(NonEmptyTrimmedString)
  }),
  Schema.TaggedStruct('AllFieldsSelected', {}),
  Schema.TaggedStruct('AllFieldsCleared', {}),
  Schema.TaggedStruct('WhereConditionUpserted', {
    condition: SoqlWhereConditionSchema,
    andOr: Schema.optional(Schema.Literals(['AND', 'OR']))
  }),
  Schema.TaggedStruct('WhereConditionRemoved', {
    index: NonNegativeInt
  }),
  Schema.TaggedStruct('WhereConjunctionChanged', {
    andOr: Schema.Literals(['AND', 'OR'])
  }),
  Schema.TaggedStruct('OrderByUpserted', {
    orderBy: SoqlOrderBySchema
  }),
  Schema.TaggedStruct('OrderByRemoved', {
    fieldName: NonEmptyTrimmedString
  }),
  Schema.TaggedStruct('LimitChanged', {
    limit: SoqlLimitSchema
  }),
  Schema.TaggedStruct('AllRowsChanged', {
    allRows: Schema.Boolean
  }),
  Schema.TaggedStruct('NotificationsDismissed', {}),
  Schema.TaggedStruct('SetDefaultOrgRequested', {}),
  Schema.TaggedStruct('RunQueryRequested', {}),
  Schema.TaggedStruct('QueryPlanRequested', {})
]);

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
  Schema.decodeUnknownEffect(SoqlBuilderMetadataSchema)(input).pipe(
    Effect.mapError(error => new InvalidSoqlBuilderMetadataError({ details: error.message }))
  );

export const createInitialSoqlBuilderQuery = (): SoqlBuilderQuery => ({
  allRows: false,
  fields: [],
  limit: { _tag: 'Empty' },
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
