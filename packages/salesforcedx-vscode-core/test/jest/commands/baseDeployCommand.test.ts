/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService } from '@salesforce/salesforcedx-utils-vscode';
import { ForceSourcePushExecutor } from '../../../src/commands';
import {
  BaseDeployExecutor,
  DeployType
} from '../../../src/commands/baseDeployCommand';
import { CommandParams } from '../../../src/commands/util';
import { nls } from '../../../src/messages';
import { dummyStdOut } from './data/testData';

jest.mock('../../../src/channels');
jest.mock('../../../src/statuses');
jest.mock('../../../src/notifications');

describe('BaseDeployExecutor', () => {
  describe('exitProcessHandlerDeploy', () => {
    beforeEach(() => {
      jest.spyOn(ChannelService, 'getInstance').mockReturnValue({} as any);
      jest.spyOn(nls, 'localize').mockReturnValue('');
      (BaseDeployExecutor as any).errorCollection = {
        clear: jest.fn()
      };
      (BaseDeployExecutor as any).logMetric = jest.fn();
      jest
        .spyOn(BaseDeployExecutor.prototype, 'logMetric')
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
      executorAsAny.updateCache = updateCacheMock;
      executorAsAny.getDeployType = jest.fn().mockReturnValue(DeployType.Push);
      executorAsAny.logMetric = jest.fn();

      // Act
      await (executor as any).exitProcessHandlerDeploy(
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
    });
  });
});
