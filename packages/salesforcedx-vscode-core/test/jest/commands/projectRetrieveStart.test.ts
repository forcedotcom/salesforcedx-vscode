/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { workspaceUtils, SourceTrackingService } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import * as path from 'node:path';
import { channelService } from '../../../src/channels';
import { DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { ProjectRetrieveStartExecutor, projectRetrieveStart } from '../../../src/commands/projectRetrieveStart';
import { RetrieveExecutor } from '../../../src/commands/retrieveExecutor';
import { SfCommandletExecutor, SfCommandlet } from '../../../src/commands/util';

import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { SalesforcePackageDirectories } from '../../../src/salesforceProject';
import { salesforceCoreSettings } from '../../../src/settings';
import { telemetryService } from '../../../src/telemetry';

const testProjectPath = path.resolve('test', 'project', 'path');
const testFilePath = path.join(testProjectPath, 'force-app', 'main', 'default', 'classes', 'TestClass.cls');

jest.mock('../../../src/services/sdr/componentSetUtils', () => ({
  componentSetUtils: {
    setApiVersion: jest.fn().mockResolvedValue(undefined),
    setSourceApiVersion: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('ProjectRetrieveStart', () => {
  describe('ProjectRetrieveStartExecutor', () => {
    beforeEach(() => {
      jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(testProjectPath);
      jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(new ComponentSet());
      jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(false);
      jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(false);
      jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
        getConnection: jest.fn().mockResolvedValue({}),
        username: 'test@example.com'
      } as any);
      jest.spyOn(SalesforcePackageDirectories, 'getDefaultPackageDir').mockResolvedValue('force-app');
      jest.spyOn(SalesforcePackageDirectories, 'getPackageDirectoryPaths').mockResolvedValue(['force-app']);
      jest.spyOn(RetrieveExecutor.prototype, 'run').mockResolvedValue(true);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('constructor', () => {
      it('should create executor with default ignoreConflicts value', () => {
        const executor = new ProjectRetrieveStartExecutor();
        expect(executor.getChangedFilePaths()).toEqual([]);
      });

      it('should create executor with ignoreConflicts set to true', () => {
        const executor = new ProjectRetrieveStartExecutor(true);
        expect(executor.getChangedFilePaths()).toEqual([]);
      });
    });

    describe('getComponents', () => {
      beforeEach(() => {
        jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(testProjectPath);
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(new ComponentSet());
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(false);
      });

      it('should return ComponentSet from project source when source tracking is disabled', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(workspaceUtils.getRootWorkspacePath).toHaveBeenCalled();
        expect(ComponentSet.fromSource).toHaveBeenCalledWith(testProjectPath);
        expect(result).toBeInstanceOf(ComponentSet);
      });

      it('should handle empty project path gracefully', async () => {
        // Arrange
        jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('');
        const executor = new ProjectRetrieveStartExecutor();
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
        jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(testProjectPath);
        jest.spyOn(salesforceCoreSettings, 'getEnableSourceTrackingForDeployAndRetrieve').mockReturnValue(true);
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({})
        } as any);
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue({
          getStatus: jest.fn().mockResolvedValue([])
        } as any);
      });

      it('should return empty ComponentSet when no changes are detected and no source files exist', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue([])
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        // Mock ComponentSet.fromSource to return undefined (no source files exist)
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(undefined as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.getStatus).toHaveBeenCalledWith({ local: false, remote: true });
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no remote changes are detected', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue([]) // remote status - no changes
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.getStatus).toHaveBeenCalledWith({ local: false, remote: true });
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return ComponentSet with changed components when changes are detected', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: testFilePath,
            origin: 'remote',
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
        expect(mockSourceTracking.getStatus).toHaveBeenCalledWith({ local: false, remote: true });
        expect(ComponentSet.fromSource).toHaveBeenCalledWith([testFilePath]);
        expect(result).toBeInstanceOf(ComponentSet);
      });

      it('should filter out ignored components', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: testFilePath,
            origin: 'remote',
            ignored: true // This should be filtered out
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
        expect(ComponentSet.fromSource).not.toHaveBeenCalled(); // Should not be called when no components
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should filter out non-remote components', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: testFilePath,
            origin: 'local', // This should be filtered out
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
        expect(ComponentSet.fromSource).not.toHaveBeenCalled(); // Should not be called when no components
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should filter out deleted components', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;
        const mockChangedComponents = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: testFilePath,
            origin: 'remote',
            ignored: false,
            state: 'delete' // This should be filtered out
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
        expect(ComponentSet.fromSource).not.toHaveBeenCalled(); // Should not be called when no components
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should throw error when source tracking service is null', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
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
        const executor = new ProjectRetrieveStartExecutor();
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
    });

    describe('checkConflictsForChangedFiles', () => {
      beforeEach(() => {
        jest.spyOn(channelService, 'showCommandWithTimestamp').mockImplementation(() => {});
        jest.spyOn(channelService, 'appendLine').mockImplementation(() => {});
        jest.spyOn(telemetryService, 'sendException').mockImplementation(() => {});
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          username: 'test@example.com'
        } as any);
      });

      it('should store changed file paths in executor for conflict detection', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockLocalChanges = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: testFilePath,
            origin: 'local',
            ignored: false
          }
        ];
        const mockRemoteChanges = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: testFilePath,
            origin: 'remote',
            ignored: false
          }
        ];
        const mockSourceTracking = {
          getStatus: jest
            .fn()
            .mockResolvedValueOnce(mockLocalChanges) // First call for local changes
            .mockResolvedValueOnce(mockRemoteChanges) // Second call for remote changes
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
        expect(executor.getChangedFilePaths()).toEqual([testFilePath]);
      });

      it('should skip conflict detection when no changed files are found', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
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

        // Mock error collections
        const mockErrorCollection = { clear: jest.fn() };
        DeployRetrieveExecutor.errorCollection = mockErrorCollection as any;
        SfCommandletExecutor.errorCollection = mockErrorCollection as any;

        // Mock the doOperation method to return success
        jest.spyOn(executor as any, 'doOperation').mockResolvedValue({
          response: { status: 'Succeeded' },
          getFileResponses: jest.fn().mockReturnValue([])
        });

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(false);
        expect(executor.getChangedFilePaths()).toEqual([]);
      });

      it('should skip conflict detection when ignoreConflicts is true', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor(true); // ignoreConflicts = true
        const mockLocalChanges = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: testFilePath,
            origin: 'local',
            ignored: false
          }
        ];
        const mockRemoteChanges = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: testFilePath,
            origin: 'remote',
            ignored: false
          }
        ];
        const mockSourceTracking = {
          getStatus: jest
            .fn()
            .mockResolvedValueOnce(mockLocalChanges) // First call for local changes
            .mockResolvedValueOnce(mockRemoteChanges) // Second call for remote changes
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
          }
        };
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet as any);

        // Mock the doOperation method to return success
        jest.spyOn(executor as any, 'doOperation').mockResolvedValue({
          response: { status: 'Succeeded' },
          getFileResponses: jest.fn().mockReturnValue([])
        });

        // Mock error collections
        const mockErrorCollection = { clear: jest.fn() };
        DeployRetrieveExecutor.errorCollection = mockErrorCollection as any;
        SfCommandletExecutor.errorCollection = mockErrorCollection as any;

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        // Conflict detection should be skipped even though we have changed files and the setting is enabled
        expect(executor.getChangedFilePaths()).toEqual([testFilePath]);
      });

      it('should perform conflict detection when ignoreConflicts is false and conflicts are detected', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor(false); // ignoreConflicts = false
        const mockLocalChanges = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: testFilePath,
            origin: 'local',
            ignored: false
          }
        ];
        const mockRemoteChanges = [
          {
            fullName: 'TestClass',
            type: 'ApexClass',
            filePath: testFilePath,
            origin: 'remote',
            ignored: false
          }
        ];
        const mockSourceTracking = {
          getStatus: jest
            .fn()
            .mockResolvedValueOnce(mockLocalChanges) // First call for local changes
            .mockResolvedValueOnce(mockRemoteChanges) // Second call for remote changes
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
          }
        };
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet as any);

        // Mock the doOperation method to return success
        jest.spyOn(executor as any, 'doOperation').mockResolvedValue({
          response: { status: 'Succeeded' },
          getFileResponses: jest.fn().mockReturnValue([])
        });

        // Mock the checkConflictsForChangedFiles method to return true (user continued)
        jest.spyOn(executor as any, 'checkConflictsForChangedFiles').mockResolvedValue(true);

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        expect(executor.getChangedFilePaths()).toEqual([testFilePath]);
      });
    });
  });

  describe('projectRetrieveStart function', () => {
    beforeEach(() => {
      jest.spyOn(SfCommandlet.prototype, 'run').mockResolvedValue(undefined);
    });

    it('should create commandlet and run with default ignoreConflicts value', async () => {
      // Act
      await projectRetrieveStart();

      // Assert
      expect(SfCommandlet.prototype.run).toHaveBeenCalled();
    });

    it('should create commandlet and run with ignoreConflicts set to true', async () => {
      // Act
      await projectRetrieveStart(true);

      // Assert
      expect(SfCommandlet.prototype.run).toHaveBeenCalled();
    });
  });
});
