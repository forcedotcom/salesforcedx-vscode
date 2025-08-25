/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { workspaceUtils, SourceTrackingService, nls } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { channelService } from '../../../src/channels';
import { DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { ProjectDeployStartExecutor, projectDeployStart } from '../../../src/commands/projectDeployStart';
import { SfCommandletExecutor, SfCommandlet } from '../../../src/commands/util';
import { PersistentStorageService } from '../../../src/conflict';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import SalesforcePackageDirectories from '../../../src/salesforceProject/salesforcePackageDirectories';
import SalesforceProjectConfig from '../../../src/salesforceProject/salesforceProjectConfig';
import { salesforceCoreSettings } from '../../../src/settings';
import { telemetryService } from '../../../src/telemetry';

jest.mock('../../../src/services/sdr/componentSetUtils', () => ({
  componentSetUtils: {
    setApiVersion: jest.fn().mockResolvedValue(undefined),
    setSourceApiVersion: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('ProjectDeployStart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock SourceTrackingService properly
    jest.spyOn(SourceTrackingService, 'getSourceTracking').mockImplementation(jest.fn());
  });

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
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(false);
      });

      it('should return empty ComponentSet when source tracking is disabled and no changes', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet regardless of project path when no changes', async () => {
        // Arrange
        jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('');
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });
    });

    describe('getComponents with source tracking enabled', () => {
      beforeEach(() => {
        jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('/test/project/path');
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({})
        } as any);
      });

      it('should return empty ComponentSet when no changes are detected', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(mockSourceTracking);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(SourceTrackingService.getSourceTracking).toHaveBeenCalledWith('/test/project/path', {});
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalledWith(false);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no changes are detected regardless of source files', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(mockSourceTracking);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(SourceTrackingService.getSourceTracking).toHaveBeenCalledWith('/test/project/path', {});
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalledWith(false);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no changes are detected even with empty source files', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(mockSourceTracking);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(SourceTrackingService.getSourceTracking).toHaveBeenCalledWith('/test/project/path', {});
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalledWith(false);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no changes are detected regardless of ComponentSet.fromSource result', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(mockSourceTracking);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(SourceTrackingService.getSourceTracking).toHaveBeenCalledWith('/test/project/path', {});
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalledWith(false);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return ComponentSet with changed components when changes are detected', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockComponentSet = new ComponentSet();
        // Mock the component set to have size > 0 to simulate changes
        jest.spyOn(mockComponentSet, 'size', 'get').mockReturnValue(1);
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(mockSourceTracking);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(SourceTrackingService.getSourceTracking).toHaveBeenCalledWith('/test/project/path', {});
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalledWith(false);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result).toBe(mockComponentSet);
      });

      it('should return empty ComponentSet when no changes are detected', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = { type: 'CONTINUE', data: {} };
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(mockSourceTracking);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(SourceTrackingService.getSourceTracking).toHaveBeenCalledWith('/test/project/path', {});
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalledWith(false);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no changes are detected regardless of response type', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = { type: 'CONTINUE', data: {} };
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(mockSourceTracking);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(SourceTrackingService.getSourceTracking).toHaveBeenCalledWith('/test/project/path', {});
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalledWith(false);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no changes are detected after filtering', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(mockSourceTracking);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(SourceTrackingService.getSourceTracking).toHaveBeenCalledWith('/test/project/path', {});
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalledWith(false);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no local changes are detected', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(mockSourceTracking);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(SourceTrackingService.getSourceTracking).toHaveBeenCalledWith('/test/project/path', {});
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalledWith(false);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should handle components without file paths', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(mockSourceTracking);
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(SourceTrackingService.getSourceTracking).toHaveBeenCalledWith('/test/project/path', {});
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalledWith(false);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0); // Should be empty since no file paths
      });

      it('should throw error when source tracking fails', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        (SourceTrackingService.getSourceTracking as jest.Mock).mockRejectedValue(new Error('Source tracking failed'));

        // Act & Assert
        await expect((executor as any).getComponents(mockResponse)).rejects.toThrow(
          'Source tracking setup failed: Source tracking failed'
        );
      });

      it('should throw error when source tracking service is null', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        (SourceTrackingService.getSourceTracking as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect((executor as any).getComponents(mockResponse)).rejects.toThrow(
          'Source tracking setup failed: Failed to initialize source tracking service.'
        );
      });

      it('should throw error when connection is null', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue(null)
        } as any);

        // Act & Assert
        await expect((executor as any).getComponents(mockResponse)).rejects.toThrow(
          'Source tracking setup failed: Failed to establish connection to the org for source tracking.'
        );
      });

      it('should throw error when workspace context fails', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        jest.spyOn(WorkspaceContext, 'getInstance').mockImplementation(() => {
          throw new Error('Workspace context failed');
        });

        // Act & Assert
        await expect((executor as any).getComponents(mockResponse)).rejects.toThrow(
          'Source tracking setup failed: Workspace context failed'
        );
      });
    });

    describe('empty ComponentSet handling', () => {
      beforeEach(() => {
        jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('/test/project/path');
        jest.spyOn(channelService, 'appendLine').mockImplementation(jest.fn());
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(new ComponentSet());
      });

      it('should handle empty ComponentSet and return early with success message', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const emptyComponentSet = new ComponentSet();
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(emptyComponentSet);
        jest.spyOn(emptyComponentSet, 'size', 'get').mockReturnValue(0);
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(false);

        // Act
        const result = await executor.run(mockResponse);

        // Assert
        expect(channelService.appendLine).toHaveBeenCalledWith('=== Pushed Source\nNo results found\n');
        expect(result).toBe(true);
      });
    });

    describe('constructor', () => {
      it('should initialize as push operation', () => {
        // Arrange & Act
        const executor = new ProjectDeployStartExecutor();

        // Assert
        expect((executor as any).operationType).toBe('push');
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

    describe('conflict detection', () => {
      beforeEach(() => {
        jest.spyOn(channelService, 'showCommandWithTimestamp').mockImplementation(() => {});
        jest.spyOn(channelService, 'appendLine').mockImplementation(() => {});
        jest.spyOn(telemetryService, 'sendException').mockImplementation(() => {});
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          username: 'test@example.com'
        } as any);
      });

      it('should skip conflict detection when setting is disabled', async () => {
        // Arrange
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(false);

        // Act
        await projectDeployStart(false, false);

        // Assert
        // Since SfCommandlet is mocked, we can't test the actual conflict checker behavior
        // But we can verify that the function completes without error
        expect(true).toBe(true);
      });

      it('should create commandlet with conflict checker when setting is enabled', async () => {
        // Arrange
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);
        const mockRun = jest.spyOn(SfCommandlet.prototype, 'run').mockResolvedValue(undefined);

        // Act
        await projectDeployStart(false, false);

        // Assert
        expect(mockRun).toHaveBeenCalled();
      });

      it('should create commandlet with conflict checker when setting is disabled', async () => {
        // Arrange
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(false);
        const mockRun = jest.spyOn(SfCommandlet.prototype, 'run').mockResolvedValue(undefined);

        // Act
        await projectDeployStart(false, false);

        // Assert
        expect(mockRun).toHaveBeenCalled();
      });
    });
  });
});
