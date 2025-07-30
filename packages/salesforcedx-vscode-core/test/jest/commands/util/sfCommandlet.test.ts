/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ProjectRetrieveStartResultParser,
  ProjectRetrieveStartErrorResponse,
  ProjectRetrieveStartSuccessResponse
} from '@salesforce/salesforcedx-utils-vscode';
import { channelService } from '../../../../src/channels';
import { ProjectRetrieveStartExecutor } from '../../../../src/commands/projectRetrieveStart';
import { CommandParams } from '../../../../src/commands/util';
import { PersistentStorageService } from '../../../../src/conflict';
import { PROJECT_RETRIEVE_START_LOG_NAME } from '../../../../src/constants';
import { dummyOutputPull } from './data/testData';

const pullCommand: CommandParams = {
  command: 'project:retrieve:start',
  description: {
    default: 'project_retrieve_start_default_org_text',
    ignoreConflicts: 'project_retrieve_start_ignore_conflicts_default_org_text'
  },
  logName: { default: PROJECT_RETRIEVE_START_LOG_NAME }
};

describe('SfCommandletExecutor', () => {
  let appendLineMock: jest.SpyInstance;

  beforeEach(() => {
    appendLineMock = jest.spyOn(channelService, 'appendLine').mockImplementation(jest.fn());
  });

  describe('exitProcessHandlerPull', () => {
    const setPropertiesForFilesPushPullMock = jest.fn();

    beforeEach(() => {
      jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
        setPropertiesForFilesPushPull: setPropertiesForFilesPushPullMock
      } as any);

      jest.spyOn(channelService, 'clear');
    });

    it('should update the local cache for the components that were retrieved after a pull', () => {
      const executor = new ProjectRetrieveStartExecutor(undefined, pullCommand);
      const updateCacheAfterPushPullMock = jest.spyOn(executor as any, 'updateCache');
      (executor as any).channel = { appendLine: appendLineMock };

      (executor as any).exitProcessHandlerPull(
        0,
        { command: { logName: PROJECT_RETRIEVE_START_LOG_NAME } },
        '',
        '',
        dummyOutputPull
      );

      expect(updateCacheAfterPushPullMock).toHaveBeenCalled();
      expect(setPropertiesForFilesPushPullMock).toHaveBeenCalled();
    });
  });

  describe('outputResultPull', () => {
    it('should output a message to the channel when there are errors and no data', () => {
      // Arrange
      const executor = new ProjectRetrieveStartExecutor(undefined, pullCommand);
      (executor as any).channel = {
        appendLine: appendLineMock
      };
      const dummyMsg = 'a message';
      const dummyName = 'a test name';

      class TestParser extends ProjectRetrieveStartResultParser {
        public getErrors(): ProjectRetrieveStartErrorResponse | undefined {
          return {
            message: dummyMsg,
            name: dummyName,
            result: undefined,
            stack: 'string',
            status: 1,
            warnings: []
          } as any;
        }
        public getSuccesses(): ProjectRetrieveStartSuccessResponse | undefined {
          return undefined;
        }
      }
      const parser = new TestParser('{"status": 0, "result": {"files": []}}');

      // Act
      executor.outputResultPull(parser as any);

      // Assert
      expect(appendLineMock.mock.calls[0][0].includes(dummyName, dummyMsg)).toEqual(true);
    });

    it('should output at least something to the console when there are errors and no data and the response is missing information', () => {
      // Arrange
      const executor = new ProjectRetrieveStartExecutor(undefined, pullCommand);
      (executor as any).channel = {
        appendLine: appendLineMock
      };
      const dummyMsg = undefined;
      const dummyName = undefined;
      const consoleLogMock = jest.spyOn(console, 'log');

      class TestParser extends ProjectRetrieveStartResultParser {
        public getErrors(): ProjectRetrieveStartErrorResponse | undefined {
          return {
            message: dummyMsg,
            name: dummyName,
            result: undefined,
            stack: 'string',
            status: 1,
            warnings: []
          } as any;
        }
        public getSuccesses(): ProjectRetrieveStartSuccessResponse | undefined {
          return undefined;
        }
      }
      const parser = new TestParser('{"status": 0, "result": {"files": []}}');

      // Act
      executor.outputResultPull(parser as any);

      // Assert
      expect(appendLineMock).not.toHaveBeenCalled();
      expect(consoleLogMock).toHaveBeenCalled();
    });
  });
});
