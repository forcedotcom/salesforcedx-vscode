/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { nls } from '@salesforce/salesforcedx-utils-vscode/src/messages';
import { channelService } from '../../../src/channels';
import { DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { ProjectDeployStartExecutor } from '../../../src/commands/projectDeployStart';
import { SfCommandletExecutor } from '../../../src/commands/util';
import { PersistentStorageService } from '../../../src/conflict';
import SalesforcePackageDirectories from '../../../src/salesforceProject/salesforcePackageDirectories';
import SalesforceProjectConfig from '../../../src/salesforceProject/salesforceProjectConfig';

describe('ProjectDeployStartExecutor', () => {
  describe('postOperation', () => {
    class MockErrorCollection {
      public static clear(): void {
        jest.fn();
      }
    }
    beforeEach(() => {
      jest.spyOn(channelService, 'appendLine').mockImplementation(jest.fn());
      jest.spyOn(channelService, 'clear').mockImplementation(jest.fn());
      jest.spyOn(nls, 'localize').mockReturnValue('');
      jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
        setPropertiesForFilesDeploy: jest.fn()
      } as any);
      jest.spyOn(SalesforceProjectConfig, 'getInstance').mockResolvedValue({
        get: jest.fn().mockReturnValue('dummy')
      } as any);
      jest.spyOn(SalesforcePackageDirectories, 'getPackageDirectoryPaths').mockResolvedValue(['force-app']);
    });

    it('should update the local cache for the components that were deployed after a push', async () => {
      // Arrange
      const executor = new ProjectDeployStartExecutor();
      SfCommandletExecutor.errorCollection = MockErrorCollection as any;
      DeployRetrieveExecutor.errorCollection = MockErrorCollection as any;
      const deployRetrieveExecutorClearSpy = jest.spyOn(DeployRetrieveExecutor.errorCollection, 'clear');
      const sfCommandletExecutorClearSpy = jest.spyOn(SfCommandletExecutor.errorCollection, 'clear');

      // Mock the result with success status
      const mockResult = {
        response: { status: 'Succeeded' },
        getFileResponses: () => []
      };

      // Act
      await (executor as any).postOperation(mockResult);

      // Assert
      expect(sfCommandletExecutorClearSpy).toHaveBeenCalled();
      expect(deployRetrieveExecutorClearSpy).toHaveBeenCalled();
    });
  });

  describe('createOutput', () => {
    it('should create output table for successful deployment', () => {
      const executor = new ProjectDeployStartExecutor();
      const mockResult = {
        response: { status: 'Succeeded' },
        getFileResponses: () => [
          {
            state: 'Succeeded',
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: '/force-app/main/default/classes/TestClass.cls'
          }
        ]
      };

      const output = (executor as any).createOutput(mockResult, ['force-app']);

      expect(output).toContain('TestClass');
      expect(output).toContain('ApexClass');
    });

    it('should create output table for failed deployment', () => {
      const executor = new ProjectDeployStartExecutor();
      const mockResult = {
        response: { status: 'Failed' },
        getFileResponses: () => [
          {
            state: 'Failed',
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: '/force-app/main/default/classes/TestClass.cls',
            error: 'Compilation failed'
          }
        ]
      };

      const output = (executor as any).createOutput(mockResult, ['force-app']);

      expect(output).toContain('TestClass');
      expect(output).toContain('Compilation failed');
    });
  });
});
