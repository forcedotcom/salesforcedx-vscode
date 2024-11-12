/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { QueryResult } from '@jsforce/jsforce-node';
import { JsonMap } from '@salesforce/ts-types';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileFormat, QueryDataFileService } from '../../../src/queryDataView/queryDataFileService';

describe('Query Data File Service', () => {
  const queryText = 'SELECT Id, Name FROM Account';
  const queryData: QueryResult<JsonMap> = {
    done: true,
    totalSize: 1,
    records: [{ Id: '123' }]
  };
  const document = {
    uri: { fsPath: '/path/to/file' }
  } as unknown as vscode.TextDocument;

  it('should save the file and return the file path', async () => {
    const format = FileFormat.JSON;
    const savedFilePath = '/test/path/to/savedFile.json';

    const queryDataFileService = new QueryDataFileService(queryText, queryData, format, document);

    jest.spyOn(path, 'parse').mockReturnValue({ dir: '/test/' } as any);

    (vscode.window.showSaveDialog as any).mockReturnValue({
      fsPath: savedFilePath
    });

    const writeFileSpy = jest.spyOn(vscode.workspace.fs, 'writeFile');

    const selectedFilePath = await queryDataFileService.save();

    expect(writeFileSpy).toHaveBeenCalled();
    expect(selectedFilePath).toEqual(savedFilePath);
  });
});
