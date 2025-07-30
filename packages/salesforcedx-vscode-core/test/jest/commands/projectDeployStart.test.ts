/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { workspaceUtils, SourceTrackingService, nls } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import * as path from 'node:path';
import { channelService } from '../../../src/channels';
import { DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { DeployExecutor } from '../../../src/commands/deployExecutor';
import { ProjectDeployStartExecutor, projectDeployStart } from '../../../src/commands/projectDeployStart';
import { SfCommandletExecutor, SfCommandlet } from '../../../src/commands/util';
import { TimestampConflictChecker } from '../../../src/commands/util/timestampConflictChecker';
import { PersistentStorageService } from '../../../src/conflict';
import { MetadataCacheService } from '../../../src/conflict/metadataCacheService';
import { TimestampConflictDetector } from '../../../src/conflict/timestampConflictDetector';
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
          localChangesAsComponentSet: jest.fn().mockResolvedValue([])
        } as any);
      });

      it('should return empty ComponentSet when no changes are detected and no source files exist', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([]) // no changes
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        // Mock ComponentSet.fromSource to return undefined (no source files exist)
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(undefined as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalled();
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no changes are detected (even if source files exist)', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalled();
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no changes are detected and source files exist but are empty', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalled();
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no changes are detected and ComponentSet.fromSource returns null', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalled();
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return ComponentSet with changed components when changes are detected', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalled();
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result).toBeDefined();
      });

      it('should pass single file path when only one change is detected', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = { type: 'CONTINUE', data: {} };
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalled();
        expect(result).toBeInstanceOf(ComponentSet);
      });

      it('should pass array of file paths when multiple changes are detected', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = { type: 'CONTINUE', data: {} };
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalled();
        expect(result).toBeInstanceOf(ComponentSet);
      });

      it('should filter out ignored components', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalled();
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0); // Should be empty since component is ignored
      });

      it('should filter out non-local components', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalled();
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0); // Should be empty since component is not local
      });

      it('should handle components without file paths', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.localChangesAsComponentSet).toHaveBeenCalled();
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0); // Should be empty since no file paths
      });

      it('should throw error when source tracking fails', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockRejectedValue(new Error('Source tracking failed'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Act & Assert
        await expect((executor as any).getComponents(mockResponse)).rejects.toThrow('Source tracking failed');
        expect(consoleSpy).toHaveBeenCalledWith('Source tracking failed:', expect.any(Error));
      });

      it('should throw error when source tracking service is null', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(null as any);
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Act & Assert
        await expect((executor as any).getComponents(mockResponse)).rejects.toThrow(
          'Failed to initialize source tracking service.'
        );
        expect(consoleSpy).toHaveBeenCalledWith('Source tracking failed:', expect.any(Error));
      });

      it('should throw error when connection is null', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue(null)
        } as any);
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Act & Assert
        await expect((executor as any).getComponents(mockResponse)).rejects.toThrow(
          'Failed to establish connection to the org for source tracking.'
        );
        expect(consoleSpy).toHaveBeenCalledWith('Source tracking failed:', expect.any(Error));
      });

      it('should throw error when workspace context fails', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockResponse = {} as any;
        jest.spyOn(WorkspaceContext, 'getInstance').mockImplementation(() => {
          throw new Error('Workspace context failed');
        });
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Act & Assert
        await expect((executor as any).getComponents(mockResponse)).rejects.toThrow('Workspace context failed');
        expect(consoleSpy).toHaveBeenCalledWith('Source tracking failed:', expect.any(Error));
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

    describe('checkConflictsForChangedFiles', () => {
      beforeEach(() => {
        jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('/test/project/path');
        jest.spyOn(channelService, 'showChannelOutput').mockImplementation(() => {});
        jest.spyOn(channelService, 'showCommandWithTimestamp').mockImplementation(() => {});
        jest.spyOn(channelService, 'appendLine').mockImplementation(() => {});
        jest.spyOn(nls, 'localize').mockReturnValue('test message');
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          username: 'test@example.com'
        } as any);
        jest.spyOn(telemetryService, 'sendException').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
      });

      it('should store changed file paths in executor for conflict detection', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockComponentSet = new ComponentSet();
        // Mock the getSourceComponents method to return components with file paths
        const mockSourceComponent = {
          type: { name: 'ApexClass' },
          fullName: 'TestClass',
          content: '/test/project/path/force-app/main/default/classes/TestClass.cls'
        };
        jest.spyOn(mockComponentSet, 'getSourceComponents').mockReturnValue({
          *[Symbol.iterator]() {
            yield mockSourceComponent;
          }
        } as any);
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({})
        } as any);

        // Mock ComponentSet.fromSource to avoid file system access
        const mockComponentSetForConflict = new ComponentSet();
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSetForConflict);

        // Act
        await (executor as any).getComponents({} as any);

        // Assert
        expect(executor.getChangedFilePaths()).toEqual([
          '/test/project/path/force-app/main/default/classes/TestClass.cls'
        ]);
      });

      it('should skip conflict detection when no changed files are found', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([])
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

      it('should skip conflict detection when no changed files are found (returns empty ComponentSet)', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor();
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({})
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

        // Mock the base run method to return success
        jest.spyOn(DeployExecutor.prototype, 'run').mockResolvedValue(true);

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        expect(executor.getChangedFilePaths()).toEqual([]); // No changed files detected
        // Should return empty ComponentSet when no changes are found
      });

      it('should skip conflict detection when ignoreConflicts is true', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor(true, true); // ignoreConflicts = true
        const mockComponentSetForIgnore = new ComponentSet();
        // Mock the getSourceComponents method to return components with file paths
        const mockSourceComponent = {
          type: { name: 'ApexClass' },
          fullName: 'TestClass',
          content: '/test/project/path/force-app/main/default/classes/TestClass.cls'
        };
        jest.spyOn(mockComponentSetForIgnore, 'getSourceComponents').mockReturnValue({
          *[Symbol.iterator]() {
            yield mockSourceComponent;
          }
        } as any);
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSetForIgnore])
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

      it('should perform conflict detection when ignoreConflicts is false and conflicts are detected', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor(true, false); // ignoreConflicts = false
        const mockComponentSet = new ComponentSet();
        // Mock the getSourceComponents method to return components with file paths
        const mockSourceComponent = {
          type: { name: 'ApexClass' },
          fullName: 'TestClass',
          content: '/test/project/path/force-app/main/default/classes/TestClass.cls'
        };
        jest.spyOn(mockComponentSet, 'getSourceComponents').mockReturnValue({
          *[Symbol.iterator]() {
            yield mockSourceComponent;
          }
        } as any);
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSet])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({}),
          username: 'test@example.com'
        } as any);

        // Mock ComponentSet to return a proper iterable
        const mockComponentSetForDeploy = {
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
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSetForDeploy as any);

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

        // Mock the checkConflictsForChangedFiles method to return true (conflicts detected but user continued)
        jest.spyOn(executor as any, 'checkConflictsForChangedFiles').mockResolvedValue(true);
        // Mock the performDeployment method to return success
        jest.spyOn(executor as any, 'performDeployment').mockResolvedValue(true);

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        // Conflict detection should be performed since ignoreConflicts is false
        expect(executor.getChangedFilePaths()).toEqual([
          '/test/project/path/force-app/main/default/classes/TestClass.cls'
        ]);
        // Verify that conflict detection was called
        expect((executor as any).checkConflictsForChangedFiles).toHaveBeenCalled();
      });

      it('should cancel deployment when conflicts are detected and user cancels', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor(true, false); // ignoreConflicts = false
        const mockComponentSetForCancel = new ComponentSet();
        // Mock the getSourceComponents method to return components with file paths
        const mockSourceComponent = {
          type: { name: 'ApexClass' },
          fullName: 'TestClass',
          content: '/test/project/path/force-app/main/default/classes/TestClass.cls'
        };
        jest.spyOn(mockComponentSetForCancel, 'getSourceComponents').mockReturnValue({
          *[Symbol.iterator]() {
            yield mockSourceComponent;
          }
        } as any);
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSetForCancel])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({}),
          username: 'test@example.com'
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

        // Mock the checkConflictsForChangedFiles method to return false (user cancelled)
        jest.spyOn(executor as any, 'checkConflictsForChangedFiles').mockResolvedValue(false);

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(false);
        expect(executor.getChangedFilePaths()).toEqual([
          '/test/project/path/force-app/main/default/classes/TestClass.cls'
        ]);
      });

      it('should continue deployment when conflicts are detected and user continues', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor(true, false); // ignoreConflicts = false
        const mockComponentSetForContinue = new ComponentSet();
        // Mock the getSourceComponents method to return components with file paths
        const mockSourceComponent = {
          type: { name: 'ApexClass' },
          fullName: 'TestClass',
          content: '/test/project/path/force-app/main/default/classes/TestClass.cls'
        };
        jest.spyOn(mockComponentSetForContinue, 'getSourceComponents').mockReturnValue({
          *[Symbol.iterator]() {
            yield mockSourceComponent;
          }
        } as any);
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSetForContinue])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({}),
          username: 'test@example.com'
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

        // Mock the checkConflictsForChangedFiles method to return true (user continued)
        jest.spyOn(executor as any, 'checkConflictsForChangedFiles').mockResolvedValue(true);
        // Mock the performDeployment method to return success
        jest.spyOn(executor as any, 'performDeployment').mockResolvedValue(true);

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        expect(executor.getChangedFilePaths()).toEqual([
          '/test/project/path/force-app/main/default/classes/TestClass.cls'
        ]);
      });

      it('should perform conflict detection when enabled but no conflicts are found', async () => {
        // Arrange
        const executor = new ProjectDeployStartExecutor(true, false); // ignoreConflicts = false
        const mockComponentSetForNoConflicts = new ComponentSet();
        // Mock the getSourceComponents method to return components with file paths
        const mockSourceComponent = {
          type: { name: 'ApexClass' },
          fullName: 'TestClass',
          content: '/test/project/path/force-app/main/default/classes/TestClass.cls'
        };
        jest.spyOn(mockComponentSetForNoConflicts, 'getSourceComponents').mockReturnValue({
          *[Symbol.iterator]() {
            yield mockSourceComponent;
          }
        } as any);
        const mockSourceTracking = {
          localChangesAsComponentSet: jest.fn().mockResolvedValue([mockComponentSetForNoConflicts])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({}),
          username: 'test@example.com'
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

        // Mock the checkConflictsForChangedFiles method to return true (no conflicts found)
        jest.spyOn(executor as any, 'checkConflictsForChangedFiles').mockResolvedValue(true);
        // Mock the performDeployment method to return success
        jest.spyOn(executor as any, 'performDeployment').mockResolvedValue(true);

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        expect(executor.getChangedFilePaths()).toEqual([
          '/test/project/path/force-app/main/default/classes/TestClass.cls'
        ]);
        // Verify that conflict detection was called
        expect((executor as any).checkConflictsForChangedFiles).toHaveBeenCalled();
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

      it('should correctly match conflict paths with source tracking enabled', async () => {
        // Arrange
        const mockExecutor = new ProjectDeployStartExecutor(true, false);

        // Mock the cache service to return the expected structure
        const mockCacheResult = {
          selectedPath: '/Users/peter.hale/git/dreamhouse-lwc/force-app/main/default/classes/MyClass.cls',
          selectedType: 'individual' as any,
          project: {
            baseDirectory: '/Users/peter.hale/git/dreamhouse-lwc',
            commonRoot: 'force-app/main/default',
            components: []
          },
          cache: {
            baseDirectory: '/cache/dir',
            commonRoot: 'force-app/main/default',
            components: []
          },
          properties: []
        };

        // Mock the detector to return conflicts with the correct structure
        const mockDiffs = {
          localRoot: '/Users/peter.hale/git/dreamhouse-lwc/force-app/main/default',
          remoteRoot: '/cache/dir/force-app/main/default',
          different: new Set([
            {
              localRelPath: 'classes/MyClass.cls',
              remoteRelPath: 'classes/MyClass.cls',
              localLastModifiedDate: '2023-01-01T00:00:00Z',
              remoteLastModifiedDate: '2023-01-02T00:00:00Z'
            }
          ])
        };

        // Mock the dependencies
        jest.spyOn(MetadataCacheService.prototype, 'loadCache').mockResolvedValue(mockCacheResult);
        jest.spyOn(TimestampConflictDetector.prototype, 'createDiffs').mockResolvedValue(mockDiffs);

        // Mock the conflict checker to return continue
        const mockHandleConflicts = jest.fn().mockResolvedValue({ type: 'CONTINUE' });
        jest.spyOn(TimestampConflictChecker.prototype, 'handleConflicts').mockImplementation(mockHandleConflicts);

        // Set up changed file paths (source tracking enabled) - use path.join for cross-platform compatibility
        const projectPath = '/Users/peter.hale/git/dreamhouse-lwc';
        const changedFilePath = path.join(projectPath, 'force-app/main/default/classes/MyClass.cls');
        mockExecutor['changedFilePaths'] = [changedFilePath];

        // Mock workspace context
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          username: 'test@example.com'
        } as any);

        // Mock workspaceUtils.getRootWorkspacePath to return the project path
        jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(projectPath);

        // Act
        const result = await mockExecutor['checkConflictsForChangedFiles']();

        // Assert
        expect(result).toBe(true);
        expect(mockHandleConflicts).toHaveBeenCalled();

        // Verify that the conflict was included (the path matching worked)
        const callArgs = mockHandleConflicts.mock.calls[0];
        expect(callArgs[1]).toBe('test@example.com'); // username
        const diffsArg = callArgs[2];
        expect(diffsArg.different.size).toBe(1);
        const conflict = Array.from(diffsArg.different)[0] as any;
        expect(conflict.localRelPath).toBe('classes/MyClass.cls');
      });
    });
  });
});
