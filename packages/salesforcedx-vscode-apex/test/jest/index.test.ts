import { API } from '../../src/constants';
import * as index from '../../src/index';
import { languageClientUtils } from '../../src/languageUtils';
import { extensionUtils } from '../../src/languageUtils/extensionUtils';
import ApexLSPStatusBarItem from './../../src/apexLspStatusBarItem';
import * as vscode from 'vscode';

jest.mock('./../../src/apexLspStatusBarItem');
const ApexLSPStatusBarItemMock = jest.mocked(ApexLSPStatusBarItem);

describe('indexDoneHandler', () => {
  let setStatusSpy: jest.SpyInstance;
  let onNotificationSpy: jest.SpyInstance;
  let mockLanguageClient: any;
  let setClientReadySpy: jest.SpyInstance;

  beforeEach(() => {
    setStatusSpy = jest
      .spyOn(languageClientUtils, 'setStatus')
      .mockReturnValue();
    mockLanguageClient = {
      onNotification: jest.fn()
    };
    onNotificationSpy = jest.spyOn(mockLanguageClient, 'onNotification');
    setClientReadySpy = jest
      .spyOn(extensionUtils, 'setClientReady')
      .mockResolvedValue();
  });

  it('should call languageClientUtils.setStatus and set up event listener when enableSyncInitJobs is false', async () => {
    const languageServerStatusBarItem = new ApexLSPStatusBarItem();
    await index.indexerDoneHandler(
      false,
      mockLanguageClient as any,
      languageServerStatusBarItem
    );
    expect(setStatusSpy).toHaveBeenCalled();
    expect(setStatusSpy).toHaveBeenCalledWith(1, '');
    expect(onNotificationSpy).toHaveBeenCalled();
    expect(onNotificationSpy).toHaveBeenCalledWith(
      API.doneIndexing,
      expect.any(Function)
    );
    expect(ApexLSPStatusBarItemMock).toHaveBeenCalledTimes(1);

    const mockCallback = onNotificationSpy.mock.calls[0][1];

    await mockCallback();
    expect(setClientReadySpy).toHaveBeenCalledWith(
      mockLanguageClient,
      languageServerStatusBarItem
    );
  });

  it('should call setClientReady when enableSyncInitJobs is true', async () => {
    const languageServerStatusBarItem = new ApexLSPStatusBarItem();
    await index.indexerDoneHandler(
      true,
      mockLanguageClient as any,
      languageServerStatusBarItem
    );
    expect(setClientReadySpy).toHaveBeenCalledWith(
      mockLanguageClient,
      languageServerStatusBarItem
    );
  });

  //TODO: delete these two tests...only used to verify vscode mocks are reset
  it('should reset mocks between calls 1.', () => {
    const ext = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-apex'
    );
    expect(vscode.extensions.getExtension).toHaveBeenCalledTimes(1);
  });

  it('should reset mocks between calls 2.', () => {
    const ext = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-apex'
    );
    expect(vscode.extensions.getExtension).toHaveBeenCalledTimes(1);
  });
});
