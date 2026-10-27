/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Column, Row } from './types';

const fillColumn = (label: string, width: number, filler: string, isLastColumn: boolean): string =>
  `${label}${filler.repeat(Math.max(0, width - label.length))}${isLastColumn ? '' : '  '}`;

export const formatTable = (rows: Row[], columns: Column[], title?: string): string => {
  if (!rows) throw Error('rows cannot be undefined');
  if (!columns) throw Error('columns cannot be undefined');
  const widths = new Map<string, number>();
  columns.forEach(column =>
    rows.forEach(row => {
      const cell = row[column.key];
      if (cell === undefined) throw Error(`Row is missing the key ${column.key}`);
      // Preserve LF-only cell splitting and column widths from the legacy Table API.
      widths.set(
        column.key,
        cell
          .split('\n')
          .reduce(
            (max, line) => Math.max(max, line.length),
            widths.get(column.key) ?? (column.label || column.key).length
          )
      );
    })
  );
  const header = columns
    .map((column, index) => {
      const width = widths.get(column.key);
      return width ? fillColumn(column.label || column.key, width, ' ', index === columns.length - 1) : '';
    })
    .join('');
  const separator = columns
    .map((column, index) => {
      const width = widths.get(column.key);
      return width ? fillColumn('', width, '─', index === columns.length - 1) : '';
    })
    .join('');
  return [
    title ? `=== ${title}` : '',
    header && separator ? `${title ? '\n' : ''}${header}\n${separator}\n` : '',
    ...rows.map(
      row =>
        `${columns.reduce((output, column, index) => {
          const rowWidth = output.length;
          const width = widths.get(column.key);
          return (
            output +
            row[column.key]
              .split('\n')
              // Pad additional lines to the beginning of the current column.
              // Only add column separator padding once to additional lines.
              .map((line, lineIndex) =>
                width
                  ? `${lineIndex === 0 ? '' : `\n${' '.repeat(rowWidth)}`}${fillColumn(line, width, ' ', index === columns.length - 1)}`
                  : ''
              )
              .join('')
          );
        }, '')}\n`
    )
  ].join('');
};
