/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChannelService } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '@salesforce/salesforcedx-utils-vscode/src/messages';
import { ForceSourcePushExecutor } from '../../../src/commands';
import { DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { DeployType } from '../../../src/commands/forceSourcePush';
import {
  CommandParams,
  SfdxCommandletExecutor
} from '../../../src/commands/util';
import { PersistentStorageService } from '../../../src/conflict';
import { dummyPushResult, dummyStdOut } from './data/testData';

describe('ForceSourcePushExecutor', () => {
  describe('exitProcessHandlerPush', () => {
    class MockErrorCollection {
      public static clear(): void {
        jest.fn();
      }
    }
    beforeEach(() => {
      jest.spyOn(ChannelService, 'getInstance').mockReturnValue({} as any);
      jest.spyOn(nls, 'localize').mockReturnValue('');
      (ForceSourcePushExecutor as any).logMetric = jest.fn();
      jest
        .spyOn(ForceSourcePushExecutor.prototype, 'logMetric')
        .mockImplementation(jest.fn());
    });

    it('should update the local cache for the components that were deployed after a push', async () => {
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
      SfdxCommandletExecutor.errorCollection = MockErrorCollection as any;
      DeployRetrieveExecutor.errorCollection = MockErrorCollection as any;
      const deployRetrieveExecutorClearSpy = jest.spyOn(
        DeployRetrieveExecutor.errorCollection,
        'clear'
      );
      const sfdxCommandletExecutorClearSpy = jest.spyOn(
        SfdxCommandletExecutor.errorCollection,
        'clear'
      );
      executorAsAny.updateCache = updateCacheMock;
      executorAsAny.getDeployType = jest.fn().mockReturnValue(DeployType.Push);
      executorAsAny.logMetric = jest.fn();

      // Act
      await (executor as any).exitProcessHandlerPush(
        0,
        dummyStdOut,
        '',
        '',
        { command: { logName: 'force_source_push_default_scratch_org' } },
        [1, 2],
        undefined
      );

      // Assert
      expect(updateCacheMock).toHaveBeenCalled();
      expect(sfdxCommandletExecutorClearSpy).toHaveBeenCalled();
      expect(deployRetrieveExecutorClearSpy).toHaveBeenCalled();
    });
  });

  describe('updateCache', () => {
    const setPropertiesForFilesPushPullMock = jest.fn();

    beforeEach(() => {
      jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
        setPropertiesForFilesPushPull: setPropertiesForFilesPushPullMock
      } as any);
    });

    it('should update the local cache for the pulled source components after push', async () => {
      const pushExecutor = new ForceSourcePushExecutor();

      (pushExecutor as any).updateCache(dummyPushResult);

      expect(setPropertiesForFilesPushPullMock).toHaveBeenCalledWith(
        dummyPushResult.result.pushedSource
      );
    });
  });
});
