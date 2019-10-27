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
    let telemetryStub: SinonStub;
    let processHrtimeStub: SinonStub;
    beforeEach(() => {
      telemetryStub = stub(telemetryService, 'sendCommandEvent');
      processHrtimeStub = stub(process, 'hrtime');
      mockSfdxTaskExecute();
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
      const mockExecutionTime = [123, 456];
      processHrtimeStub.returns(mockExecutionTime);
      await testWatcher.watchTest(testExecutionInfo);
      assert.calledOnce(telemetryStub);
      assert.calledWith(
        telemetryStub,
        FORCE_LWC_TEST_WATCH_LOG_NAME,
        mockExecutionTime
      );
    });
  });
});
