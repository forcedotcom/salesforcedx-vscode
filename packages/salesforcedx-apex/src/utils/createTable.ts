/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type Row = { [column: string]: string | number | boolean };
export type Column = { key: string; label: string };

const COLUMN_SEPARATOR = '  ';
const HEADER_FILLER = '─';

/** Creates a formatted table from rows and columns. */
export const createTable = (rows: Row[], cols: Column[], title?: string): string => {
  const maxColWidths = new Map(
    cols.map(col => [
      col.key,
      Math.max(
        col.label.length,
        ...rows.flatMap(row =>
          String(row[col.key] ?? '')
            .split('\n')
            .map(line => line.length)
        )
      )
    ])
  );
  const columnsToDisplay = cols.filter(col => maxColWidths.has(col.key));
  const headerRow = columnsToDisplay
    .map(col => col.label.padEnd(maxColWidths.get(col.key) ?? col.label.length))
    .join(COLUMN_SEPARATOR);
  const headerSeparatorRow = columnsToDisplay
    .map(col => ''.padEnd(maxColWidths.get(col.key) ?? col.label.length, HEADER_FILLER))
    .join(COLUMN_SEPARATOR);
  const rowsText = rows.map(row => {
    const cellLines = columnsToDisplay.map(col => String(row[col.key] ?? '').split('\n'));
    const maxLines = Math.max(1, ...cellLines.map(lines => lines.length));
    return Array.from({ length: maxLines }, (_, lineIndex) =>
      columnsToDisplay
        .map((col, colIndex) =>
          (cellLines[colIndex]?.[lineIndex] ?? '').padEnd(maxColWidths.get(col.key) ?? col.label.length)
        )
        .join(COLUMN_SEPARATOR)
    ).join('\n');
  });
  return [title ? `=== ${title}` : '', headerRow, headerSeparatorRow, ...rowsText, ''].filter(Boolean).join('\n');
};
