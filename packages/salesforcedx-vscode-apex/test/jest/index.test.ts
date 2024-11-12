/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexLanguageClient } from '../../src/apexLanguageClient';
import { API } from '../../src/constants';
import * as index from '../../src/index';
import { languageClientUtils } from '../../src/languageUtils';
import { extensionUtils } from '../../src/languageUtils/extensionUtils';
import { getTelemetryService } from '../../src/telemetry/telemetry';
import ApexLSPStatusBarItem from './../../src/apexLspStatusBarItem';
import { MockTelemetryService } from './telemetry/mockTelemetryService';

jest.mock('./../../src/apexLspStatusBarItem');
jest.mock('../../src/telemetry/telemetry', () => ({
  getTelemetryService: jest.fn()
}));

describe('indexDoneHandler', () => {
  let setStatusSpy: jest.SpyInstance;
  let onNotificationSpy: jest.SpyInstance;
  let mockLanguageClient: any;
  let setClientReadySpy: jest.SpyInstance;
  const apexLSPStatusBarItemMock = jest.mocked(ApexLSPStatusBarItem);

  beforeEach(() => {
    setStatusSpy = jest.spyOn(languageClientUtils, 'setStatus').mockReturnValue();
    mockLanguageClient = {
      onNotification: jest.fn()
    };
    onNotificationSpy = jest.spyOn(mockLanguageClient, 'onNotification');
    setClientReadySpy = jest.spyOn(extensionUtils, 'setClientReady').mockResolvedValue();
  });

  it('should call languageClientUtils.setStatus and set up event listener when enableSyncInitJobs is false', async () => {
    const languageServerStatusBarItem = new ApexLSPStatusBarItem();
    await index.indexerDoneHandler(false, mockLanguageClient, languageServerStatusBarItem);
    expect(setStatusSpy).toHaveBeenCalledWith(1, '');
    expect(onNotificationSpy).toHaveBeenCalledWith(API.doneIndexing, expect.any(Function));
    expect(apexLSPStatusBarItemMock).toHaveBeenCalledTimes(1);

    const mockCallback = onNotificationSpy.mock.calls[0][1];

    await mockCallback();
    expect(setClientReadySpy).toHaveBeenCalledWith(mockLanguageClient, languageServerStatusBarItem);
  });

  it('should call setClientReady when enableSyncInitJobs is true', async () => {
    const languageServerStatusBarItem = new ApexLSPStatusBarItem();
    await index.indexerDoneHandler(true, mockLanguageClient, languageServerStatusBarItem);
    expect(setClientReadySpy).toHaveBeenCalledWith(mockLanguageClient, languageServerStatusBarItem);
    expect(apexLSPStatusBarItemMock).toHaveBeenCalledTimes(1);
  });
});

describe('deactivate', () => {
  let stopSpy: jest.SpyInstance;
  beforeEach(() => {
    stopSpy = jest.fn();
    (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    jest
      .spyOn(languageClientUtils, 'getClientInstance')
      .mockReturnValue({ stop: stopSpy } as unknown as ApexLanguageClient);
  });

  it('should call stop on the language client', async () => {
    await index.deactivate();
    expect(stopSpy).toHaveBeenCalled();
  });
});
