import { ChannelService } from '@salesforce/salesforcedx-utils-vscode/src/commands';
import {
  ForceSourcePullExecutor,
  ForceSourcePushExecutor
} from '../../../../src/commands';
import { CommandParams } from '../../../../src/commands/util';
import { dummyPullOutput } from '../../../../src/commands/util/testData';
import { FORCE_SOURCE_PULL_LOG_NAME } from '../../../../src/constants';
import { DeployType } from '../../../../src/commands/baseDeployCommand';
import { notificationService } from '../../../../src/notifications';
import { dummyStdOut } from '../data/testData';
import { SfdxCommandlet } from '@salesforce/salesforcedx-utils-vscode/src';

describe('SfdxCommandletExecutor', () => {
  describe('execute', () => {
    it('should update the local cache for the components that were retrieved after a pull', () => {
      const flag = undefined;
      const pullCommand: CommandParams = {
        command: 'force:source:pull',
        description: {
          default: 'force_source_pull_default_org_text',
          forceoverwrite: 'force_source_pull_force_default_org_text'
        },
        logName: { default: FORCE_SOURCE_PULL_LOG_NAME }
      };
      const executor = new ForceSourcePullExecutor(flag, pullCommand);
      const updateCacheAfterPushPullMock = jest.spyOn(
        executor as any,
        'updateCache'
      );
      jest.spyOn(ChannelService.prototype, 'clear');

      // executor.execute({ type: 'CONTINUE', data: '' });
      (executor as any).exitProcessHandler(
        0,
        { command: { logName: FORCE_SOURCE_PULL_LOG_NAME } },
        '',
        '',
        '',
        dummyPullOutput
      );

      expect(updateCacheAfterPushPullMock).toHaveBeenCalled();
    });

    describe('parseOutput', () => {
      let showWarningMessageMock: jest.SpyInstance;
      let parseSpy: jest.SpyInstance;

      beforeEach(() => {
        showWarningMessageMock = jest
          .spyOn(notificationService, 'showWarningMessage')
          .mockImplementation(jest.fn());

        parseSpy = jest.spyOn(JSON, 'parse');
      });

      it('should parse well formatted response and return JSON', () => {
        // Arrange
        const pushCommand: CommandParams = {
          command: 'force:source:push',
          description: {
            default: 'force_source_push_default_org_text',
            forceoverwrite: 'force_source_push_force_default_org_text'
          },
          logName: { default: 'force_source_push_default_scratch_org' }
        };
        const flag = '';
        const executor = new ForceSourcePushExecutor(flag, pushCommand);
        const a = jest.spyOn(executor as any, 'parseOutput');

        // Act
        const parsed = (executor as any).parseOutput(dummyStdOut);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(dummyStdOut);
        // expect(a).not.toThrow();
      });

      it('should show a message to the User if there is a parsing error', async () => {
        // Arrange
        const pushCommand: CommandParams = {
          command: 'force:source:push',
          description: {
            default: 'force_source_push_default_org_text',
            forceoverwrite: 'force_source_push_force_default_org_text'
          },
          logName: { default: 'force_source_push_default_scratch_org' }
        };
        const flag = '';
        const executor = new ForceSourcePushExecutor(flag, pushCommand);
        const updateCacheMock = jest.fn();
        const executorAsAny = executor as any;
        executorAsAny.updateCache = updateCacheMock;
        executorAsAny.getDeployType = jest
          .fn()
          .mockReturnValue(DeployType.Push);
        executorAsAny.logMetric = jest.fn();

        try {
          // Act
          (executor as any).parseOutput('{abcdef}');
        } catch (error) {
          // Assert
          expect(error).toBeInstanceOf(Error);
          expect(updateCacheMock).not.toHaveBeenCalled();
          expect(showWarningMessageMock).toHaveBeenCalled();
        }
      });
    });
  });
});
