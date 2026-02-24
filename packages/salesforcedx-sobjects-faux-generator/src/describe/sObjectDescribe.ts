/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SObject } from '../types';
import { DescribeSObjectResult, Field, SObjectField } from '../types/describe';

/**
 * Convert jsforce's complete sobject metadata to our internal (smaller) SObject representation
 *
 * @param describeSObject full metadata of an sobject, as returned by the jsforce's sobject/describe api
 * @returns SObject containing a subset of DescribeSObjectResult information
 */
export const toMinimalSObject = (describeSObject: DescribeSObjectResult): SObject => ({
  fields: describeSObject.fields ? describeSObject.fields.map(toMinimalSObjectField) : [],
  ...pick(describeSObject, 'label', 'childRelationships', 'custom', 'name', 'queryable')
});

const toMinimalSObjectField = (describeField: Field): SObjectField =>
  pick(
    describeField,
    'aggregatable',
    'custom',
    'defaultValue',
    'extraTypeInfo',
    'filterable',
    'groupable',
    'inlineHelpText',
    'label',
    'name',
    'nillable',
    'picklistValues',
    'referenceTo',
    'relationshipName',
    'sortable',
    'type'
  );

const pick = <T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> => {
  const ret: any = {};
  keys.forEach(key => {
    ret[key] = obj[key];
  });
  return ret;
};
