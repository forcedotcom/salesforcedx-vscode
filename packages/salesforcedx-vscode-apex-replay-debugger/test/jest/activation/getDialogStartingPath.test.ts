/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LAST_OPENED_LOG_FOLDER_KEY } from '@salesforce/salesforcedx-apex-replay-debugger';
import { projectPaths, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getDialogStartingPath } from '../../../src/activation/getDialogStartingPath';

jest.mock('vscode');

describe('getDialogStartingPath', () => {
  const testPath = '/here/is/a/fake/path/to/';
  let hasRootWorkspaceStub: jest.SpyInstance;
  let mockGet: jest.SpyInstance;
  let mockExtensionContext: any;
  let vsCodeUriMock: jest.SpyInstance;
  let debugLogsFolderMock: jest.SpyInstance;
  let stateFolderMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    hasRootWorkspaceStub = jest.spyOn(workspaceUtils, 'hasRootWorkspace');
    mockGet = jest.fn();
    mockExtensionContext = {
      workspaceState: { get: mockGet }
    };
    vsCodeUriMock = jest.spyOn(URI, 'file');
    debugLogsFolderMock = jest.spyOn(projectPaths, 'debugLogsFolder');
    stateFolderMock = jest.spyOn(projectPaths, 'stateFolder');

    // Mock VSCode workspace.fs.stat to return directory type (exists)
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.Directory });
  });

  it('Should return last opened log folder if present', async () => {
    hasRootWorkspaceStub.mockReturnValue(true);
    mockGet.mockReturnValue(testPath);
    vsCodeUriMock.mockReturnValue({ path: testPath } as URI);

    // Act
    const dialogStartingPathUri = await getDialogStartingPath(mockExtensionContext);

    expect(hasRootWorkspaceStub).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(vscode.workspace.fs.stat).toHaveBeenCalled();
    expect(vsCodeUriMock).toHaveBeenCalledWith(testPath);
    expect((dialogStartingPathUri as URI).path).toEqual(testPath);
  });

  it('Should return project log folder when last opened log folder not present', async () => {
    hasRootWorkspaceStub.mockReturnValue(true);
    mockGet.mockReturnValue(undefined);
    const fakePathToDebugLogsFolder = 'path/to/debug/logs';
    debugLogsFolderMock.mockReturnValue(fakePathToDebugLogsFolder);
    vsCodeUriMock.mockReturnValue({
      path: fakePathToDebugLogsFolder
    } as URI);

    // Act
    const dialogStartingPathUri = await getDialogStartingPath(mockExtensionContext);

    expect(hasRootWorkspaceStub).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(vscode.workspace.fs.stat).toHaveBeenCalled();
    expect(vsCodeUriMock).toHaveBeenCalledWith(fakePathToDebugLogsFolder);
    expect((dialogStartingPathUri as URI).path).toEqual(fakePathToDebugLogsFolder);
  });

  it('Should return state folder as fallback when project log folder not present', async () => {
    hasRootWorkspaceStub.mockReturnValue(true);
    mockGet.mockReturnValue(undefined);
    const fakePathToDebugLogsFolder = 'path/to/debug/logs';
    debugLogsFolderMock.mockReturnValue(fakePathToDebugLogsFolder);
    // Mock that the debug logs folder doesn't exist
    (vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error('Not found'));
    const fakePathToStateFolder = 'path/to/state';
    stateFolderMock.mockReturnValue(fakePathToStateFolder);
    vsCodeUriMock.mockReturnValue({
      path: fakePathToStateFolder
    } as URI);

    // Act
    const dialogStartingPathUri = await getDialogStartingPath(mockExtensionContext);

    expect(hasRootWorkspaceStub).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(vscode.workspace.fs.stat).toHaveBeenCalled();
    expect(vsCodeUriMock).toHaveBeenCalledWith(fakePathToStateFolder);
    expect((dialogStartingPathUri as URI).path).toEqual(fakePathToStateFolder);
  });

  it('Should return undefined when not in a project workspace', async () => {
    hasRootWorkspaceStub.mockReturnValue(false);
    mockGet.mockReturnValue(testPath);

    // Act
    const dialogStartingPathUri = await getDialogStartingPath(mockExtensionContext);

    expect(dialogStartingPathUri as URI).toEqual(undefined);
  });
});
