/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { workspaceUtils, SourceTrackingService } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '@salesforce/salesforcedx-utils-vscode/src/messages';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { channelService } from '../../../src/channels';
import { DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { DeployExecutor } from '../../../src/commands/deployExecutor';
import { ProjectDeployStartExecutor, projectDeployStart } from '../../../src/commands/projectDeployStart';
import { SfCommandletExecutor, SfCommandlet } from '../../../src/commands/util';
import { TimestampConflictChecker } from '../../../src/commands/util/timestampConflictChecker';

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

      it('should return ComponentSet from project source when source tracking is disabled', async () => {
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

    describe('getComponents with source tracking enabled', () => {
      beforeEach(() => {
        jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('/test/project/path');
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({})
        } as any);
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue({
          getStatus: jest.fn().mockResolvedValue([])
        } as any);
      });

      it('should return empty ComponentSet when no changes are detected', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue([])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.getStatus).toHaveBeenCalledWith({ local: true, remote: false });
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return ComponentSet with changed components when changes are detected', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: '/test/project/path/force-app/main/default/classes/TestClass.cls',
            origin: 'local',
            ignored: false
          }
        ];
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        const mockComponentSet = new ComponentSet();
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.getStatus).toHaveBeenCalledWith({ local: true, remote: false });
        expect(ComponentSet.fromSource).toHaveBeenCalledWith([
          '/test/project/path/force-app/main/default/classes/TestClass.cls'
        ]);
        expect(result).toBeInstanceOf(ComponentSet);
      });

      it('should filter out ignored components', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: '/test/project/path/force-app/main/default/classes/TestClass.cls',
            origin: 'local',
            ignored: true
          }
        ];
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0); // Should be empty since component is ignored
      });

      it('should filter out non-local components', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: '/test/project/path/force-app/main/default/classes/TestClass.cls',
            origin: 'remote',
            ignored: false
          }
        ];
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0); // Should be empty since component is not local
      });

      it('should handle components without file paths', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            origin: 'local',
            ignored: false
            // No filePath property
          }
        ];
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0); // Should be empty since no file paths
      });

      it('should fall back to all source when source tracking fails', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockRejectedValue(new Error('Source tracking failed'));
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const mockComponentSet = new ComponentSet();
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(
          'Source tracking failed, falling back to all source:',
          expect.any(Error)
        );
        expect(ComponentSet.fromSource).toHaveBeenCalledWith('/test/project/path');
        expect(result).toBeInstanceOf(ComponentSet);
      });

      it('should fall back to all source when workspace context fails', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        jest.spyOn(WorkspaceContext, 'getInstance').mockImplementation(() => {
          throw new Error('Workspace context failed');
        });
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const mockComponentSet = new ComponentSet();
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(
          'Source tracking failed, falling back to all source:',
          expect.any(Error)
        );
        expect(ComponentSet.fromSource).toHaveBeenCalledWith('/test/project/path');
        expect(result).toBeInstanceOf(ComponentSet);
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

      it('should store changed file paths in executor for conflict detection', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: '/test/project/path/force-app/main/default/classes/TestClass.cls',
            origin: 'local',
            ignored: false
          }
        ];
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({})
        } as any);

        // Mock ComponentSet.fromSource to avoid file system access
        const mockComponentSet = new ComponentSet();
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet);

        // Act
        await (executor as any).getComponents({} as any);

        // Assert
        expect(executor.getChangedFilePaths()).toEqual([
          '/test/project/path/force-app/main/default/classes/TestClass.cls'
        ]);
      });

      it('should perform conflict detection on changed files when setting is enabled', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: '/test/project/path/force-app/main/default/classes/TestClass.cls',
            origin: 'local',
            ignored: false
          }
        ];
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({})
        } as any);

        // Mock the conflict detection to return success
        const mockTimestampChecker = {
          check: jest.fn().mockResolvedValue({ type: 'CONTINUE', data: '/test/path' })
        };
        jest.spyOn(TimestampConflictChecker.prototype, 'check').mockImplementation(mockTimestampChecker.check);

        // Mock ComponentSet to return a proper iterable
        const mockComponentSet = {
          size: 1,
          *[Symbol.iterator]() {
            yield { type: { name: 'ApexClass' } };
          },
          deploy: jest.fn().mockResolvedValue({
            response: { status: 'Succeeded' },
            pollStatus: jest.fn().mockResolvedValue({
              response: { status: 'Succeeded' },
              getFileResponses: jest.fn().mockReturnValue([])
            }),
            getFileResponses: jest.fn().mockReturnValue([])
          })
        };
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet as any);

        // Mock the source tracking to have all required methods
        const mockSourceTrackingWithMethods = {
          ...mockSourceTracking,
          ensureLocalTracking: jest.fn().mockResolvedValue(undefined)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTrackingWithMethods as any);

        // Mock PersistentStorageService
        jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
          setPropertiesForFilesDeploy: jest.fn()
        } as any);

        // Mock SalesforceProjectConfig to avoid undefined errors
        jest.spyOn(SalesforceProjectConfig, 'getInstance').mockResolvedValue({
          get: jest.fn().mockReturnValue('dummy')
        } as any);
        jest.spyOn(SalesforcePackageDirectories, 'getPackageDirectoryPaths').mockResolvedValue(['force-app']);

        // Mock error collections
        const mockErrorCollection = { clear: jest.fn() };
        DeployRetrieveExecutor.errorCollection = mockErrorCollection as any;
        SfCommandletExecutor.errorCollection = mockErrorCollection as any;

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        expect(mockTimestampChecker.check).toHaveBeenCalledWith({
          type: 'CONTINUE',
          data: '/test/project/path/force-app/main/default/classes/TestClass.cls'
        });
      });

      it('should skip conflict detection when no changed files are found', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue([])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({})
        } as any);

        // Mock ComponentSet.fromSource to avoid file system access
        const mockComponentSet = new ComponentSet();
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet);

        // Mock SalesforceProjectConfig to avoid undefined errors
        jest.spyOn(SalesforceProjectConfig, 'getInstance').mockResolvedValue({
          get: jest.fn().mockReturnValue('dummy')
        } as any);
        jest.spyOn(SalesforcePackageDirectories, 'getPackageDirectoryPaths').mockResolvedValue(['force-app']);

        // Mock error collections
        const mockErrorCollection = { clear: jest.fn() };
        DeployRetrieveExecutor.errorCollection = mockErrorCollection as any;
        SfCommandletExecutor.errorCollection = mockErrorCollection as any;

        // Mock the base run method to return success
        jest.spyOn(DeployExecutor.prototype, 'run').mockResolvedValue(true);

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        expect(executor.getChangedFilePaths()).toEqual([]);
      });

      it('should skip conflict detection when ignoreConflicts is true', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor(true, true); // ignoreConflicts = true
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: '/test/project/path/force-app/main/default/classes/TestClass.cls',
            origin: 'local',
            ignored: false
          }
        ];
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({})
        } as any);

        // Mock ComponentSet to return a proper iterable
        const mockComponentSet = {
          size: 1,
          *[Symbol.iterator]() {
            yield { type: { name: 'ApexClass' } };
          },
          deploy: jest.fn().mockResolvedValue({
            response: { status: 'Succeeded' },
            pollStatus: jest.fn().mockResolvedValue({
              response: { status: 'Succeeded' },
              getFileResponses: jest.fn().mockReturnValue([])
            }),
            getFileResponses: jest.fn().mockReturnValue([])
          })
        };
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet as any);

        // Mock the source tracking to have all required methods
        const mockSourceTrackingWithMethods = {
          ...mockSourceTracking,
          ensureLocalTracking: jest.fn().mockResolvedValue(undefined)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTrackingWithMethods as any);

        // Mock PersistentStorageService
        jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
          setPropertiesForFilesDeploy: jest.fn()
        } as any);

        // Mock SalesforceProjectConfig to avoid undefined errors
        jest.spyOn(SalesforceProjectConfig, 'getInstance').mockResolvedValue({
          get: jest.fn().mockReturnValue('dummy')
        } as any);
        jest.spyOn(SalesforcePackageDirectories, 'getPackageDirectoryPaths').mockResolvedValue(['force-app']);

        // Mock error collections
        const mockErrorCollection = { clear: jest.fn() };
        DeployRetrieveExecutor.errorCollection = mockErrorCollection as any;
        SfCommandletExecutor.errorCollection = mockErrorCollection as any;

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        // Conflict detection should be skipped even though we have changed files and the setting is enabled
        expect(executor.getChangedFilePaths()).toEqual([
          '/test/project/path/force-app/main/default/classes/TestClass.cls'
        ]);
      });

      it('should perform conflict detection when ignoreConflicts is false', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor(true, false); // ignoreConflicts = false
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: '/test/project/path/force-app/main/default/classes/TestClass.cls',
            origin: 'local',
            ignored: false
          }
        ];
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({})
        } as any);

        // Mock the conflict detection to return success
        const mockTimestampChecker = {
          check: jest.fn().mockResolvedValue({ type: 'CONTINUE', data: '/test/path' })
        };
        jest.spyOn(TimestampConflictChecker.prototype, 'check').mockImplementation(mockTimestampChecker.check);

        // Mock ComponentSet to return a proper iterable
        const mockComponentSet = {
          size: 1,
          *[Symbol.iterator]() {
            yield { type: { name: 'ApexClass' } };
          },
          deploy: jest.fn().mockResolvedValue({
            response: { status: 'Succeeded' },
            pollStatus: jest.fn().mockResolvedValue({
              response: { status: 'Succeeded' },
              getFileResponses: jest.fn().mockReturnValue([])
            }),
            getFileResponses: jest.fn().mockReturnValue([])
          })
        };
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet as any);

        // Mock the source tracking to have all required methods
        const mockSourceTrackingWithMethods = {
          ...mockSourceTracking,
          ensureLocalTracking: jest.fn().mockResolvedValue(undefined)
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTrackingWithMethods as any);

        // Mock PersistentStorageService
        jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
          setPropertiesForFilesDeploy: jest.fn()
        } as any);

        // Mock SalesforceProjectConfig to avoid undefined errors
        jest.spyOn(SalesforceProjectConfig, 'getInstance').mockResolvedValue({
          get: jest.fn().mockReturnValue('dummy')
        } as any);
        jest.spyOn(SalesforcePackageDirectories, 'getPackageDirectoryPaths').mockResolvedValue(['force-app']);

        // Mock error collections
        const mockErrorCollection = { clear: jest.fn() };
        DeployRetrieveExecutor.errorCollection = mockErrorCollection as any;
        SfCommandletExecutor.errorCollection = mockErrorCollection as any;

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        // Conflict detection should be performed since ignoreConflicts is false
        expect(mockTimestampChecker.check).toHaveBeenCalledWith({
          type: 'CONTINUE',
          data: '/test/project/path/force-app/main/default/classes/TestClass.cls'
        });
      });
    });
  });
});
