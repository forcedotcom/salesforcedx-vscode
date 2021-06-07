/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChildRelationship, DescribeSObjectResult, Field } from 'jsforce';
export { ChildRelationship };

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

export type SObject = Pick<
  DescribeSObjectResult,
  'childRelationships' | 'label' | 'custom' | 'name' | 'queryable'
> & {
  fields: SObjectField[];
};

export type SubRequest = { method: string; url: string };
export type BatchRequest = { batchRequests: SubRequest[] };
export type SubResponse = { statusCode: number; result: DescribeSObjectResult };
export type BatchResponse = { hasErrors: boolean; results: SubResponse[] };
