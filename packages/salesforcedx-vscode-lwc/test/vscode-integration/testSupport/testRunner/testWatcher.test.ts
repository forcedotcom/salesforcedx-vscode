/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, SinonStub, stub } from 'sinon';
import { telemetryService } from '../../../../src/telemetry';
import { testWatcher } from '../../../../src/testSupport/testRunner/testWatcher';
import { FORCE_LWC_TEST_WATCH_LOG_NAME } from '../../../../src/testSupport/types/constants';
import {
  createMockTestFileInfo,
  mockGetLwcTestRunnerExecutable,
  mockSfdxTaskExecute,
  unmockGetLwcTestRunnerExecutable,
  unmockSfdxTaskExecute
} from '../mocks';

describe('Test Watcher', () => {
  describe('Telemetry for watching tests', () => {
    let telemetryStub: SinonStub<
      [(string | undefined)?, ([number, number] | undefined)?, any?],
      Promise<void>
    >;
    let processHrtimeStub: SinonStub<
      [([number, number] | undefined)?],
      [number, number]
    >;
    beforeEach(() => {
      telemetryStub = stub(telemetryService, 'sendCommandEvent');
      telemetryStub.returns(Promise.resolve());
      processHrtimeStub = stub(process, 'hrtime');
      mockSfdxTaskExecute(true);
      mockGetLwcTestRunnerExecutable();
    });
    afterEach(() => {
      processHrtimeStub.restore();
      telemetryStub.restore();
      unmockSfdxTaskExecute();
      unmockGetLwcTestRunnerExecutable();
    });

    it('Should send telemetry for watching tests', async () => {
      const testExecutionInfo = createMockTestFileInfo();
      const mockExecutionTime: [number, number] = [123, 456];
      processHrtimeStub.returns(mockExecutionTime);
      await testWatcher.watchTest(testExecutionInfo);
      assert.calledOnce(telemetryStub);
      assert.calledWith(
        telemetryStub,
        FORCE_LWC_TEST_WATCH_LOG_NAME,
        mockExecutionTime,
        {
          workspaceType: 'SFDX'
        }
      );
    });
  });
});
