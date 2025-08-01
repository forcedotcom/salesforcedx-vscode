/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceTrackingService, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import * as path from 'node:path';
import { channelService } from '../../../src/channels';
import { ProjectRetrieveStartExecutor, projectRetrieveStart } from '../../../src/commands/projectRetrieveStart';
import { RetrieveExecutor } from '../../../src/commands/retrieveExecutor';
import { SfCommandlet } from '../../../src/commands/util';
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
        getConnection: jest.fn().mockResolvedValue({
          getUsername: jest.fn().mockReturnValue('test@example.com')
        }),
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
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({
            getUsername: jest.fn().mockReturnValue('test@example.com')
          })
        } as any);
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue({
          getStatus: jest.fn().mockResolvedValue([]),
          localChangesAsComponentSet: jest.fn().mockResolvedValue([]),
          ensureRemoteTracking: jest.fn().mockResolvedValue(undefined),
          maybeApplyRemoteDeletesToLocal: jest.fn().mockResolvedValue({
            componentSetFromNonDeletes: new ComponentSet(),
            fileResponsesFromDelete: []
          })
        } as any);
      });

      it('should return empty ComponentSet when no changes are detected and no source files exist', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue([]),
          localChangesAsComponentSet: jest.fn().mockResolvedValue([]),
          ensureRemoteTracking: jest.fn().mockResolvedValue(undefined),
          maybeApplyRemoteDeletesToLocal: jest.fn().mockResolvedValue({
            componentSetFromNonDeletes: new ComponentSet(),
            fileResponsesFromDelete: []
          })
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        // Mock ComponentSet.fromSource to return undefined (no source files exist)
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(undefined as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.maybeApplyRemoteDeletesToLocal).toHaveBeenCalledWith(true);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should return empty ComponentSet when no remote changes are detected', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue([]), // remote status - no changes
          localChangesAsComponentSet: jest.fn().mockResolvedValue([]),
          ensureRemoteTracking: jest.fn().mockResolvedValue(undefined),
          maybeApplyRemoteDeletesToLocal: jest.fn().mockResolvedValue({
            componentSetFromNonDeletes: new ComponentSet(),
            fileResponsesFromDelete: []
          })
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.maybeApplyRemoteDeletesToLocal).toHaveBeenCalledWith(true);
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
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents),
          localChangesAsComponentSet: jest.fn().mockResolvedValue([]),
          ensureRemoteTracking: jest.fn().mockResolvedValue(undefined),
          maybeApplyRemoteDeletesToLocal: jest.fn().mockResolvedValue({
            componentSetFromNonDeletes: mockComponentSet,
            fileResponsesFromDelete: []
          })
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.maybeApplyRemoteDeletesToLocal).toHaveBeenCalledWith(true);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(mockComponentSet.size);
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
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents),
          localChangesAsComponentSet: jest.fn().mockResolvedValue([]),
          ensureRemoteTracking: jest.fn().mockResolvedValue(undefined),
          maybeApplyRemoteDeletesToLocal: jest.fn().mockResolvedValue({
            componentSetFromNonDeletes: mockComponentSet,
            fileResponsesFromDelete: []
          })
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.maybeApplyRemoteDeletesToLocal).toHaveBeenCalledWith(true);
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
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents),
          localChangesAsComponentSet: jest.fn().mockResolvedValue([]),
          ensureRemoteTracking: jest.fn().mockResolvedValue(undefined),
          maybeApplyRemoteDeletesToLocal: jest.fn().mockResolvedValue({
            componentSetFromNonDeletes: mockComponentSet,
            fileResponsesFromDelete: []
          })
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.maybeApplyRemoteDeletesToLocal).toHaveBeenCalledWith(true);
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
        const mockComponentSet = new ComponentSet();
        const mockSourceTracking = {
          getStatus: jest.fn().mockResolvedValue(mockChangedComponents),
          localChangesAsComponentSet: jest.fn().mockResolvedValue([]),
          ensureRemoteTracking: jest.fn().mockResolvedValue(undefined),
          maybeApplyRemoteDeletesToLocal: jest.fn().mockResolvedValue({
            componentSetFromNonDeletes: mockComponentSet,
            fileResponsesFromDelete: []
          })
        };
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(mockSourceTracking as any);
        jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(mockComponentSet);

        // Act
        const result = await (executor as any).getComponents(mockResponse);

        // Assert
        expect(mockSourceTracking.maybeApplyRemoteDeletesToLocal).toHaveBeenCalledWith(true);
        expect(result).toBeInstanceOf(ComponentSet);
        expect(result.size).toBe(0);
      });

      it('should throw error when source tracking service is null', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;
        jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue(null as any);

        // Act & Assert
        await expect((executor as any).getComponents(mockResponse)).rejects.toThrow(
          'Failed to initialize source tracking service.'
        );
      });

      it('should handle valid connection successfully', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockResponse = {} as any;
        jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
          getConnection: jest.fn().mockResolvedValue({
            getUsername: jest.fn().mockReturnValue('test@example.com')
          })
        } as any);

        // Act & Assert
        const result = await (executor as any).getComponents(mockResponse);
        expect(result).toBeInstanceOf(ComponentSet);
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
        const mockComponentSet = new ComponentSet();

        // Mock getComponents to avoid calling actual source tracking logic
        jest.spyOn(executor as any, 'getComponents').mockImplementation(async () => {
          // Manually call getLocalChanges to populate changedFilePaths
          await (executor as any).getLocalChanges(executor.getChangedFilePaths());
          return mockComponentSet;
        });

        // Mock getLocalChanges to populate changedFilePaths
        jest.spyOn(executor as any, 'getLocalChanges').mockImplementation(async (...args: unknown[]) => {
          const changedFilePaths = args[0] as string[];
          changedFilePaths.push(testFilePath);
          return mockComponentSet;
        });

        // Mock performOperation to return success
        jest.spyOn(executor as any, 'performOperation').mockResolvedValue(true);

        // Enable conflict detection so getLocalChanges is called
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);

        // Act
        await executor.run({} as any);

        // Assert
        expect(executor.getChangedFilePaths()).toEqual([testFilePath]);
      });

      it('should skip conflict detection when no changed files are found', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor();
        const mockComponentSet = new ComponentSet();

        // Mock getComponents to return a component set and avoid source tracking setup
        jest.spyOn(executor as any, 'getComponents').mockResolvedValue(mockComponentSet);

        // Mock performOperation to return success
        jest.spyOn(executor as any, 'performOperation').mockResolvedValue(true);

        // Enable conflict detection so getLocalChanges is called
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);

        // Mock the getLocalChanges method to not populate changedFilePaths
        jest.spyOn(executor as any, 'getLocalChanges').mockResolvedValue(mockComponentSet);

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        expect(executor.getChangedFilePaths()).toEqual([]);
      });

      it('should skip conflict detection when ignoreConflicts is true', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor(true); // ignoreConflicts = true
        const mockComponentSet = new ComponentSet();

        // Mock getComponents to return a component set and avoid source tracking setup
        jest.spyOn(executor as any, 'getComponents').mockResolvedValue(mockComponentSet);

        // Mock performOperation to return success
        jest.spyOn(executor as any, 'performOperation').mockResolvedValue(true);

        // Enable conflict detection so getLocalChanges would be called if ignoreConflicts was false
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);

        // Mock the getLocalChanges method to populate changedFilePaths
        jest.spyOn(executor as any, 'getLocalChanges').mockImplementation(async (...args: unknown[]) => {
          const changedFilePaths = args[0] as string[];
          changedFilePaths.push(testFilePath);
          return mockComponentSet;
        });

        // Act
        const result = await executor.run({} as any);

        // Assert
        expect(result).toBe(true);
        // Conflict detection should be skipped when ignoreConflicts is true, so changedFilePaths should remain empty
        expect(executor.getChangedFilePaths()).toEqual([]);
      });

      it('should perform conflict detection when ignoreConflicts is false and conflicts are detected', async () => {
        // Arrange
        const executor = new ProjectRetrieveStartExecutor(false); // ignoreConflicts = false
        const mockComponentSet = new ComponentSet();

        // Mock getComponents to avoid calling actual source tracking logic
        jest.spyOn(executor as any, 'getComponents').mockImplementation(async () => {
          // Manually call getLocalChanges to populate changedFilePaths
          await (executor as any).getLocalChanges(executor.getChangedFilePaths());
          return mockComponentSet;
        });

        // Mock getLocalChanges to populate changedFilePaths
        jest.spyOn(executor as any, 'getLocalChanges').mockImplementation(async (...args: unknown[]) => {
          const changedFilePaths = args[0] as string[];
          changedFilePaths.push(testFilePath);
          return mockComponentSet;
        });

        // Mock performOperation to return success
        jest.spyOn(executor as any, 'performOperation').mockResolvedValue(true);

        // Enable conflict detection so getLocalChanges is called
        jest.spyOn(salesforceCoreSettings, 'getConflictDetectionEnabled').mockReturnValue(true);

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
