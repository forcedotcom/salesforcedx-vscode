/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, SinonStub, stub } from 'sinon';
import { telemetryService } from '../../../../src/telemetry';
import { testWatcher } from '../../../../src/testSupport/testRunner/testWatcher';
import { LWC_TEST_WATCH_LOG_NAME } from '../../../../src/testSupport/types/constants';
import {
  createMockTestFileInfo,
  mockGetLwcTestRunnerExecutable,
  mockSfTaskExecute,
  unmockGetLwcTestRunnerExecutable,
  unmockSfTaskExecute
} from '../mocks';
import { expect } from 'chai';

describe('Test Watcher', () => {
  describe('Telemetry for watching tests', () => {
    let telemetryStub: SinonStub<
      [(string | undefined)?, ([number, number] | undefined)?, any?, any?],
      void
    >;
    let processHrtimeStub: SinonStub<
      [([number, number] | undefined)?],
      [number, number]
    >;
    beforeEach(() => {
      telemetryStub = stub(telemetryService, 'sendCommandEvent');
      processHrtimeStub = stub(process, 'hrtime');
      mockSfTaskExecute(true);
      mockGetLwcTestRunnerExecutable();
    });
    afterEach(() => {
      processHrtimeStub.restore();
      telemetryStub.restore();
      unmockSfTaskExecute();
      unmockGetLwcTestRunnerExecutable();
    });

    it('Should remove test from tests being watched on ending watch task', async () => {
      const testExecutionInfo = createMockTestFileInfo();
      const task = await testWatcher.watchTest(testExecutionInfo);
      expect(testWatcher.isWatchingTest(testExecutionInfo.testUri)).to.equal(
        true
      );
      // For test purpose, simulate ending watch task by notifyEndTask
      task!.notifyEndTask();
      expect(testWatcher.isWatchingTest(testExecutionInfo.testUri)).to.equal(
        false
      );

      // Terminate and clean up task
      task!.terminate();
    });

    it('Should send telemetry for watching tests', async () => {
      const testExecutionInfo = createMockTestFileInfo();
      const mockExecutionTime: [number, number] = [123, 456];
      processHrtimeStub.returns(mockExecutionTime);
      await testWatcher.watchTest(testExecutionInfo);
      assert.calledOnce(telemetryStub);
      assert.calledWith(
        telemetryStub,
        LWC_TEST_WATCH_LOG_NAME,
        mockExecutionTime,
        {
          workspaceType: 'SFDX'
        }
      );
    });
  });
});
