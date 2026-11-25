/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { escapeHtml } from './escaping';

type HtmlTableCell = {
  text: string;
  code?: boolean;
  warning?: boolean;
  highlight?: boolean;
};

type HtmlTableColumn<Row> = {
  label: string;
  width: number;
  cell: (row: Row) => HtmlTableCell;
};

const formatCell = ({ text, code, warning, highlight }: HtmlTableCell): string => {
  const content = code ? `<code>${escapeHtml(text)}</code>` : escapeHtml(text);
  const style = highlight ? 'padding: 8px; font-weight: bold; color: #d32f2f;' : 'padding: 8px;';
  return `<td style="${style}">${content}${warning ? ' ⚠️' : ''}</td>\n`;
};

export const formatHtmlTable = <Row>(rows: readonly Row[], columns: readonly HtmlTableColumn<Row>[]): string =>
  [
    '<table style="width: 100%; border-collapse: collapse;">\n',
    '<thead>\n',
    '<tr style="border-bottom: 2px solid;">\n',
    ...columns.map(
      column =>
        `<th style="text-align: left; padding: 8px; width: ${column.width}%;">${escapeHtml(column.label)}</th>\n`
    ),
    '</tr>\n',
    '</thead>\n',
    '<tbody>\n',
    ...rows.map(
      row =>
        `<tr style="border-bottom: 1px solid #ddd;">\n${columns.map(column => formatCell(column.cell(row))).join('')}</tr>\n`
    ),
    '</tbody>\n',
    '</table>\n\n'
  ].join('');
