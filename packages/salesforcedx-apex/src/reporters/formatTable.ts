/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Column, Row } from '../utils/types';

const fillColumn = (label: string, width: number, filler: string, isLastColumn: boolean): string =>
  `${label}${filler.repeat(Math.max(0, width - label.length))}${isLastColumn ? '' : '  '}`;

export const formatTable = (rows: Row[], columns: Column[], title?: string, lineEnding = '\n'): string => {
  const widths = columns.map(column =>
    rows.length === 0
      ? 0
      : rows.reduce(
          (width, row) => row[column.key].split(/\r\n|\r|\n/).reduce((max, line) => Math.max(max, line.length), width),
          (column.label || column.key).length
        )
  );
  const header = columns
    .map((column, index) =>
      widths[index] ? fillColumn(column.label || column.key, widths[index], ' ', index === columns.length - 1) : ''
    )
    .join('');
  const separator = columns
    .map((_, index) => (widths[index] ? fillColumn('', widths[index], '─', index === columns.length - 1) : ''))
    .join('');
  return [
    title ? `=== ${title}` : '',
    header && separator ? `${title ? lineEnding : ''}${header}${lineEnding}${separator}${lineEnding}` : '',
    ...rows.map(
      row =>
        `${columns.reduce((output, column, index) => {
          const rowWidth = output.length;
          return (
            output +
            row[column.key]
              .split(/\r\n|\r|\n/)
              .map((line, lineIndex) =>
                widths[index]
                  ? `${lineIndex === 0 ? '' : `${lineEnding}${' '.repeat(rowWidth)}`}${fillColumn(line, widths[index], ' ', index === columns.length - 1)}`
                  : ''
              )
              .join('')
          );
        }, '')}${lineEnding}`
    )
  ].join('');
};
