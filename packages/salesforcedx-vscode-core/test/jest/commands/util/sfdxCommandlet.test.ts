/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ForcePullResultParser } from '@salesforce/salesforcedx-utils-vscode/src';
import {
  ForceSourcePullErrorResponse,
  ForceSourcePullSuccessResponse
} from '@salesforce/salesforcedx-utils-vscode/src/cli/pullResultParser';
import { channelService } from '../../../../src/channels';
import {
  ForceSourcePullExecutor,
  ForceSourcePushExecutor
} from '../../../../src/commands';
import { DeployType } from '../../../../src/commands/forceSourcePush';
import { CommandParams } from '../../../../src/commands/util';
import { PersistentStorageService } from '../../../../src/conflict';
import { FORCE_SOURCE_PULL_LOG_NAME } from '../../../../src/constants';
import { notificationService } from '../../../../src/notifications';
import { dummyStdOut } from '../data/testData';
import { dummyOutputPull } from './data/testData';

const pullCommand: CommandParams = {
  command: 'force:source:pull',
  description: {
    default: 'force_source_pull_default_org_text',
    forceoverwrite: 'force_source_pull_force_default_org_text'
  },
  logName: { default: FORCE_SOURCE_PULL_LOG_NAME }
};

const pushCommand: CommandParams = {
  command: 'force:source:push',
  description: {
    default: 'force_source_push_default_org_text',
    forceoverwrite: 'force_source_push_force_default_org_text'
  },
  logName: { default: 'force_source_push_default_scratch_org' }
};

const flag = '';

describe('SfdxCommandletExecutor', () => {
  let appendLineMock: jest.SpyInstance;

  beforeEach(() => {
    appendLineMock = jest
      .spyOn(channelService, 'appendLine')
      .mockImplementation(jest.fn());
  });

  describe('exitProcessHandler', () => {
    const setPropertiesForFilesPushPullMock = jest.fn();

    beforeEach(() => {
      jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
        setPropertiesForFilesPushPull: setPropertiesForFilesPushPullMock
      } as any);

      jest.spyOn(channelService, 'clear');
    });

    it('should update the local cache for the components that were retrieved after a pull', () => {
      const executor = new ForceSourcePullExecutor(undefined, pullCommand);
      const updateCacheAfterPushPullMock = jest.spyOn(
        executor as any,
        'updateCache'
      );
      (executor as any).channel = { appendLine: appendLineMock };

      (executor as any).exitProcessHandler(
        0,
        { command: { logName: FORCE_SOURCE_PULL_LOG_NAME } },
        '',
        '',
        dummyOutputPull
      );

      expect(updateCacheAfterPushPullMock).toHaveBeenCalled();
      expect(setPropertiesForFilesPushPullMock).toHaveBeenCalled();
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
        const executor = new ForceSourcePushExecutor(flag, pushCommand);

        // Act
        const parsed = (executor as any).parseOutput(dummyStdOut);

        // Assert
        expect(parseSpy).toHaveBeenCalledWith(dummyStdOut);
      });

      it('should show a message to the User if there is a parsing error', async () => {
        // Arrange
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

  describe('outputResultPull', () => {
    it('should output a message to the channel when there are errors and no result', () => {
      // Arrange
      const executor = new ForceSourcePullExecutor(undefined, pullCommand);
      (executor as any).channel = {
        appendLine: appendLineMock
      };
      const dummyMsg = 'a message';
      const dummyName = 'a test name';

      class TestParser extends ForcePullResultParser {
        public getErrors(): ForceSourcePullErrorResponse | undefined {
          return {
            message: dummyMsg,
            name: dummyName,
            result: undefined,
            stack: 'string',
            status: 1,
            warnings: []
          } as any;
        }
        public getSuccesses(): ForceSourcePullSuccessResponse | undefined {
          return undefined;
        }
      }
      const parser = new TestParser(dummyStdOut);

      // Act
      executor.outputResultPull(parser as any);

      // Assert
      expect(
        appendLineMock.mock.calls[0][0].includes(dummyName, dummyMsg)
      ).toEqual(true);
    });

    it('should output at least something to the console when there are errors and no result and the response is missing information', () => {
      // Arrange
      const executor = new ForceSourcePullExecutor(undefined, pullCommand);
      (executor as any).channel = {
        appendLine: appendLineMock
      };
      const dummyMsg = undefined;
      const dummyName = undefined;
      const consoleLogMock = jest.spyOn(console, 'log');

      class TestParser extends ForcePullResultParser {
        public getErrors(): ForceSourcePullErrorResponse | undefined {
          return {
            message: dummyMsg,
            name: dummyName,
            result: undefined,
            stack: 'string',
            status: 1,
            warnings: []
          } as any;
        }
        public getSuccesses(): ForceSourcePullSuccessResponse | undefined {
          return undefined;
        }
      }
      const parser = new TestParser(dummyStdOut);

      // Act
      executor.outputResultPull(parser as any);

      // Assert
      expect(appendLineMock).not.toHaveBeenCalled();
      expect(consoleLogMock).toHaveBeenCalled();
    });
  });
});
