/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  FileFormat,
  QueryDataFileService
} from '../../../src/queryDataView/queryDataFileService';
import {
  CsvDataProvider,
  JsonDataProvider
} from '../../../src/queryDataView/dataProviders';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { mockQueryData, TestFileService } from '../testUtilities';
import { expect } from 'chai';

describe('Query Data File Service', () => {
  const documentName = 'example.soql';
  beforeEach(() => {});
  afterEach(() => {
    // delete all the files created or just the query dir.
  });

  it('should use the correct data provider', () => {
    const csvFileService = new TestFileService(
      mockQueryData,
      FileFormat.CSV,
      documentName
    );
    expect(csvFileService.getDataProvider()).instanceOf(CsvDataProvider);

    const jsonFileService = new TestFileService(
      mockQueryData,
      FileFormat.JSON,
      documentName
    );
    expect(jsonFileService.getDataProvider()).instanceOf(JsonDataProvider);
  });
});
