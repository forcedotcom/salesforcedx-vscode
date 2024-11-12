/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceTrackingService, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { channelService } from '../../../../src/channels';
import { SourceTrackingGetStatusExecutor } from '../../../../src/commands/source/sourceTrackingGetStatusExecutor';
import { nls } from '../../../../src/messages';

describe('SourceTrackingGetStatusExecutor', () => {
  beforeEach(() => {
    jest.spyOn(nls, 'localize').mockReturnValue('');
  });

  describe('execute', () => {
    const FAKE_WORKSPACE_INSTANCE: any = { getConnection: jest.fn() };
    let getSourceStatusSummaryMock: jest.SpyInstance;
    const appendSpy = jest.fn();
    const showChannelOutputSpy = jest.fn();
    const dummySourceStatusSummary = 'this is a source status summary';

    beforeEach(() => {
      jest.spyOn(WorkspaceContextUtil, 'getInstance').mockReturnValue(FAKE_WORKSPACE_INSTANCE);

      getSourceStatusSummaryMock = jest
        .spyOn(SourceTrackingService, 'getSourceStatusSummary')
        .mockResolvedValue(dummySourceStatusSummary);
      jest.spyOn(channelService, 'appendLine').mockImplementation(appendSpy);
      jest.spyOn(channelService, 'showChannelOutput').mockImplementation(showChannelOutputSpy);
    });

    it('should get the source status summary and show it in the output', async () => {
      const executor = new SourceTrackingGetStatusExecutor('', '', {
        local: true,
        remote: true
      });

      await executor.execute();

      expect(getSourceStatusSummaryMock).toHaveBeenCalled();
      expect(appendSpy).toHaveBeenCalledTimes(2);
      expect(appendSpy).toHaveBeenCalledWith(nls.localize('source_status'));
      expect(appendSpy).toHaveBeenCalledWith(dummySourceStatusSummary);
      expect(showChannelOutputSpy).toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('should call execute and return true', async () => {
      const executor = new SourceTrackingGetStatusExecutor('', '', {
        local: true,
        remote: true
      });
      const executeMock = jest.fn();
      (executor as any).execute = executeMock;

      const result = await (executor as any).run();

      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(true);
    });
  });
});
