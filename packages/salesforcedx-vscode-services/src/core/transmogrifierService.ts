/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SObjectArtifactIdentity } from './artifactIdentity';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as S from 'effect/Schema';
import { SObjectSemanticModelSchema, type SObjectSemanticField, type SObjectSemanticModel } from './artifactProjection';
import { SObjectSchema, type SObject, type SObjectField } from './schemas/sObject';

type RawDescribeSObjectResult = Awaited<ReturnType<Connection['describe']>>;

/** Re-exported raw jsforce describe result for consumer type safety */
export type DescribeSObjectResult = RawDescribeSObjectResult;

export type RestSObjectDescribeTransmogrifierInput = {
  readonly source: 'rest-sobject-describe';
  readonly identity: SObjectArtifactIdentity;
  readonly value: DescribeSObjectResult;
};

/** Discriminated provider-native input; the workspace adapter extends this union. */
export type TransmogrifierInput = RestSObjectDescribeTransmogrifierInput;

export class TransmogrifierError extends S.TaggedError<TransmogrifierError>()('TransmogrifierError', {
  source: S.Literal('rest-sobject-describe', 'workspace-sobject-metadata'),
  message: S.String,
  cause: S.optional(S.Unknown)
}) {}
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

const compareName = (left: { readonly name: string }, right: { readonly name: string }): number =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;

const mapRestFieldToSemanticField = (field: SObjectField): SObjectSemanticField => ({
  name: field.name,
  label: field.label,
  type: field.type,
  custom: field.custom,
  defaultValue: field.defaultValue,
  ...(field.inlineHelpText === null ? {} : { inlineHelpText: field.inlineHelpText }),
  ...(field.length === undefined ? {} : { length: field.length }),
  ...(field.precision === undefined ? {} : { precision: field.precision }),
  ...(field.scale === undefined ? {} : { scale: field.scale }),
  referenceTo: field.referenceTo.toSorted(),
  ...(field.relationshipName === null ? {} : { relationshipName: field.relationshipName }),
  picklistValues: field.picklistValues
    .map(value => ({
      value: value.value,
      active: value.active,
      ...(value.label === null ? {} : { label: value.label })
    }))
    .toSorted((left, right) => left.value.localeCompare(right.value)),
  runtimeCapabilities: {
    aggregatable: field.aggregatable,
    filterable: field.filterable,
    groupable: field.groupable,
    nillable: field.nillable,
    sortable: field.sortable
  }
});

const mapRestDescribeToSemanticModel = (
  identity: SObjectArtifactIdentity,
  raw: DescribeSObjectResult
): SObjectSemanticModel => {
  const value = mapToSObject(raw);
  return {
    kind: 'sobject',
    value: {
      identity,
      label: value.label,
      custom: value.custom,
      queryable: value.queryable,
      fields: value.fields.map(mapRestFieldToSemanticField).toSorted(compareName),
      childRelationships: value.childRelationships
        .map(relationship => ({
          childSObject: relationship.childSObject,
          field: relationship.field,
          ...(relationship.relationshipName === null ? {} : { relationshipName: relationship.relationshipName })
        }))
        .toSorted((left, right) =>
          left.childSObject === right.childSObject
            ? left.field.localeCompare(right.field)
            : left.childSObject.localeCompare(right.childSObject)
        )
    }
  };
};

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

    const toSemanticModel = Effect.fn('TransmogrifierService.toSemanticModel')(function* (input: TransmogrifierInput) {
      const model = mapRestDescribeToSemanticModel(input.identity, input.value);
      return yield* S.decodeUnknown(SObjectSemanticModelSchema)(model).pipe(
        Effect.mapError(
          cause =>
            new TransmogrifierError({
              source: input.source,
              message: 'Failed to transform REST SObject Describe into the canonical semantic model',
              cause
            })
        )
      );
    });

    return { toMinimalSObject, decodeSObject, toSemanticModel, SObjectSchema };
  })
}) {}
