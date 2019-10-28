/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, SinonStub, stub } from 'sinon';
import { telemetryService } from '../../../../src/telemetry';
import { forceLwcTestRun } from '../../../../src/testSupport/commands/forceLwcTestRunAction';
import { FORCE_LWC_TEST_RUN_LOG_NAME } from '../../../../src/testSupport/types/constants';
import {
  createMockTestFileInfo,
  mockGetLwcTestRunnerExecutable,
  mockSfdxTaskExecute,
  unmockGetLwcTestRunnerExecutable,
  unmockSfdxTaskExecute
} from '../mocks';

describe('Force LWC Test Run - Code Action', () => {
  describe('Telemetry for running tests', () => {
    let telemetryStub: SinonStub;
    let processHrtimeStub: SinonStub;
    beforeEach(() => {
      telemetryStub = stub(telemetryService, 'sendCommandEvent');
      processHrtimeStub = stub(process, 'hrtime');
      mockSfdxTaskExecute(true);
      mockGetLwcTestRunnerExecutable();
    });

    afterEach(() => {
      telemetryStub.restore();
      processHrtimeStub.restore();
      unmockGetLwcTestRunnerExecutable();
      unmockSfdxTaskExecute();
    });

    it('Should send telemetry for running tests', async () => {
      const testExecutionInfo = createMockTestFileInfo();
      const mockExecutionTime = [123, 456];
      processHrtimeStub.returns(mockExecutionTime);
      await forceLwcTestRun(testExecutionInfo);
      assert.calledOnce(telemetryStub);
      assert.calledWith(
        telemetryStub,
        FORCE_LWC_TEST_RUN_LOG_NAME,
        mockExecutionTime
      );

      processHrtimeStub.restore();
    });
  });
});
