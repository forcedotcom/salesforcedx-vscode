/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';
import { DATA_JSON_EXT } from '../../constants';
import { DataProvider } from './IDataProvider';

export class JsonDataProvider implements DataProvider {
  public readonly fileExtension = DATA_JSON_EXT;

  constructor(public readonly documentName: string) {}

  public getFileContent(data: JsonMap[]) {
    const queryRecordsJson = JSON.stringify(data, null, 2);
    // TODO: format the JSON with Prettier?
    return queryRecordsJson;
  }

  public getFileName() {
    return `${this.documentName}.${this.fileExtension}`;
  }
}
