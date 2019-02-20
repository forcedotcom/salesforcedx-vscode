/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const COLUMN_SEPARATOR = '  ';
const COLUMN_FILLER = ' ';
const HEADER_FILLER = '─';

export interface Row {
  [column: string]: string;
}

export interface Column {
  key: string;
  label: string;
}

export class Table {
  public createTable(rows: Row[], cols: Column[]): string {
    const maxColWidths = this.calculateMaxColumnWidths(rows, cols);

    let columnHeader = '';
    let headerSeparator = '';
    cols.forEach((col, index, arr) => {
      const width = maxColWidths.get(col.key);
      if (width) {
        const lastCol = index < arr.length - 1;
        columnHeader += this.fillColumn(
          col.label || col.key,
          width,
          COLUMN_FILLER,
          lastCol
        );
        headerSeparator += this.fillColumn('', width, HEADER_FILLER, lastCol);
      }
    });

    let table = `${columnHeader}\n${headerSeparator}\n`;
    rows.forEach(row => {
      let outputRow = '';
      cols.forEach((col, index, arr) => {
        const width = maxColWidths.get(col.key);
        if (width) {
          outputRow += this.fillColumn(
            row[col.key],
            width,
            COLUMN_FILLER,
            index < arr.length - 1
          );
        }
      });
      table += outputRow + '\n';
    });

    return table;
  }

  private calculateMaxColumnWidths(rows: Row[], cols: Column[]) {
    const maxColWidths = new Map<string, number>();
    cols.forEach(col => {
      rows.forEach(row => {
        const cell = row[col.key];
        if (cell === undefined) {
          throw Error(`Row is missing the key ${col.key}`);
        }

        let maxColWidth = maxColWidths.get(col.key);
        if (maxColWidth === undefined) {
          maxColWidth = (col.label || col.key).length;
          maxColWidths.set(col.key, maxColWidth);
        }
        if (cell.length > maxColWidth) {
          maxColWidths.set(col.key, cell.length);
        }
      });
    });
    return maxColWidths;
  }

  private fillColumn(
    label: string,
    width: number,
    filler: string,
    lastCol: boolean
  ): string {
    let filled = label;
    for (let i = 0; i < width - label.length; i++) {
      filled += filler;
    }
    if (lastCol) {
      filled += COLUMN_SEPARATOR;
    }
    return filled;
  }
}
