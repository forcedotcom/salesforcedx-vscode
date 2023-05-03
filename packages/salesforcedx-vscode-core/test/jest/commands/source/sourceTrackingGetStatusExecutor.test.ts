import {
  SourceTrackingService,
  WorkspaceContextUtil
} from '@salesforce/salesforcedx-utils-vscode/src';
import { SourceStatusSummary } from '@salesforce/salesforcedx-utils-vscode/src/services/sourceTrackingService';
import { channelService } from '../../../../src/channels';
import { SourceTrackingGetStatusExecutor } from '../../../../src/commands/source/sourceTrackingGetStatusExecutor';
// jest.mock('@salesforce/core', () => ({
//   ...jest.requireActual('@salesforce/core'),
//   Org: { create: jest.fn() },
//   SfProject: { resolve: jest.fn() }
// }));
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
describe('SourceTrackingGetStatusExecutor', () => {
  describe('execute', () => {
    const FAKE_WORKSPACE_INSTANCE: any = { getConnection: jest.fn() };
    let getStatusSummaryMock: jest.SpyInstance;
    let createSourceTrackingSpy: jest.SpyInstance;
    const getStatusSpy = jest.fn();
    const formatSpy = jest.fn();
    const appendSpy = jest.fn();
    const showOutputSpy = jest.fn();

    beforeEach(() => {
      jest
        .spyOn(WorkspaceContextUtil, 'getInstance')
        .mockReturnValue(FAKE_WORKSPACE_INSTANCE);

      getStatusSummaryMock = jest.spyOn(
        SourceTrackingService,
        'getSourceStatusSummary'
      );
      createSourceTrackingSpy = jest
        .spyOn(SourceTrackingService, 'createSourceTracking')
        .mockResolvedValue({ getStatus: getStatusSpy } as any);
      jest
        .spyOn(SourceStatusSummary.prototype, 'format')
        .mockImplementation(formatSpy);
      jest.spyOn(channelService, 'appendLine').mockImplementation(appendSpy);
      jest
        .spyOn(channelService, 'showChannelOutput')
        .mockImplementation(showOutputSpy);
    });

    it('should get the source status summary and show it in the output', async () => {
      const executor = new SourceTrackingGetStatusExecutor('', '', {
        local: true,
        remote: true
      });

      await executor.execute();

      expect(createSourceTrackingSpy).toHaveBeenCalled();
      expect(getStatusSpy).toHaveBeenCalled();
      expect(formatSpy).toHaveBeenCalled();
      expect(showOutputSpy).toHaveBeenCalled();
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
