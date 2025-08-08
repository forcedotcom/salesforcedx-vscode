/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Lifecycle, Org, SfProject } from '@salesforce/core-bundle';
import * as sfdxUtils from '@salesforce/salesforcedx-utils-vscode';
import { workspaceUtils, fileUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as sdrBundle from '@salesforce/source-deploy-retrieve-bundle';
import {
  ComponentSet,
  ComponentSetBuilder,
  RequestStatus,
  SourceComponent
} from '@salesforce/source-deploy-retrieve-bundle';
import { ChangeResult, SourceTracking } from '@salesforce/source-tracking-bundle';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import {
  deleteSource,
  DeleteSourceExecutor,
  isManifestFile,
  showDeleteConfirmation,
  getOrgAndProject,
  moveFileToStash
} from '../../../../src/commands/deleteSource';
import * as getUriFromActiveEditor from '../../../../src/commands/util/getUriFromActiveEditor';
import { OrgType, workspaceContextUtils } from '../../../../src/context';
import { WorkspaceContext } from '../../../../src/context/workspaceContext';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { componentSetUtils } from '../../../../src/services/sdr/componentSetUtils';

describe('DeleteSource', () => {
  let mockOrg: jest.Mocked<Org>;
  let mockProject: jest.Mocked<SfProject>;
  let mockConnection: any;
  let mockWorkspaceContext: jest.Mocked<WorkspaceContext>;
  let mockComponentSet: jest.Mocked<ComponentSet>;
  let mockTracking: jest.Mocked<SourceTracking>;
  let mockSourceComponent: jest.Mocked<SourceComponent>;

  // Spies for all the modules we need to mock
  let orgCreateSpy: jest.SpyInstance;
  let sfProjectResolveSpy: jest.SpyInstance;
  let componentSetBuilderBuildSpy: jest.SpyInstance;
  let sourceTrackingCreateSpy: jest.SpyInstance;
  let workspaceUtilsHasRootWorkspaceSpy: jest.SpyInstance;
  let workspaceUtilsGetRootWorkspacePathSpy: jest.SpyInstance;
  let fileUtilsFlushFilePathSpy: jest.SpyInstance;
  let workspaceContextUtilsGetWorkspaceOrgTypeSpy: jest.SpyInstance;
  let vscodeWindowShowInformationMessageSpy: jest.SpyInstance;
  let getUriFromActiveEditorSpy: jest.SpyInstance;
  let notificationServiceShowErrorMessageSpy: jest.SpyInstance;

  const testFilePath = path.join('workspace', 'force-app', 'main', 'default', 'classes', 'Test.cls');
  const testUri = URI.file(testFilePath);

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockConnection = { accessToken: 'test-token' };
    mockOrg = {
      getUsername: jest.fn().mockReturnValue('test@test.com'),
      id: 'test-org-id'
    } as any;

    mockProject = {
      name: 'test-project',
      getPath: jest.fn().mockReturnValue(path.join(path.sep, 'workspace'))
    } as any;

    mockWorkspaceContext = {
      getConnection: jest.fn().mockResolvedValue(mockConnection)
    } as any;

    // Create a mock source component
    const mockSourceComponentData = {
      type: {
        name: 'ApexClass',
        strategies: { adapter: 'default' },
        children: { types: {} }
      },
      fullName: 'Test',
      content: testFilePath,
      xml: `${testFilePath}-meta.xml`,
      walkContent: jest.fn().mockReturnValue([testFilePath]),
      setMarkedForDelete: jest.fn()
    };
    mockSourceComponent = mockSourceComponentData as any;

    const mockDeploy = {
      pollStatus: jest.fn().mockResolvedValue({
        response: { status: RequestStatus.Succeeded, success: true }
      })
    } as any;

    mockComponentSet = {
      components: [mockSourceComponent],
      destructiveChangesPost: new Map(),
      apiVersion: '58.0',
      sourceApiVersion: '58.0',
      size: 1,
      add: jest.fn(),
      toArray: jest.fn().mockReturnValue([mockSourceComponent]),
      deploy: jest.fn().mockResolvedValue(mockDeploy),
      getSourceComponents: jest.fn().mockReturnValue({
        toArray: jest.fn().mockReturnValue([])
      }),
      [Symbol.iterator]: jest.fn().mockReturnValue({
        next: jest.fn().mockReturnValue({ done: true })
      })
    } as any;

    mockTracking = {
      getConflicts: jest.fn().mockResolvedValue([]),
      updateTrackingFromDeploy: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Setup all spies
    orgCreateSpy = jest.spyOn(Org, 'create').mockResolvedValue(mockOrg);
    sfProjectResolveSpy = jest.spyOn(SfProject, 'resolve').mockResolvedValue(mockProject);
    componentSetBuilderBuildSpy = jest.spyOn(ComponentSetBuilder, 'build').mockResolvedValue(mockComponentSet);
    sourceTrackingCreateSpy = jest.spyOn(SourceTracking, 'create').mockResolvedValue(mockTracking);

    const mockLifecycle = {
      emit: jest.fn().mockResolvedValue(undefined),
      emitTelemetry: jest.fn().mockResolvedValue(undefined)
    };
    jest.spyOn(Lifecycle, 'getInstance').mockReturnValue(mockLifecycle as any);

    // Spy on ComponentSet constructor to prevent real Salesforce API calls
    jest.spyOn(sdrBundle, 'ComponentSet').mockImplementation(() => ({ ...(mockComponentSet as any) }));

    workspaceUtilsHasRootWorkspaceSpy = jest.spyOn(workspaceUtils, 'hasRootWorkspace').mockReturnValue(true);
    workspaceUtilsGetRootWorkspacePathSpy = jest
      .spyOn(workspaceUtils, 'getRootWorkspacePath')
      .mockReturnValue(path.join(path.sep, 'workspace'));
    fileUtilsFlushFilePathSpy = jest
      .spyOn(fileUtils, 'flushFilePath')
      .mockImplementation((filePath: string) => filePath);
    workspaceContextUtilsGetWorkspaceOrgTypeSpy = jest
      .spyOn(workspaceContextUtils, 'getWorkspaceOrgType')
      .mockResolvedValue(OrgType.SourceTracked);
    jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue(mockWorkspaceContext);
    jest.spyOn(componentSetUtils, 'setApiVersion').mockResolvedValue(undefined);
    jest.spyOn(componentSetUtils, 'setSourceApiVersion').mockResolvedValue(undefined);
    jest.spyOn(nls, 'localize').mockImplementation((...args: any[]) => args[0]);
    vscodeWindowShowInformationMessageSpy = jest
      .spyOn(vscode.window, 'showInformationMessage')
      .mockResolvedValue('confirm_delete_source_button_text' as any);
    getUriFromActiveEditorSpy = jest.spyOn(getUriFromActiveEditor, 'getUriFromActiveEditor').mockResolvedValue(testUri);
    // Setup mocked utility functions using jest.spyOn
    jest.spyOn(sfdxUtils, 'createDirectory').mockResolvedValue(undefined);
    jest.spyOn(sfdxUtils, 'readFile').mockResolvedValue('test content');
    jest.spyOn(sfdxUtils, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(sfdxUtils, 'deleteFile').mockResolvedValue(undefined);
    jest.spyOn(sfdxUtils, 'rename').mockResolvedValue(undefined);
    notificationServiceShowErrorMessageSpy = jest
      .spyOn(notificationService, 'showErrorMessage')
      .mockResolvedValue(undefined);
    jest.spyOn(notificationService, 'showInformationMessage').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('DeleteSourceExecutor', () => {
    it('should instantiate correctly with all parameters', () => {
      const executor = new DeleteSourceExecutor(true, mockOrg, mockProject);
      expect(executor).toBeInstanceOf(DeleteSourceExecutor);
    });

    it('should instantiate correctly without project for non-source-tracked orgs', () => {
      const executor = new DeleteSourceExecutor(false, mockOrg);
      expect(executor).toBeInstanceOf(DeleteSourceExecutor);
    });

    it('should perform successful delete operation', async () => {
      const executor = new DeleteSourceExecutor(true, mockOrg, mockProject);

      const result = await executor.run({ type: 'CONTINUE', data: { filePath: testFilePath } });

      expect(result).toBe(true);
      expect(componentSetBuilderBuildSpy).toHaveBeenCalledWith({
        sourcepath: [testFilePath],
        projectDir: path.join(path.sep, 'workspace')
      });
      expect(mockTracking.updateTrackingFromDeploy).toHaveBeenCalled();
    });

    it('should handle conflicts in source-tracked orgs', async () => {
      const conflicts = [{ type: 'ApexClass', name: 'Test', filenames: ['Test.cls'] }] as ChangeResult[];

      // Create a new tracking mock that returns conflicts
      const conflictTracking = {
        getConflicts: jest.fn().mockResolvedValue(conflicts),
        updateTrackingFromDeploy: jest.fn().mockResolvedValue(undefined)
      };

      // Override the spy for this test
      sourceTrackingCreateSpy.mockResolvedValueOnce(conflictTracking as any);

      const executor = new DeleteSourceExecutor(true, mockOrg, undefined); // No project to trigger resolve

      await expect(executor.run({ type: 'CONTINUE', data: { filePath: testFilePath } })).rejects.toThrow(
        'Conflicts detected. Resolve conflicts before deleting.'
      );
    });

    it('should handle failed delete operation', async () => {
      const executor = new DeleteSourceExecutor(true, mockOrg, mockProject);

      // Mock a failed deployment by overriding the deployResult directly on the executor
      const failedDeployResult = {
        response: { status: RequestStatus.Failed, success: false }
      };

      // Mock the tracking for this test to return no conflicts
      const noConflictTracking = {
        getConflicts: jest.fn().mockResolvedValue([]),
        updateTrackingFromDeploy: jest.fn().mockResolvedValue(undefined)
      };
      sourceTrackingCreateSpy.mockResolvedValueOnce(noConflictTracking as any);

      // Spy on the delete method to set the deployResult
      const deleteSpy = jest.spyOn(executor as any, 'delete').mockImplementation(() => {
        (executor as any).deployResult = failedDeployResult;
        (executor as any).mixedDeployDelete = {
          delete: [{ state: 'Deleted', fullName: 'Test', type: 'ApexClass', filePath: testFilePath }],
          deploy: []
        };
        (executor as any).stashPath = new Map([[testFilePath, path.join(path.sep, 'tmp', 'stash', 'Test.cls')]]);
      });

      await expect(executor.run({ type: 'CONTINUE', data: { filePath: testFilePath } })).rejects.toThrow(
        'Delete operation failed'
      );

      deleteSpy.mockRestore();
    });

    it('should handle non-source-tracked orgs without tracking', async () => {
      const executor = new DeleteSourceExecutor(false, mockOrg);

      const result = await executor.run({ type: 'CONTINUE', data: { filePath: testFilePath } });

      expect(result).toBe(true);
      expect(sourceTrackingCreateSpy).not.toHaveBeenCalled();
    });
  });

  describe('isManifestFile', () => {
    it('should return true for manifest files', () => {
      const manifestUri = URI.file(path.join(path.sep, 'workspace', 'manifest', 'package.xml'));
      fileUtilsFlushFilePathSpy.mockReturnValue(path.join(path.sep, 'workspace', 'manifest', 'package.xml'));

      const result = isManifestFile(manifestUri);

      expect(result).toBe(true);
      expect(fileUtilsFlushFilePathSpy).toHaveBeenCalledWith(manifestUri.fsPath);
    });

    it('should return false for non-manifest files', () => {
      fileUtilsFlushFilePathSpy.mockReturnValue(testFilePath);

      const result = isManifestFile(testUri);

      expect(result).toBe(false);
    });

    it('should return false when no root workspace', () => {
      workspaceUtilsHasRootWorkspaceSpy.mockReturnValue(false);

      const result = isManifestFile(testUri);

      expect(result).toBe(false);
    });
  });

  describe('showDeleteConfirmation', () => {
    it('should return true when user confirms', async () => {
      vscodeWindowShowInformationMessageSpy.mockResolvedValue('confirm_delete_source_button_text' as any);

      const result = await showDeleteConfirmation();

      expect(result).toBe(true);
      expect(vscodeWindowShowInformationMessageSpy).toHaveBeenCalledWith(
        'delete_source_confirmation_message',
        'confirm_delete_source_button_text',
        'cancel_delete_source_button_text'
      );
    });

    it('should return false when user cancels', async () => {
      vscodeWindowShowInformationMessageSpy.mockResolvedValue('cancel_delete_source_button_text' as any);

      const result = await showDeleteConfirmation();

      expect(result).toBe(false);
    });

    it('should return false when user dismisses dialog', async () => {
      vscodeWindowShowInformationMessageSpy.mockResolvedValue(undefined);

      const result = await showDeleteConfirmation();

      expect(result).toBe(false);
    });
  });

  describe('getOrgAndProject', () => {
    it('should return org and project for source-tracked orgs', async () => {
      workspaceContextUtilsGetWorkspaceOrgTypeSpy.mockResolvedValue(OrgType.SourceTracked);

      const result = await getOrgAndProject();

      expect(result.org).toBe(mockOrg);
      expect(result.project).toBe(mockProject);
      expect(orgCreateSpy).toHaveBeenCalledWith({ connection: mockConnection });
      expect(sfProjectResolveSpy).toHaveBeenCalled();
    });

    it('should return org without project for non-source-tracked orgs', async () => {
      workspaceContextUtilsGetWorkspaceOrgTypeSpy.mockResolvedValue(OrgType.NonSourceTracked);

      const result = await getOrgAndProject();

      expect(result.org).toBe(mockOrg);
      expect(result.project).toBeUndefined();
      expect(orgCreateSpy).toHaveBeenCalledWith({ connection: mockConnection });
      expect(sfProjectResolveSpy).not.toHaveBeenCalled();
    });
  });

  describe('moveFileToStash', () => {
    it('should move file to stash location', async () => {
      const stashPath = new Map<string, string>();
      const sourceFile = path.join(path.sep, 'workspace', 'test.cls');
      const stashFile = path.join(path.sep, 'tmp', 'stash', 'test.cls');
      stashPath.set(sourceFile, stashFile);

      await moveFileToStash(stashPath, sourceFile);

      expect(sfdxUtils.createDirectory).toHaveBeenCalledWith(path.dirname(stashFile));
      expect(sfdxUtils.readFile).toHaveBeenCalledWith(sourceFile);
      expect(sfdxUtils.writeFile).toHaveBeenCalledWith(stashFile, 'test content');
      expect(sfdxUtils.deleteFile).toHaveBeenCalledWith(sourceFile);
    });
  });

  describe('deleteSource', () => {
    it('should perform complete delete operation when confirmed', async () => {
      vscodeWindowShowInformationMessageSpy.mockResolvedValue('confirm_delete_source_button_text' as any);
      fileUtilsFlushFilePathSpy.mockReturnValue(testFilePath);

      await deleteSource(testUri);

      expect(vscodeWindowShowInformationMessageSpy).toHaveBeenCalled();
      expect(componentSetBuilderBuildSpy).toHaveBeenCalled();
    });

    it('should abort when user cancels confirmation', async () => {
      vscodeWindowShowInformationMessageSpy.mockResolvedValue('cancel_delete_source_button_text' as any);

      await deleteSource(testUri);

      expect(componentSetBuilderBuildSpy).not.toHaveBeenCalled();
    });

    it('should abort for manifest files', async () => {
      const manifestUri = URI.file(path.join(path.sep, 'workspace', 'manifest', 'package.xml'));

      fileUtilsFlushFilePathSpy.mockReturnValue(path.join(path.sep, 'workspace', 'manifest', 'package.xml'));
      workspaceUtilsHasRootWorkspaceSpy.mockReturnValue(true);
      workspaceUtilsGetRootWorkspacePathSpy.mockReturnValue(path.join(path.sep, 'workspace'));

      await deleteSource(manifestUri);

      expect(notificationServiceShowErrorMessageSpy).toHaveBeenCalledWith('delete_source_manifest_unsupported_message');
      expect(componentSetBuilderBuildSpy).not.toHaveBeenCalled();
    });

    it('should use active editor URI when none provided', async () => {
      getUriFromActiveEditorSpy.mockResolvedValue(testUri);
      vscodeWindowShowInformationMessageSpy.mockResolvedValue('confirm_delete_source_button_text' as any);
      fileUtilsFlushFilePathSpy.mockReturnValue(testFilePath);

      await deleteSource(undefined as any);

      expect(getUriFromActiveEditorSpy).toHaveBeenCalledWith({
        message: 'delete_source_select_file_or_directory',
        exceptionKey: 'project_delete_source'
      });
    });

    it('should handle errors and show notification', async () => {
      const error = new Error('Test error');

      vscodeWindowShowInformationMessageSpy.mockResolvedValue('confirm_delete_source_button_text' as any);
      fileUtilsFlushFilePathSpy.mockReturnValue(testFilePath);
      componentSetBuilderBuildSpy.mockRejectedValueOnce(error);

      await expect(deleteSource(testUri)).rejects.toThrow('Test error');
      expect(notificationServiceShowErrorMessageSpy).toHaveBeenCalledWith('Delete operation failed: Test error');
    });

    it('should abort when no URI is resolved', async () => {
      getUriFromActiveEditorSpy.mockResolvedValue(undefined);

      await deleteSource(undefined as any);

      expect(componentSetBuilderBuildSpy).not.toHaveBeenCalled();
    });
  });
});
