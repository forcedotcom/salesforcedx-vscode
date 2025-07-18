/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '@salesforce/salesforcedx-utils-vscode/src/messages';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { channelService } from '../../../src/channels';
import { DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { ProjectDeployStartExecutor, projectDeployStart } from '../../../src/commands/projectDeployStart';
import { SfCommandletExecutor, SfCommandlet } from '../../../src/commands/util';
import { PersistentStorageService } from '../../../src/conflict';
import SalesforcePackageDirectories from '../../../src/salesforceProject/salesforcePackageDirectories';
import SalesforceProjectConfig from '../../../src/salesforceProject/salesforceProjectConfig';
import { salesforceCoreSettings } from '../../../src/settings';

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
        getFileResponses: (): any[] => []
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

  describe('getComponents', () => {
    beforeEach(() => {
      jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('/test/project/path');
      jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(new ComponentSet());
    });

    it('should return ComponentSet from project source', async () => {
      // Arrange
      const executor = new ProjectDeployStartExecutor();
      const mockResponse = {} as any;

      // Act
      const result = await (executor as any).getComponents(mockResponse);

      // Assert
      expect(workspaceUtils.getRootWorkspacePath).toHaveBeenCalled();
      expect(ComponentSet.fromSource).toHaveBeenCalledWith('/test/project/path');
      expect(result).toBeInstanceOf(ComponentSet);
    });

    it('should handle empty project path gracefully', async () => {
      // Arrange
      jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('');
      const executor = new ProjectDeployStartExecutor();
      const mockResponse = {} as any;

      // Act
      const result = await (executor as any).getComponents(mockResponse);

      // Assert
      expect(ComponentSet.fromSource).toHaveBeenCalledWith('');
      expect(result).toBeInstanceOf(ComponentSet);
    });
  });

  describe('isPushOperation', () => {
    it('should return true for push operations', () => {
      // Arrange
      const executor = new ProjectDeployStartExecutor();

      // Act
      const result = (executor as any).isPushOperation();

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('constructor', () => {
    it('should initialize as push operation', () => {
      // Arrange & Act
      const executor = new ProjectDeployStartExecutor();

      // Assert
      expect((executor as any).isPushOperation()).toBe(true);
    });

    it('should set showChannelOutput correctly', () => {
      // Arrange & Act
      const executor = new ProjectDeployStartExecutor(false);

      // Assert
      expect((executor as any).showChannelOutput).toBe(false);
    });
  });
});

describe('projectDeployStart function', () => {
  beforeEach(() => {
    jest.spyOn(salesforceCoreSettings, 'getDeployOnSaveShowOutputPanel').mockReturnValue(true);
    // Mock the channel service to prevent actual execution
    jest.spyOn(channelService, 'clear').mockImplementation(() => {});
    jest.spyOn(channelService, 'appendLine').mockImplementation(() => {});
    jest.spyOn(channelService, 'showChannelOutput').mockImplementation(() => {});
    // Mock the SfCommandlet to prevent actual execution
    jest.spyOn(SfCommandlet.prototype, 'run').mockResolvedValue(undefined);
  });

  it('should handle different parameter combinations', async () => {
    // Test that the function can be called with different parameters without throwing
    await expect(projectDeployStart(false, false)).resolves.not.toThrow();
    await expect(projectDeployStart(true, false)).resolves.not.toThrow();
    await expect(projectDeployStart(false, true)).resolves.not.toThrow();
    await expect(projectDeployStart(true, true)).resolves.not.toThrow();
  });

  it('should call getDeployOnSaveShowOutputPanel when isDeployOnSave is true', async () => {
    // Arrange
    const isDeployOnSave = true;
    const ignoreConflicts = false;

    // Act
    await projectDeployStart(isDeployOnSave, ignoreConflicts);

    // Assert
    expect(salesforceCoreSettings.getDeployOnSaveShowOutputPanel).toHaveBeenCalled();
  });
});
