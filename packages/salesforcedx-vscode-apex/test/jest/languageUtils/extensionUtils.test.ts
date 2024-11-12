/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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
    refreshSpy = jest.spyOn(mockTestOutlineProviderInst, 'refresh').mockResolvedValue();
    readySpy = jest.spyOn(languageServerStatusBarItem, 'ready');
    setStatusSpy = jest.spyOn(languageClientUtils, 'setStatus').mockReturnValue();
    mockLanguageClient = {
      errorHandler: {
        serviceHasStartedSuccessfully: jest.fn()
      }
    };
    serviceHasStartedSuccessfullySpy = jest.spyOn(mockLanguageClient.errorHandler, 'serviceHasStartedSuccessfully');
  });

  it('should be executed as expected', async () => {
    await extensionUtils.setClientReady(mockLanguageClient, languageServerStatusBarItem);
    expect(getTestOutlineProviderSpy).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
    expect(readySpy).toHaveBeenCalled();
    expect(setStatusSpy).toHaveBeenCalledWith(ClientStatus.Ready, '');
    expect(serviceHasStartedSuccessfullySpy).toHaveBeenCalled();
    expect(apexLspStatusBarItemMock).toHaveBeenCalledTimes(1);
  });
});
