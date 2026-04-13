/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { QueryResult } from '../../../src/types';
import { JsonMap } from '@salesforce/ts-types';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { FileFormat, QueryDataFileService } from '../../../src/queryDataView/queryDataFileService';

const mockRunPromise = jest.fn();
jest.mock('../../../src/services/extensionProvider', () => ({
  AllServicesLayer: require('effect/Layer').empty,
  getSoqlRuntime: () => ({ runFork: () => undefined, runPromise: mockRunPromise })
}));

describe('Query Data File Service', () => {
  const queryText = 'SELECT Id, Name FROM Account';
  const queryData: QueryResult<JsonMap> = {
    done: true,
    totalSize: 1,
    records: [{ Id: '123' }]
  };
  const document = {
    uri: URI.file('/path/to/file')
  } as unknown as vscode.TextDocument;

  it('should save the file and return the file path', async () => {
    const format = FileFormat.JSON;
    const savedFilePath = '/test/path/to/savedFile.json';
    const queryDataFileService = new QueryDataFileService(queryText, queryData, format, document);

    (vscode.window.showSaveDialog as any).mockReturnValue(URI.file(savedFilePath));
    mockRunPromise.mockResolvedValue('/test/workspace');

    const savedFileUri = await queryDataFileService.save();

    expect(mockRunPromise).toHaveBeenCalled();
    expect(savedFileUri?.fsPath).toEqual(URI.file(savedFilePath).fsPath);
  });

  it('strips .soql extension from the suggested save dialog filename', async () => {
    const soqlDocument = {
      uri: URI.file('/path/to/AAA.soql')
    } as unknown as vscode.TextDocument;

    for (const [format, expectedName] of [
      [FileFormat.CSV, 'AAA.csv'],
      [FileFormat.JSON, 'AAA.json']
    ] as const) {
      (vscode.window.showSaveDialog as any).mockClear();
      (vscode.window.showSaveDialog as any).mockReturnValue(undefined);

      const service = new QueryDataFileService(queryText, queryData, format, soqlDocument);
      await service.save();

      const calledWith = (vscode.window.showSaveDialog as jest.Mock).mock.calls[0][0];
      expect(calledWith.defaultUri.path.endsWith(expectedName)).toBe(true);
    }
  });
});
