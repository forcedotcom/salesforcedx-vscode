/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  CsvDataProvider,
  JsonDataProvider
} from '../../src/queryDataView/dataProviders';
import { FileFormat } from '../../src/queryDataView/queryDataFileService';
import {
  mockQueryData,
  mockQueryText,
  MockTextDocumentProvider,
  TestFileService
} from '../vscode-integration/testUtilities';

const QUERY_RESULTS_DIR_PATH = path.join('scripts', 'soql', 'query-results');

jest.mock('vscode');

describe('Query Data File Service', () => {
  let mockTextDocument: vscode.TextDocument;
  let docProviderDisposable: vscode.Disposable;
  const documentName = 'example.soql';
  const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const testResultsDirPath = path.join(workspacePath, QUERY_RESULTS_DIR_PATH);
  const mockUriPath = path.join(testResultsDirPath, documentName);

  function createResultsDirectory() {
    fs.mkdirSync(testResultsDirPath, {
      recursive: true
    });
  }

  beforeEach(async () => {
    jest.resetModules();
    docProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
      'sfdc-test',
      new MockTextDocumentProvider()
    );
    mockTextDocument = await vscode.workspace.openTextDocument(
      vscode.Uri.parse('sfdc-test:test/examples/soql/mocksoql.soql')
    );
    createResultsDirectory();
  });

  afterEach(() => {
    // delete the query-results directory and its files.
    // @ts-ignore
    fs.rmSync(testResultsDirPath, { recursive: true });
  });

  test('should use the correct data provider', () => {
    const csvFileService = new TestFileService(
      mockQueryText,
      mockQueryData,
      FileFormat.CSV,
      mockTextDocument
    );
    expect(csvFileService.getDataProvider()).toBeInstanceOf(CsvDataProvider);

    const jsonFileService = new TestFileService(
      mockQueryText,
      mockQueryData,
      FileFormat.JSON,
      mockTextDocument
    );
    expect(jsonFileService.getDataProvider()).toBeInstanceOf(JsonDataProvider);
  });

  test('should save json file to disk on save', async () => {
    const jsonFileService = new TestFileService(
      mockQueryText,
      mockQueryData,
      FileFormat.JSON,
      mockTextDocument
    );

    const mockURI = {
      fsPath: mockUriPath
    } as vscode.Uri;
    (vscode.window.showSaveDialog as any).mockResolvedValue(mockURI);

    const savedFilePath = await jsonFileService.save();
    const savedFileContent = fs.readFileSync(savedFilePath, 'utf8');
    expect(JSON.parse(savedFileContent)).toEqual(mockQueryData.records);
  });

  test('should save csv to file to disk on save', async () => {
    const csvFileService = new TestFileService(
      mockQueryText,
      mockQueryData,
      FileFormat.CSV,
      mockTextDocument
    );

    const mockURI = {
      fsPath: mockUriPath
    } as vscode.Uri;
    (vscode.window.showSaveDialog as any).mockResolvedValue(mockURI);

    const savedFilePath = await csvFileService.save();
    const savedFileContent = fs.readFileSync(savedFilePath, 'utf8');
    const mockCsvData = csvFileService
      .getDataProvider()
      .getFileContent(mockQueryText, mockQueryData.records);

    expect(savedFileContent).toEqual(mockCsvData);
  });
});
