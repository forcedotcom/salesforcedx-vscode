/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ColumnData, SelectAnalyzer } from '@salesforce/soql-model';
import { JsonMap } from '@salesforce/ts-types';
import * as Papa from 'papaparse';
import { DATA_CSV_EXT } from '../../constants';
import { DataProvider } from './iDataProvider';

export class CsvDataProvider implements DataProvider {
  public readonly fileExtension = DATA_CSV_EXT;
  constructor(public readonly documentName: string) {}

  public getFileContent(query: string, data: JsonMap[]): string {
    const queryRecordsCsv = Papa.unparse(this.toTable(query, data), {
      header: true,
      delimiter: ','
    });

    return queryRecordsCsv;
  }

  public getFileName(): string {
    return `${this.documentName}.${this.fileExtension}`;
  }

  protected toTable(
    query: string,

    data: JsonMap[]
  ): Papa.UnparseObject<string[]> {
    const columnData = new SelectAnalyzer(query).getColumnData();
    const fields: string[] = [];
    const colDataQ = [columnData];
    while (colDataQ.length > 0) {
      const cd = colDataQ.shift();
      cd?.columns.forEach(col => fields.push(col.title));
      cd?.subTables.forEach(subTable => colDataQ.push(subTable));
    }

    const flattenRecord = (record: any, colData: ColumnData): string[][] => {
      const recordValues: string[][] = [];

      const queryRecord: string[] = [];
      colData.columns.forEach(col => {
        let currentObject: any = record;
        col.fieldHelper.forEach(segment => {
          const key = Object.keys(currentObject).find(k => k.toLowerCase() === segment.toLowerCase());
          if (key) {
            currentObject = currentObject[key];
          }
        });
        queryRecord.push(
          typeof currentObject === 'string' || typeof currentObject === 'number' || typeof currentObject === 'boolean'
            ? `${currentObject}`
            : ''
        );
      });

      let subRecords: string[][] = [];
      colData.subTables.forEach(subTable => {
        const key = Object.keys(record).find(k => k.toLowerCase() === subTable.objectName.toLowerCase());
        if (
          key &&
          record[key] &&
          typeof record[key] === 'object' &&
          Array.isArray((record[key] as unknown as any).records)
        ) {
          (record[key] as unknown as any).records.forEach((subRec: any) => {
            subRecords = subRecords.concat(flattenRecord(subRec, subTable));
          });
        }
      });

      if (subRecords.length) {
        subRecords.forEach(subRecordValues => {
          recordValues.push(queryRecord.concat(subRecordValues));
        });
      } else {
        recordValues.push(queryRecord);
      }
      return recordValues;
    };
    let values: string[][] = [];
    data.forEach(record => {
      values = values.concat(flattenRecord(record, columnData));
    });

    return {
      fields,
      data: values
    };
  }
}
