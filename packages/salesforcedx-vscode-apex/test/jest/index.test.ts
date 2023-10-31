import { API } from '../../src/constants';
import * as index from '../../src/index';
import { languageClientUtils } from '../../src/languageUtils';
import { extensionUtils } from '../../src/languageUtils/extensionUtils';
import ApexLSPStatusBarItem from './../../src/apexLspStatusBarItem';

jest.mock('./../../src/apexLspStatusBarItem');
describe('indexDoneHandler', () => {
  let setStatusSpy: jest.SpyInstance;
  let onNotificationSpy: jest.SpyInstance;
  let mockLanguageClient: any;
  let setClientReadySpy: jest.SpyInstance;
  const apexLSPStatusBarItemMock = jest.mocked(ApexLSPStatusBarItem);

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
    expect(apexLSPStatusBarItemMock).toHaveBeenCalledTimes(1);

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
});
