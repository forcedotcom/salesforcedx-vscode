/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const QUERY_RESULT_MIME = 'application/vnd.salesforce.soql-query-result+json';
export const QUERY_PLAN_MIME = 'application/vnd.salesforce.soql-query-plan+json';
export const ANONYMOUS_APEX_RESULT_MIME = 'application/vnd.salesforce.anonymous-apex-result+json';

export type AnonymousApexResult = {
  compiled: boolean;
  success: boolean;
  line: number;
  column: number;
  compileProblem: string | null;
  exceptionMessage: string | null;
  exceptionStackTrace: string | null;
};

export type QueryResultColumn = {
  title: string;
  fieldHelper: string[];
};

export type QueryResultColumnData = {
  objectName: string;
  columns: QueryResultColumn[];
  subTables: QueryResultColumnData[];
};

export type QueryResultPayload = {
  totalSize: number;
  done: boolean;
  records: unknown[];
};

export type QueryResultViewModel = QueryResultPayload & {
  queryText: string;
  columnData: QueryResultColumnData;
};

export type QueryPlanNote = {
  description: string;
  fields: string[];
  tableEnumOrId: string;
};

export type QueryPlanEntry = {
  cardinality: number;
  fields: string[];
  leadingOperationType: string;
  notes: QueryPlanNote[];
  relativeCost: number;
  sobjectCardinality: number;
  sobjectType: string;
};

export type QueryPlanViewModel = {
  queryText: string;
  plans: QueryPlanEntry[];
};

export const stripAttributes = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripAttributes);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'attributes')
        .map(([key, nestedValue]) => [key, stripAttributes(nestedValue)])
    );
  }

  return value;
};

export const toQueryResultPayload = (result: QueryResultPayload): QueryResultPayload => ({
  totalSize: result.totalSize,
  done: result.done,
  records: result.records.map(stripAttributes)
});
