import { LAST_OPENED_LOG_FOLDER_KEY } from '@salesforce/salesforcedx-apex-replay-debugger/src';
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { dialogStartingPath } from '../../../src/activation/getDialogStartingPath';

describe('getDialogStartingPath', () => {
  let hasRootWorkspaceStub: jest.SpyInstance;
  let getLastOpenedLogFolderMock: jest.SpyInstance;
  let folderExistsMock: jest.SpyInstance;
  let getUriForMock: jest.SpyInstance;
  const testPath = '/here/is/a/fake/path/to/';

  beforeEach(() => {
    hasRootWorkspaceStub = jest.spyOn(workspaceUtils, 'hasRootWorkspace');
    getLastOpenedLogFolderMock = jest
      .spyOn(dialogStartingPath, 'getLastOpenedLogFolder')
      .mockReturnValue(testPath);
    folderExistsMock = jest
      .spyOn(dialogStartingPath, 'folderExists')
      .mockReturnValue(true);
    getUriForMock = jest
      .spyOn(dialogStartingPath, 'getUriFor')
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
    expect(getLastOpenedLogFolderMock).toHaveBeenCalledWith(
      mockExtensionContext
    );
    expect(mockGet).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY);
    expect(folderExistsMock).toHaveBeenCalledWith(testPath);
    expect((dialogStartingPathUri as vscode.Uri).path).toEqual(testPath);
  });

  // it('Should return log folder', async () => {});

  // it('Should return state folder', async () => {});

  // it('Should return undefined', async () => {});
});
