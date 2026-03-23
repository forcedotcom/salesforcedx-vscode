/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { JsonMap } from '@salesforce/ts-types';
import { convertToCSV } from '../../commands/dataQuery';
import { DATA_CSV_EXT } from '../../constants';
import { DataProvider } from './iDataProvider';

export class CsvDataProvider implements DataProvider {
  public readonly fileExtension = DATA_CSV_EXT;
  constructor(public readonly documentName: string) {}

  public getFileContent(_query: string, data: JsonMap[]): string {
    return convertToCSV(data);
  }

  public getFileName(): string {
    return `${this.documentName}.${this.fileExtension}`;
  }

}
