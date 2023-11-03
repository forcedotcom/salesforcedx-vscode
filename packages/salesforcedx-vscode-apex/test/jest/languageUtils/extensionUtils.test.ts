import ApexLSPStatusBarItem from '../../../src/apexLspStatusBarItem';
import { ClientStatus, languageClientUtils } from '../../../src/languageUtils';
import { extensionUtils } from '../../../src/languageUtils';
import * as testOutlineProvider from '../../../src/views/testOutlineProvider';

jest.mock('../../../src/apexLspStatusBarItem');
describe('extensionUtils Unit Tests.', () => {
  const apexLspStatusBarItemMock = jest.mocked(ApexLSPStatusBarItem);
  let refreshSpy: jest.SpyInstance;
  let readySpy: jest.SpyInstance;
  let setStatusSpy: jest.SpyInstance;
  let serviceHasStartedSuccessfullySpy: jest.SpyInstance;
  let languageServerStatusBarItem: ApexLSPStatusBarItem;
  let getTestOutlineProviderSpy: jest.SpyInstance;
  let mockTestOutlineProviderInst;
  let mockLanguageClient: any;

  beforeEach(() => {
    mockTestOutlineProviderInst = {
      refresh: jest.fn(() => Promise.resolve())
    };
    getTestOutlineProviderSpy = jest
      .spyOn(testOutlineProvider, 'getTestOutlineProvider')
      .mockReturnValue(mockTestOutlineProviderInst as any);

    languageServerStatusBarItem = new ApexLSPStatusBarItem();
    refreshSpy = jest
      .spyOn(mockTestOutlineProviderInst, 'refresh')
      .mockResolvedValue();
    readySpy = jest.spyOn(languageServerStatusBarItem, 'ready');
    setStatusSpy = jest
      .spyOn(languageClientUtils, 'setStatus')
      .mockReturnValue();
    mockLanguageClient = {
      errorHandler: {
        serviceHasStartedSuccessfully: jest.fn()
      }
    };
    serviceHasStartedSuccessfullySpy = jest.spyOn(
      mockLanguageClient.errorHandler,
      'serviceHasStartedSuccessfully'
    );
  });

  it('should be executed as expected', async () => {
    await extensionUtils.setClientReady(
      mockLanguageClient,
      languageServerStatusBarItem
    );
    expect(getTestOutlineProviderSpy).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
    expect(readySpy).toHaveBeenCalled();
    expect(setStatusSpy).toHaveBeenCalledWith(ClientStatus.Ready, '');
    expect(serviceHasStartedSuccessfullySpy).toHaveBeenCalled();
    expect(apexLspStatusBarItemMock).toHaveBeenCalledTimes(1);
  });
});
