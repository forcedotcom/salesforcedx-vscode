/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as S from 'effect/Schema';

export const PicklistValueSchema = S.Struct({
  active: S.Boolean,
  label: S.NullOr(S.String),
  value: S.String
});

export const SObjectFieldSchema = S.Struct({
  aggregatable: S.Boolean,
  custom: S.Boolean,
  defaultValue: S.NullOr(S.Unknown),
  extraTypeInfo: S.NullOr(S.String),
  filterable: S.Boolean,
  groupable: S.Boolean,
  inlineHelpText: S.NullOr(S.String),
  label: S.String,
  length: S.optional(S.Number),
  name: S.String,
  nillable: S.Boolean,
  picklistValues: S.Array(PicklistValueSchema),
  precision: S.optional(S.Number),
  referenceTo: S.Array(S.String),
  relationshipName: S.NullOr(S.String),
  scale: S.optional(S.Number),
  sortable: S.Boolean,
  type: S.String
});

export const ChildRelationshipSchema = S.Struct({
  childSObject: S.String,
  field: S.String,
  relationshipName: S.NullOr(S.String)
});

export const SObjectSchema = S.Struct({
  name: S.String,
  label: S.String,
  custom: S.Boolean,
  queryable: S.Boolean,
  fields: S.Array(SObjectFieldSchema),
  childRelationships: S.Array(ChildRelationshipSchema)
});

export type SObject = S.Schema.Type<typeof SObjectSchema>;
export type SObjectField = S.Schema.Type<typeof SObjectFieldSchema>;
export type ChildRelationship = S.Schema.Type<typeof ChildRelationshipSchema>;
