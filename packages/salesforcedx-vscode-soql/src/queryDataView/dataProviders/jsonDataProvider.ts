/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { JsonMap } from '@salesforce/ts-types';
import { DATA_JSON_EXT } from '../../constants';
import { DataProvider } from './iDataProvider';

export class JsonDataProvider implements DataProvider {
  public readonly fileExtension = DATA_JSON_EXT;

  constructor(public readonly documentName: string) {}

  public getFileContent(query: string, data: JsonMap[]): string {
    const queryRecordsJson = JSON.stringify(data, null, 2);
    return queryRecordsJson;
  }

  public getFileName(): string {
    return `${this.documentName}.${this.fileExtension}`;
  }
}
