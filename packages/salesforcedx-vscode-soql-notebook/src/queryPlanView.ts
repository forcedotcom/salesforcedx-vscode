/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { QueryPlanViewModel } from './queryResultOutput';

export const queryPlanColumns = [
  { title: 'Cardinality', field: 'cardinality' },
  { title: 'Fields', field: 'fields' },
  { title: 'Leading Operation Type', field: 'leadingOperationType' },
  { title: 'Relative Cost', field: 'relativeCost' },
  { title: 'sObject Cardinality', field: 'sobjectCardinality' },
  { title: 'sObject Type', field: 'sobjectType' }
];

export const toQueryPlanTableRows = (plan: QueryPlanViewModel): Array<Record<string, string | number>> =>
  plan.plans.map(entry => ({
    cardinality: entry.cardinality,
    fields: entry.fields.join(', '),
    leadingOperationType: entry.leadingOperationType,
    relativeCost: entry.relativeCost,
    sobjectCardinality: entry.sobjectCardinality,
    sobjectType: entry.sobjectType
  }));
