/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChannelService } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '@salesforce/salesforcedx-utils-vscode/src/messages';
import { ProjectDeployStartExecutor } from '../../../src/commands';
import { DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { DeployType } from '../../../src/commands/projectDeployStart';
import { CommandParams, SfCommandletExecutor } from '../../../src/commands/util';
import { PersistentStorageService } from '../../../src/conflict';
import { dummyPushResult, dummyStdOut } from './data/testData';

describe('ProjectDeployStartExecutor', () => {
  describe('exitProcessHandlerPush', () => {
    class MockErrorCollection {
      public static clear(): void {
        jest.fn();
      }
    }
    beforeEach(() => {
      jest.spyOn(ChannelService, 'getInstance').mockReturnValue({} as any);
      jest.spyOn(nls, 'localize').mockReturnValue('');
      (ProjectDeployStartExecutor as any).logMetric = jest.fn();
      jest.spyOn(ProjectDeployStartExecutor.prototype, 'logMetric').mockImplementation(jest.fn());
    });

    it('should update the local cache for the components that were deployed after a push', async () => {
      // Arrange
      const pushCommand: CommandParams = {
        command: 'project:deploy:start',
        description: {
          default: 'project_deploy_start_default_org_text',
          ignoreConflicts: 'project_deploy_start_ignore_conflicts_default_org_text'
        },
        logName: { default: 'project_deploy_start_default_scratch_org' }
      };
      const flag = '';
      const executor = new ProjectDeployStartExecutor(flag, pushCommand);
      const updateCacheMock = jest.fn();
      const executorAsAny = executor as any;
      SfCommandletExecutor.errorCollection = MockErrorCollection as any;
      DeployRetrieveExecutor.errorCollection = MockErrorCollection as any;
      const deployRetrieveExecutorClearSpy = jest.spyOn(DeployRetrieveExecutor.errorCollection, 'clear');
      const sfCommandletExecutorClearSpy = jest.spyOn(SfCommandletExecutor.errorCollection, 'clear');
      executorAsAny.updateCache = updateCacheMock;
      executorAsAny.getDeployType = jest.fn().mockReturnValue(DeployType.Push);
      executorAsAny.logMetric = jest.fn();

      // Act
      await (executor as any).exitProcessHandlerPush(
        0,
        dummyStdOut,
        '',
        '',
        { command: { logName: 'project_deploy_start_default_scratch_org' } },
        [1, 2],
        undefined
      );

      // Assert
      expect(updateCacheMock).toHaveBeenCalled();
      expect(sfCommandletExecutorClearSpy).toHaveBeenCalled();
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
      const pushExecutor = new ProjectDeployStartExecutor();

      (pushExecutor as any).updateCache(dummyPushResult);

      expect(setPropertiesForFilesPushPullMock).toHaveBeenCalledWith(dummyPushResult.result.files);
    });
  });
});
