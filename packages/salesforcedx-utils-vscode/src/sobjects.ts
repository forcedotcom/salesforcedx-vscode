/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';

// ---------------------------------------------------------------------------
// Directory constants
// ---------------------------------------------------------------------------

export const SOBJECTS_DIR = 'sobjects';
export const STANDARDOBJECTS_DIR = 'standardObjects';
export const CUSTOMOBJECTS_DIR = 'customObjects';
export const SOQLMETADATA_DIR = 'soqlMetadata';

// ---------------------------------------------------------------------------
// SObject types (derived from jsforce Connection.describe return type)
// ---------------------------------------------------------------------------

type DescribeSObjectResult = Awaited<ReturnType<Connection['describe']>>;
type Field = DescribeSObjectResult['fields'][number];

export type ChildRelationship = DescribeSObjectResult['childRelationships'][number];

export type SObjectField = Pick<
  Field,
  | 'aggregatable'
  | 'custom'
  | 'defaultValue'
  | 'extraTypeInfo'
  | 'filterable'
  | 'groupable'
  | 'inlineHelpText'
  | 'label'
  | 'name'
  | 'nillable'
  | 'picklistValues'
  | 'referenceTo'
  | 'relationshipName'
  | 'sortable'
  | 'type'
>;

export type SObject = Pick<DescribeSObjectResult, 'childRelationships' | 'label' | 'custom' | 'name' | 'queryable'> & {
  fields: SObjectField[];
};

// ---------------------------------------------------------------------------
// toMinimalSObject — converts full jsforce describe result to minimal SObject
// ---------------------------------------------------------------------------

export const toMinimalSObject = (describeSObject: DescribeSObjectResult): SObject => ({
  fields: describeSObject.fields ? describeSObject.fields.map(toMinimalSObjectField) : [],
  label: describeSObject.label,
  childRelationships: describeSObject.childRelationships,
  custom: describeSObject.custom,
  name: describeSObject.name,
  queryable: describeSObject.queryable
});

const toMinimalSObjectField = (describeField: Field): SObjectField => ({
  aggregatable: describeField.aggregatable,
  custom: describeField.custom,
  defaultValue: describeField.defaultValue,
  extraTypeInfo: describeField.extraTypeInfo,
  filterable: describeField.filterable,
  groupable: describeField.groupable,
  inlineHelpText: describeField.inlineHelpText,
  label: describeField.label,
  name: describeField.name,
  nillable: describeField.nillable,
  picklistValues: describeField.picklistValues,
  referenceTo: describeField.referenceTo,
  relationshipName: describeField.relationshipName,
  sortable: describeField.sortable,
  type: describeField.type
});
