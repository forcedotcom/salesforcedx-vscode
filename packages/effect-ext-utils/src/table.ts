/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isNonEmpty, isString } from 'effect/String';

export type Row = {
  [column: string]: string | number | boolean;
};

export type Column = {
  key: string;
  label: string;
};

const COLUMN_SEPARATOR = '  ';
const COLUMN_FILLER = ' ';
const HEADER_FILLER = '─';

/** Creates a formatted table from rows and columns */
export const createTable = (rows: Row[], cols: Column[], title?: string): string => {
  const maxColWidths = calculateMaxColumnWidths(rows, cols);

  const columnsToDisplay = cols.filter(col => maxColWidths.has(col.key));
  const headerRow = columnsToDisplay
    .map(col => fillColumn(col.label || col.key, maxColWidths.get(col.key)!, COLUMN_FILLER))
    .join(COLUMN_SEPARATOR);
  const headerSeparatorRow = columnsToDisplay
    .map(col => fillColumn('', maxColWidths.get(col.key)!, HEADER_FILLER))
    .join(COLUMN_SEPARATOR);

  return [
    title ? `=== ${title}` : '',
    headerRow,
    headerSeparatorRow,
    ...rows.map(row => createTableRow(row, cols, maxColWidths))
  ]
    .filter(isNonEmpty)
    .join('\n');
};

const fillColumn = (label: string, width: number, filler: string): string => label.padEnd(width, filler);

const calculateMaxColumnWidths = (rows: Row[], cols: Column[]): Map<string, number> =>
  new Map(cols.map(col => [col.key, calculateMaxColumnWidth(rows, col)]));

const longestCellWidth = (cell: string): number => Math.max(...cell.split('\n').map(line => line.length));

const calculateMaxColumnWidth = (rows: Row[], col: Column): number =>
  Math.max(
    // the header length
    (col.label || col.key).length,
    ...rows
      .map(row => row[col.key] ?? undefined)
      .filter(isString)
      .filter(isNonEmpty)
      .map(longestCellWidth)
  );

const createTableRow = (row: Row, cols: Column[], maxColWidths: Map<string, number>): string => {
  const columnsToDisplay = cols.filter(col => maxColWidths.has(col.key));
  const allCellLines = columnsToDisplay.map(col => {
    const cell = String(row[col.key] ?? '');
    return cell.split('\n');
  });
  const maxLines = Math.max(...allCellLines.map(lines => lines.length), 1);
  return Array.from({ length: maxLines }, (_, lineIndex) =>
    columnsToDisplay
      .map((col, colIndex) => {
        const cellLines = allCellLines[colIndex];
        const line = cellLines[lineIndex] ?? '';
        const cellWidth = maxColWidths.get(col.key)!;
        return fillColumn(line, cellWidth, COLUMN_FILLER);
      })
      .join(COLUMN_SEPARATOR)
  ).join('\n');
};
