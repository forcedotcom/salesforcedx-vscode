/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { QUERY_RESULTS_DIR_PATH } from '../../../src/constants';
import {
  CsvDataProvider,
  JsonDataProvider
} from '../../../src/queryDataView/dataProviders';
import { FileFormat } from '../../../src/queryDataView/queryDataFileService';
import { mockQueryData, TestFileService } from '../testUtilities';

describe('Query Data File Service', () => {
  const documentName = 'example.soql';
  const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const testResultsDirPath = path.join(workspacePath, QUERY_RESULTS_DIR_PATH);

  afterEach(() => {
    // delete the query-results directory and its files.
    // @ts-ignore
    fs.rmdirSync(testResultsDirPath, { recursive: true });
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

  it('will save json file to disk on save', () => {
    const jsonFileService = new TestFileService(
      mockQueryData,
      FileFormat.JSON,
      documentName
    );

    const savedFilePath = jsonFileService.save();
    const savedFileContent = fs.readFileSync(savedFilePath, 'utf8');
    expect(JSON.parse(savedFileContent)).to.eql(mockQueryData.records);
  });
});
