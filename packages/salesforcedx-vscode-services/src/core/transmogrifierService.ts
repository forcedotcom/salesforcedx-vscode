/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as S from 'effect/Schema';

type RawDescribeSObjectResult = Awaited<ReturnType<Connection['describe']>>;

/** Re-exported raw jsforce describe result for consumer type safety */
export type DescribeSObjectResult = RawDescribeSObjectResult;

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
  name: S.String,
  nillable: S.Boolean,
  picklistValues: S.Array(PicklistValueSchema),
  referenceTo: S.Array(S.String),
  relationshipName: S.NullOr(S.String),
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

const mapToSObject = (raw: RawDescribeSObjectResult): SObject => ({
  name: raw.name,
  label: raw.label,
  custom: raw.custom,
  queryable: raw.queryable,
  fields: (raw.fields ?? []).map(f => ({
    aggregatable: f.aggregatable,
    custom: f.custom,
    defaultValue: f.defaultValue ?? null,
    extraTypeInfo: f.extraTypeInfo ?? null,
    filterable: f.filterable,
    groupable: f.groupable,
    inlineHelpText: f.inlineHelpText ?? null,
    label: f.label,
    name: f.name,
    nillable: f.nillable,
    picklistValues: (f.picklistValues ?? []).map(pv => ({
      active: pv.active,
      label: pv.label ?? null,
      value: pv.value
    })),
    referenceTo: [...(f.referenceTo ?? [])],
    relationshipName: f.relationshipName ?? null,
    sortable: f.sortable,
    type: f.type
  })),
  childRelationships: (raw.childRelationships ?? []).map(cr => ({
    childSObject: cr.childSObject,
    field: cr.field,
    relationshipName: cr.relationshipName ?? null
  }))
});

export class TransmogrifierService extends Effect.Service<TransmogrifierService>()('TransmogrifierService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    const toMinimalSObject = Effect.fn('TransmogrifierService.toMinimalSObject')(function* (
      raw: DescribeSObjectResult
    ) {
      return mapToSObject(raw);
    });

    const decodeSObject = Effect.fn('TransmogrifierService.decodeSObject')(function* (input: unknown) {
      return yield* S.decodeUnknown(SObjectSchema)(input);
    });

    return { toMinimalSObject, decodeSObject, SObjectSchema };
  })
}) {}
