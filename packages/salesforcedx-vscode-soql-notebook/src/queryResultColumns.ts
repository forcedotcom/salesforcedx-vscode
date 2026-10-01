/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { QueryResultColumnData, QueryResultPayload } from './queryResultOutput';

export type TabulatorColumn = {
  title: string;
  field: string;
};

export const getColumns = (obj: QueryResultPayload, columnData?: QueryResultColumnData): TabulatorColumn[] => {
  const record = obj.records[0];
  if (!record || typeof record !== 'object' || !columnData) {
    return [];
  }

  return columnData.columns.map(col => {
    let field = '';
    let currentObject: unknown = record;
    col.fieldHelper.forEach(segment => {
      if (!currentObject || typeof currentObject !== 'object') {
        return;
      }
      const key = Object.keys(currentObject).find(k => k.toLowerCase() === segment.toLowerCase());
      if (key) {
        field = field.length === 0 ? key : `${field}.${key}`;
        currentObject = (currentObject as Record<string, unknown>)[key];
      }
    });
    return { title: col.title, field };
  });
};
