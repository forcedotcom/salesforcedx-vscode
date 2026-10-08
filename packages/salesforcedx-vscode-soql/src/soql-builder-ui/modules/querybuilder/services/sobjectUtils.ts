/*
 *  Copyright (c) 2021, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { SObjectFieldType } from '@salesforce/soql-model';
import type { SObjectMetadata } from './message/soqlEditorEvent';

type MetadataField = SObjectMetadata['fields'][number];

type NormalizedField = {
  type: SObjectFieldType;
  picklistValues: string[];
  nillable: MetadataField['nillable'];
};

export type FieldMap = Record<string, NormalizedField>;

const typeMap: Record<string, SObjectFieldType> = Object.fromEntries(
  (Object.values(SObjectFieldType) as SObjectFieldType[]).map(fieldType => [fieldType.toLowerCase(), fieldType])
);

const picklistValueStrings = (picklistValues: MetadataField['picklistValues'] | undefined): string[] =>
  Array.isArray(picklistValues) ? picklistValues.map(picklistValue => picklistValue.value) : [];

const fieldFor = (fields: FieldMap | undefined, fieldName: string): NormalizedField | undefined =>
  fields?.[fieldName.toLowerCase()];

export const fieldMap = (sobjectMetadata: SObjectMetadata | undefined): FieldMap =>
  Object.fromEntries(
    (sobjectMetadata?.fields ?? []).map(field => [
      field.name.toLowerCase(),
      {
        type: typeMap[field.type?.toLowerCase() ?? ''] ?? SObjectFieldType.AnyType,
        picklistValues: picklistValueStrings(field.picklistValues),
        nillable: field.nillable
      }
    ])
  );

export const getType = (fields: FieldMap | undefined, fieldName: string): SObjectFieldType =>
  fieldFor(fields, fieldName)?.type ?? SObjectFieldType.AnyType;

export const getPicklistValues = (fields: FieldMap | undefined, fieldName: string): string[] =>
  fieldFor(fields, fieldName)?.picklistValues ?? [];

export const getNillable = (fields: FieldMap | undefined, fieldName: string): boolean | undefined =>
  fieldFor(fields, fieldName)?.nillable;
