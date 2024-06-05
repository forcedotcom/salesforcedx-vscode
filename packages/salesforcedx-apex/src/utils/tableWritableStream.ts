/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Readable } from 'node:stream';
import { elapsedTime } from './elapsedTime';
import { LoggerLevel } from '@salesforce/core';
import * as os from 'node:os';
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

export class TableWriteableStream {
  constructor(private readonly stream: Readable) {
    this.stream = stream;
  }

  @elapsedTime()
  public createTable(rows: Row[], cols: Column[], title?: string): void {
    if (!rows) {
      throw Error('rows cannot be undefined');
    }
    if (!cols) {
      throw Error('columns cannot be undefined');
    }
    const maxColWidths = this.calculateMaxColumnWidths(rows, cols);

    let columnHeader = '';
    let headerSeparator = '';
    cols.forEach((col, index, arr) => {
      const width = maxColWidths.get(col.key);
      if (width) {
        const isLastCol = index === arr.length - 1;
        columnHeader += this.fillColumn(
          col.label || col.key,
          width,
          COLUMN_FILLER,
          isLastCol
        );
        headerSeparator += this.fillColumn('', width, HEADER_FILLER, isLastCol);
      }
    });

    if (columnHeader && headerSeparator) {
      this.stream.push(
        `${title ? `=== ${title}${os.EOL}` : ''}${columnHeader}${
          os.EOL
        }${headerSeparator}${os.EOL}`
      );
    }

    rows.forEach((row) => {
      let outputRow = '';
      cols.forEach((col, colIndex, colArr) => {
        const cell = row[col.key];
        const isLastCol = colIndex === colArr.length - 1;
        const rowWidth = outputRow.length;
        cell.split(os.EOL).forEach((line, lineIndex) => {
          const cellWidth = maxColWidths.get(col.key);
          if (cellWidth) {
            if (lineIndex === 0) {
              outputRow += this.fillColumn(
                line,
                cellWidth,
                COLUMN_FILLER,
                isLastCol
              );
            } else {
              outputRow +=
                os.EOL +
                this.fillColumn('', rowWidth, COLUMN_FILLER, true) +
                this.fillColumn(line, cellWidth, COLUMN_FILLER, isLastCol);
            }
          }
        });
      });
      this.stream.push(outputRow + os.EOL);
      // this call to setImmediate will schedule the closure on the event loop
      // this action causing the current code to yield to the event loop
      // allowing other processes to get time on the event loop
      setImmediate(() => {});
    });
  }

  @elapsedTime()
  private calculateMaxColumnWidths(
    rows: Row[],
    cols: Column[]
  ): Map<string, number> {
    const maxColWidths = new Map<string, number>();
    cols.forEach((col) => {
      rows.forEach((row) => {
        const cell = row[col.key];
        if (cell === undefined) {
          throw Error(`Row is missing the key ${col.key}`);
        }

        let maxColWidth = maxColWidths.get(col.key);
        if (maxColWidth === undefined) {
          maxColWidth = (col.label || col.key).length;
          maxColWidths.set(col.key, maxColWidth);
        }

        // if a cell is multiline, find the line that's the longest
        const longestLineWidth = cell
          .split(os.EOL)
          .reduce((maxLine, line) =>
            line.length > maxLine.length ? line : maxLine
          ).length;
        if (longestLineWidth > maxColWidth) {
          maxColWidths.set(col.key, longestLineWidth);
        }
      });
    });
    return maxColWidths;
  }

  @elapsedTime('elapsedTime', LoggerLevel.TRACE)
  private fillColumn(
    label: string,
    width: number,
    filler: string,
    isLastCol: boolean
  ): string {
    let filled = label;
    for (let i = 0; i < width - label.length; i++) {
      filled += filler;
    }
    if (!isLastCol) {
      filled += COLUMN_SEPARATOR;
    }
    return filled;
  }
}
