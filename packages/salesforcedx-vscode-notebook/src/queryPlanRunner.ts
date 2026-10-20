/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { parseHeaderComments } from '@salesforce/soql-common';
import { stripAllRows } from '@salesforce/soql-model';
import { nls } from './messages';
import { type QueryPlanEntry, type QueryPlanNote, type QueryPlanViewModel } from './queryResultOutput';

export type QueryPlanConnection = {
  explain: (soql: string) => Promise<{ plans?: unknown }>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const toNotes = (value: unknown): QueryPlanNote[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap(note => {
    if (!isRecord(note) || typeof note.description !== 'string' || typeof note.tableEnumOrId !== 'string') {
      return [];
    }
    return [{ description: note.description, fields: toStringArray(note.fields), tableEnumOrId: note.tableEnumOrId }];
  });
};

export const toQueryPlanEntries = (plans: unknown): QueryPlanEntry[] => {
  if (!Array.isArray(plans)) {
    return [];
  }
  return plans.flatMap(plan => {
    if (
      !isRecord(plan) ||
      typeof plan.cardinality !== 'number' ||
      typeof plan.leadingOperationType !== 'string' ||
      typeof plan.relativeCost !== 'number' ||
      typeof plan.sobjectCardinality !== 'number' ||
      typeof plan.sobjectType !== 'string'
    ) {
      return [];
    }
    return [
      {
        cardinality: plan.cardinality,
        fields: toStringArray(plan.fields),
        leadingOperationType: plan.leadingOperationType,
        notes: toNotes(plan.notes),
        relativeCost: plan.relativeCost,
        sobjectCardinality: plan.sobjectCardinality,
        sobjectType: plan.sobjectType
      }
    ];
  });
};

export const runSoqlCellQueryPlan = async (
  queryText: string,
  connection: QueryPlanConnection
): Promise<QueryPlanViewModel> => {
  const { soql } = stripAllRows(parseHeaderComments(queryText).soqlText);
  if (!soql.trim()) {
    throw new Error(nls.localize('empty_query'));
  }
  const result = await connection.explain(soql);
  return {
    queryText,
    plans: toQueryPlanEntries(result.plans)
  };
};
