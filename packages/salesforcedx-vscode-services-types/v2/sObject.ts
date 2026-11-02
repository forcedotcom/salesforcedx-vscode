/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';

const PicklistValueSchema = Schema.Struct({
  active: Schema.Boolean,
  label: Schema.NullOr(Schema.String),
  value: Schema.String
});
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
  picklistValues: Schema.Array(PicklistValueSchema),
  precision: Schema.optional(Schema.Number),
  referenceTo: Schema.Array(Schema.String),
  relationshipName: Schema.NullOr(Schema.String),
  scale: Schema.optional(Schema.Number),
  sortable: Schema.Boolean,
  type: Schema.String
});
const ChildRelationshipSchema = Schema.Struct({
  childSObject: Schema.String,
  field: Schema.String,
  relationshipName: Schema.NullOr(Schema.String)
});
export const SObjectSchema = Schema.Struct({
  name: Schema.String,
  label: Schema.String,
  custom: Schema.Boolean,
  queryable: Schema.Boolean,
  fields: Schema.Array(SObjectFieldSchema),
  childRelationships: Schema.Array(ChildRelationshipSchema)
});
export type SObject = typeof SObjectSchema.Type;
export type SObjectField = typeof SObjectFieldSchema.Type;
export type ChildRelationship = typeof ChildRelationshipSchema.Type;
