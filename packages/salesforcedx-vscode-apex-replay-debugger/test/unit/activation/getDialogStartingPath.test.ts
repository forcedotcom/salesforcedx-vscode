import { LAST_OPENED_LOG_FOLDER_KEY } from '@salesforce/salesforcedx-apex-replay-debugger/src';
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as pathExists from 'path-exists';
import * as vscode from 'vscode';
import { dialogStartingPath } from '../../../src/activation/getDialogStartingPath';

describe('getDialogStartingPath', () => {
  const testPath = '/here/is/a/fake/path/to/';
  let hasRootWorkspaceStub: jest.SpyInstance;
  let pathExistsMock: jest.SpyInstance;
  let vsCodeUriMock: jest.SpyInstance;

  beforeEach(() => {
    hasRootWorkspaceStub = jest.spyOn(workspaceUtils, 'hasRootWorkspace');
    pathExistsMock = jest.spyOn(pathExists, 'sync').mockReturnValue(true);
    vsCodeUriMock = jest
      .spyOn(vscode.Uri, 'file')
      .mockReturnValue({ path: testPath } as vscode.Uri);
  });

  it('Should return last opened log folder', () => {
    hasRootWorkspaceStub.mockReturnValue(true);
    const mockGet = jest.fn().mockReturnValue(testPath);
    const mockExtensionContext: any = { workspaceState: { get: mockGet } };

    // Act
    const dialogStartingPathUri = dialogStartingPath.getDialogStartingPathUri(
      mockExtensionContext
    );

    expect(hasRootWorkspaceStub).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(pathExistsMock).toHaveBeenCalledWith(testPath);
    expect(vsCodeUriMock).toHaveBeenCalledWith(testPath);
    expect((dialogStartingPathUri as vscode.Uri).path).toEqual(testPath);
  });

  it('Should return log folder', async () => {
    hasRootWorkspaceStub.mockReturnValue(true);
  });

  it('Should return state folder', async () => {
    hasRootWorkspaceStub.mockReturnValue(true);
  });

  it('Should return undefined when not in a project workspace', async () => {
    hasRootWorkspaceStub.mockReturnValue(false);
    const mockGet = jest.fn().mockReturnValue(testPath);
    const mockExtensionContext: any = { workspaceState: { get: mockGet } };

    // Act
    const dialogStartingPathUri = dialogStartingPath.getDialogStartingPathUri(
      mockExtensionContext
    );

    expect(dialogStartingPathUri as vscode.Uri).toEqual(undefined);
  });
});
