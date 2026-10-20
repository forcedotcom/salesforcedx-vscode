/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type QueryResultColumnData, type QueryResultPayload } from './queryResultOutput';

export type TabulatorColumn = {
  title: string;
  field: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const getColumns = (obj: QueryResultPayload, columnData?: QueryResultColumnData): TabulatorColumn[] => {
  const record = obj.records[0];
  if (!record || typeof record !== 'object' || !columnData) {
    return [];
  }

  return columnData.columns.map(col => {
    let field = '';
    let currentObject: unknown = record;
    col.fieldHelper.forEach(segment => {
      if (!isRecord(currentObject)) {
        return;
      }
      const entry = Object.entries(currentObject).find(([key]) => key.toLowerCase() === segment.toLowerCase());
      if (entry) {
        const [key, value] = entry;
        field = field.length === 0 ? key : `${field}.${key}`;
        currentObject = value;
      }
    });
    return { title: col.title, field };
  });
};
