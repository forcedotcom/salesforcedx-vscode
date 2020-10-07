/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';
import * as Papa from 'papaparse';
import { DATA_CSV_EXT } from '../../constants';
import { DataProvider } from './IDataProvider';

export class CsvDataProvider implements DataProvider {
  public readonly fileExtension = DATA_CSV_EXT;
  constructor(public readonly documentName: string) {}

  public getFileContent(data: JsonMap[]) {
    const queryRecordsCsv = Papa.unparse(data, {
      header: true,
      delimiter: ','
    });

    return queryRecordsCsv;
  }

  public getFileName() {
    return `${this.documentName}.${this.fileExtension}`;
  }
}
