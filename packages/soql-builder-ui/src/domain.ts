/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as ParseResult from 'effect/ParseResult';
import * as Schema from 'effect/Schema';

export const SoqlObjectMetadataSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  label: Schema.NonEmptyTrimmedString,
  queryable: Schema.Boolean
});

export type SoqlObjectMetadata = typeof SoqlObjectMetadataSchema.Type;

export const SoqlFieldMetadataSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  label: Schema.NonEmptyTrimmedString,
  type: Schema.NonEmptyTrimmedString,
  filterable: Schema.Boolean,
  groupable: Schema.Boolean,
  sortable: Schema.Boolean
});

export type SoqlFieldMetadata = typeof SoqlFieldMetadataSchema.Type;

export const SoqlBuilderMetadataSchema = Schema.Struct({
  objects: Schema.Array(SoqlObjectMetadataSchema),
  fields: Schema.Array(SoqlFieldMetadataSchema)
});

export type SoqlBuilderMetadata = typeof SoqlBuilderMetadataSchema.Type;

export const SoqlBuilderQuerySchema = Schema.Struct({
  fields: Schema.Array(Schema.NonEmptyTrimmedString),
  originalSoqlStatement: Schema.String,
  sObject: Schema.String
});

export type SoqlBuilderQuery = typeof SoqlBuilderQuerySchema.Type;

export const SoqlBuilderStateSchema = Schema.Struct({
  metadata: SoqlBuilderMetadataSchema,
  errorMessage: Schema.optional(Schema.String),
  hasNoDefaultOrg: Schema.Boolean,
  isFieldsLoading: Schema.Boolean,
  isObjectsLoading: Schema.Boolean,
  query: SoqlBuilderQuerySchema
});

export type SoqlBuilderState = typeof SoqlBuilderStateSchema.Type;

export const SoqlBuilderActionSchema = Schema.Union(
  Schema.TaggedStruct('ObjectSelected', {
    objectName: Schema.NonEmptyTrimmedString
  }),
  Schema.TaggedStruct('FieldsSelected', {
    fieldNames: Schema.Array(Schema.NonEmptyTrimmedString)
  })
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

export class SoqlBuilderDriverError extends Schema.TaggedError<SoqlBuilderDriverError>()('SoqlBuilderDriverError', {
  operation: Schema.Literal('initialize', 'subscribe', 'dispatch'),
  details: Schema.String
}) {
  public override get message(): string {
    return this.details;
  }
}

export const decodeSoqlBuilderMetadata = (input: unknown) =>
  Schema.decodeUnknown(SoqlBuilderMetadataSchema)(input).pipe(
    Effect.mapError(
      error =>
        new InvalidSoqlBuilderMetadataError({
          details: ParseResult.TreeFormatter.formatErrorSync(error)
        })
    )
  );

export const createInitialSoqlBuilderState = (): SoqlBuilderState => ({
  metadata: {
    fields: [],
    objects: []
  },
  hasNoDefaultOrg: false,
  isFieldsLoading: false,
  isObjectsLoading: false,
  query: {
    fields: [],
    originalSoqlStatement: '',
    sObject: ''
  }
});
