/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DescribeSObjectResult, Field, SObject, SObjectField } from './types/describe';

/**
 * Convert jsforce's complete sobject metadata to our internal (smaller) SObject representation
 */
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
