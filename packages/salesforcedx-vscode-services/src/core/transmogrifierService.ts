/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as S from 'effect/Schema';
import { SObjectSchema, type SObject } from './schemas/sObject';

type RawDescribeSObjectResult = Awaited<ReturnType<Connection['describe']>>;

/** Re-exported raw jsforce describe result for consumer type safety */
export type DescribeSObjectResult = RawDescribeSObjectResult;

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
    length: f.length,
    name: f.name,
    nillable: f.nillable,
    picklistValues: (f.picklistValues ?? []).map(pv => ({
      active: pv.active,
      label: pv.label ?? null,
      value: pv.value
    })),
    precision: f.precision,
    referenceTo: [...(f.referenceTo ?? [])],
    relationshipName: f.relationshipName ?? null,
    scale: f.scale,
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
