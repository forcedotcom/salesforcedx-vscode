/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LAST_OPENED_LOG_FOLDER_KEY } from '@salesforce/salesforcedx-apex-replay-debugger/src';
import { projectPaths, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getDialogStartingPath } from '../../../src/activation/getDialogStartingPath';

describe('getDialogStartingPath', () => {
  const testPath = '/here/is/a/fake/path/to/';
  let hasRootWorkspaceStub: jest.SpyInstance;
  let mockGet: jest.SpyInstance;
  let mockExtensionContext: any;
  let pathExistsMock: jest.SpyInstance;
  let vsCodeUriMock: jest.SpyInstance;
  let debugLogsFolderMock: jest.SpyInstance;
  let stateFolderMock: jest.SpyInstance;

  beforeEach(() => {
    hasRootWorkspaceStub = jest.spyOn(workspaceUtils, 'hasRootWorkspace');
    mockGet = jest.fn();
    mockExtensionContext = {
      workspaceState: { get: mockGet }
    };
    pathExistsMock = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    vsCodeUriMock = jest.spyOn(vscode.Uri, 'file');
    debugLogsFolderMock = jest.spyOn(projectPaths, 'debugLogsFolder');
    stateFolderMock = jest.spyOn(projectPaths, 'stateFolder');
  });

  it('Should return last opened log folder if present', () => {
    hasRootWorkspaceStub.mockReturnValue(true);
    mockGet.mockReturnValue(testPath);
    vsCodeUriMock.mockReturnValue({ path: testPath } as vscode.Uri);

    // Act
    const dialogStartingPathUri = getDialogStartingPath(mockExtensionContext);

    expect(hasRootWorkspaceStub).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(pathExistsMock).toHaveBeenCalledWith(testPath);
    expect(vsCodeUriMock).toHaveBeenCalledWith(testPath);
    expect((dialogStartingPathUri as vscode.Uri).path).toEqual(testPath);
  });

  it('Should return project log folder when last opened log folder not present', async () => {
    hasRootWorkspaceStub.mockReturnValue(true);
    mockGet.mockReturnValue(undefined);
    const fakePathToDebugLogsFolder = 'path/to/debug/logs';
    debugLogsFolderMock.mockReturnValue(fakePathToDebugLogsFolder);
    vsCodeUriMock.mockReturnValue({
      path: fakePathToDebugLogsFolder
    } as vscode.Uri);

    // Act
    const dialogStartingPathUri = getDialogStartingPath(mockExtensionContext);

    expect(hasRootWorkspaceStub).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(pathExistsMock).toHaveBeenCalledWith(fakePathToDebugLogsFolder);
    expect(vsCodeUriMock).toHaveBeenCalledWith(fakePathToDebugLogsFolder);
    expect((dialogStartingPathUri as vscode.Uri).path).toEqual(fakePathToDebugLogsFolder);
  });

  it('Should return state folder as fallback when project log folder not present', async () => {
    hasRootWorkspaceStub.mockReturnValue(true);
    mockGet.mockReturnValue(undefined);
    const fakePathToDebugLogsFolder = 'path/to/debug/logs';
    debugLogsFolderMock.mockReturnValue(fakePathToDebugLogsFolder);
    pathExistsMock.mockReturnValueOnce(false);
    const fakePathToStateFolder = 'path/to/state';
    stateFolderMock.mockReturnValue(fakePathToStateFolder);
    vsCodeUriMock.mockReturnValue({
      path: fakePathToStateFolder
    } as vscode.Uri);

    // Act
    const dialogStartingPathUri = getDialogStartingPath(mockExtensionContext);

    expect(hasRootWorkspaceStub).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(pathExistsMock).toHaveBeenCalledWith(fakePathToDebugLogsFolder);
    expect(vsCodeUriMock).toHaveBeenCalledWith(fakePathToStateFolder);
    expect((dialogStartingPathUri as vscode.Uri).path).toEqual(fakePathToStateFolder);
  });

  it('Should return undefined when not in a project workspace', async () => {
    hasRootWorkspaceStub.mockReturnValue(false);
    mockGet.mockReturnValue(testPath);

    // Act
    const dialogStartingPathUri = getDialogStartingPath(mockExtensionContext);

    expect(dialogStartingPathUri as vscode.Uri).toEqual(undefined);
  });
});
