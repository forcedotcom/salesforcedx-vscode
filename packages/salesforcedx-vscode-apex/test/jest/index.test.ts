import { API } from '../../src/constants';
import * as index from '../../src/index';
import { languageClientUtils } from '../../src/languageUtils';
import { extensionUtils } from '../../src/languageUtils/extensionUtils';

describe('indexDoneHandler', () => {
  let setStatusSpy: jest.SpyInstance;
  let onNotificationSpy: jest.SpyInstance;
  let mockLanguageClient: any;
  let setClientReadySpy: jest.SpyInstance;

  beforeEach( () => {
    setStatusSpy = jest.spyOn(languageClientUtils, 'setStatus').mockImplementation(jest.fn());
    mockLanguageClient = {
      onNotification: jest.fn()
    };
    onNotificationSpy = jest.spyOn(mockLanguageClient, 'onNotification');
    setClientReadySpy = jest.spyOn(extensionUtils, 'setClientReady').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call languageClientUtils.setStatus and set up event listener when enableSyncInitJobs is false', async () => {
    await index.indexerDoneHandler(false, mockLanguageClient as any);
    expect(setStatusSpy).toHaveBeenCalled();
    expect(setStatusSpy).toHaveBeenCalledWith(1, '');
    expect(onNotificationSpy).toHaveBeenCalled();
    expect(onNotificationSpy).toHaveBeenCalledWith(API.doneIndexing, expect.any(Function));
  });

  it('should call setClientReady when enableSyncInitJobs is true', async () => {
    await index.indexerDoneHandler(true, mockLanguageClient as any);
    expect(setClientReadySpy).toHaveBeenCalled();
  });
});
