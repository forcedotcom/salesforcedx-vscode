/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigUtil, ContinueResponse, SourceTrackingService } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { channelService } from '../../../src/channels';
import { DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { DeployExecutor } from '../../../src/commands/deployExecutor';
import { SfCommandletExecutor } from '../../../src/commands/util';
import { PersistentStorageService } from '../../../src/conflict';
import { OrgType, workspaceContextUtils } from '../../../src/context';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import * as diagnostics from '../../../src/diagnostics';
import { SalesforcePackageDirectories } from '../../../src/salesforceProject';
import { DeployQueue, salesforceCoreSettings } from '../../../src/settings';

jest.mock('@salesforce/source-deploy-retrieve', () => ({
  ...jest.requireActual('@salesforce/source-deploy-retrieve'),
  ComponentSet: jest.fn().mockImplementation(() => ({
    deploy: jest.fn().mockImplementation(() => ({ pollStatus: jest.fn() })),
    getSourceComponents: jest.fn().mockReturnValue([
      { name: '1', type: 'ApexClass' },
      { name: '2', type: 'ApexClass' }
    ])
  }))
}));

jest.mock('../../../src/salesforceProject/salesforceProjectConfig');
jest.mock('../../../src/conflict/metadataCacheService');
jest.mock('../../../src/commands/util/overwriteComponentPrompt');
jest.mock('../../../src/commands/util/timestampConflictChecker');
jest.mock('../../../src/conflict/timestampConflictDetector');

describe('Deploy Executor', () => {
  const dummyProcessCwd = '/';
  const dummyUsername = 'test@username.com';
  const dummyComponentSet = new ComponentSet();
  const mockWorkspaceContext = { getConnection: jest.fn() } as any;
  const ensureLocalTrackingSpy = jest.fn();

  let getSourceTrackingSpy: jest.SpyInstance;
  let deploySpy: jest.SpyInstance;
  let getEnableSourceTrackingForDeployAndRetrieveMock: jest.SpyInstance;
  let getWorkspaceOrgTypeMock: jest.SpyInstance;

  class TestDeployExecutor extends DeployExecutor<{}> {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(s: string, t: string) {
      super(s, t);
    }

    protected getComponents(response: ContinueResponse<{}>): Promise<ComponentSet> {
      return new Promise(resolve => resolve(new ComponentSet()));
    }
  }
  class MockErrorCollection {
    public static clear(): void {
      jest.fn();
    }
  }

  beforeEach(async () => {
    jest.spyOn(process, 'cwd').mockReturnValue(dummyProcessCwd);
    jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.File } as vscode.FileStat);
    jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue(mockWorkspaceContext);
    jest.spyOn(ConfigUtil, 'getUsername').mockResolvedValue(dummyUsername);
    getWorkspaceOrgTypeMock = jest.spyOn(workspaceContextUtils, 'getWorkspaceOrgType');
    getSourceTrackingSpy = jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue({
      ensureLocalTracking: ensureLocalTrackingSpy,
      getConflicts: jest.fn().mockResolvedValue([]),
      updateTrackingFromDeploy: jest.fn().mockResolvedValue(undefined)
    } as any);
    deploySpy = jest.spyOn(dummyComponentSet, 'deploy').mockResolvedValue({
      pollStatus: jest.fn().mockResolvedValue({ response: { status: 'Succeeded' } })
    } as any);
    getEnableSourceTrackingForDeployAndRetrieveMock = jest.spyOn(
      salesforceCoreSettings,
      'getEnableSourceTrackingForDeployAndRetrieve'
    );
    getWorkspaceOrgTypeMock = jest
      .spyOn(workspaceContextUtils, 'getWorkspaceOrgType')
      .mockResolvedValue(workspaceContextUtils.OrgType.SourceTracked);
  });

  it('should create Source Tracking and call ensureLocalTracking before deploying', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.SourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    deploySpy = jest.spyOn(dummyComponentSet, 'deploy').mockResolvedValue({
      pollStatus: jest.fn().mockResolvedValue({ response: { status: 'Succeeded' } })
    } as any);
    const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(getSourceTrackingSpy).toHaveBeenCalled();
    expect(ensureLocalTrackingSpy).toHaveBeenCalled();
    expect(deploySpy).toHaveBeenCalled();
    const getSourceTrackingCallOrder = getSourceTrackingSpy.mock.invocationCallOrder[0];
    const ensureLocalTrackingSpyCallOrder = ensureLocalTrackingSpy.mock.invocationCallOrder[0];
    const deployCallOrder = deploySpy.mock.invocationCallOrder[0];
    // In order to be sure that a Source Tracking instance is initialized
    // and tracking files appropriately, getSourceTracking and ensureLocalTracking
    // need to be called before the deploy operation is started.
    expect(getSourceTrackingCallOrder).toBeLessThan(deployCallOrder);
    expect(ensureLocalTrackingSpyCallOrder).toBeLessThan(deployCallOrder);
  });

  it('should NOT create Source Tracking when connected to a source-tracked org but "Enable Source Tracking" is disabled(false)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.SourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(false);
    deploySpy = jest.spyOn(dummyComponentSet, 'deploy').mockResolvedValue({
      pollStatus: jest.fn().mockResolvedValue({ response: { status: 'Succeeded' } })
    } as any);
    const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(getSourceTrackingSpy).not.toHaveBeenCalled();
    expect(ensureLocalTrackingSpy).not.toHaveBeenCalled();
    expect(deploySpy).toHaveBeenCalled();
  });

  it('should NOT create Source Tracking and NOT call ensureLocalTracking before deploying when connected to a non-source-tracked org and "Enable Source Tracking" is disabled(false)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.NonSourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(false);
    deploySpy = jest.spyOn(dummyComponentSet, 'deploy').mockResolvedValue({
      pollStatus: jest.fn().mockResolvedValue({ response: { status: 'Succeeded' } })
    } as any);
    const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(getSourceTrackingSpy).not.toHaveBeenCalled();
    expect(ensureLocalTrackingSpy).not.toHaveBeenCalled();
    expect(deploySpy).toHaveBeenCalled();
  });

  it('should NOT create Source Tracking when connected to a non-source-tracked org even if "Enable Source Tracking" is enabled(true)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.NonSourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    deploySpy = jest.spyOn(dummyComponentSet, 'deploy').mockResolvedValue({
      pollStatus: jest.fn().mockResolvedValue({ response: { status: 'Succeeded' } })
    } as any);
    const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(getSourceTrackingSpy).not.toHaveBeenCalled();
    expect(ensureLocalTrackingSpy).not.toHaveBeenCalled();
    expect(deploySpy).toHaveBeenCalled();
  });

  it('should NOT create Source Tracking when org type is NonSourceTracked', async () => {
    // Arrange
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    getWorkspaceOrgTypeMock.mockResolvedValue(workspaceContextUtils.OrgType.NonSourceTracked);
    deploySpy = jest.spyOn(dummyComponentSet, 'deploy').mockResolvedValue({
      pollStatus: jest.fn().mockResolvedValue({ response: { status: 'Succeeded' } })
    } as any);
    const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(getWorkspaceOrgTypeMock).toHaveBeenCalled();
    expect(getSourceTrackingSpy).not.toHaveBeenCalled();
    expect(ensureLocalTrackingSpy).not.toHaveBeenCalled();
    expect(deploySpy).toHaveBeenCalled();
  });

  it('unsuccessfulOperationHandler', () => {
    // Arrange
    const mockDeployResult = {
      response: {
        status: 'Failed'
      }
    };
    const handleDeployDiagnosticsSpy = jest.spyOn(diagnostics, 'handleDeployDiagnostics').mockImplementation(jest.fn());
    DeployRetrieveExecutor.errorCollection = MockErrorCollection as any;
    const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');

    // Act
    (executor as any).unsuccessfulOperationHandler(mockDeployResult, DeployRetrieveExecutor.errorCollection);

    expect(handleDeployDiagnosticsSpy).toHaveBeenCalledWith(mockDeployResult, DeployRetrieveExecutor.errorCollection);
  });

  describe('postOperation', () => {
    let mockUnlock: any;
    let unlockSpy: any;
    let setPropertiesForFilesDeployMock: any;
    let getInstanceSpy: any;
    let getPackageDirectoryPathsSpy: any;
    let createOutputSpy: any;
    let appendLineSpy: any;
    beforeEach(() => {
      setPropertiesForFilesDeployMock = jest.fn();
      getInstanceSpy = jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
        setPropertiesForFilesDeploy: setPropertiesForFilesDeployMock
      } as any);
      getPackageDirectoryPathsSpy = jest
        .spyOn(SalesforcePackageDirectories, 'getPackageDirectoryPaths')
        .mockResolvedValue('path/to/foo' as any);
      createOutputSpy = jest
        .spyOn(TestDeployExecutor.prototype as any, 'createOutput')
        .mockReturnValue('path/to/foo' as any);
      appendLineSpy = jest.spyOn(channelService, 'appendLine').mockImplementation(jest.fn());
      mockUnlock = jest.fn();
      unlockSpy = jest.spyOn(DeployQueue, 'get').mockReturnValue({ unlock: mockUnlock } as any);
      DeployRetrieveExecutor.errorCollection = MockErrorCollection as any;
    });

    it('should clear errors on success', async () => {
      // Arrange
      const mockDeployResult = {
        response: {
          status: 'Succeeded'
        },
        getFileResponses: jest.fn().mockReturnValue([])
      };
      const deployRetrieveExecutorClearSpy = jest.spyOn(DeployRetrieveExecutor.errorCollection, 'clear');
      SfCommandletExecutor.errorCollection = MockErrorCollection as any;
      const sfCommandletExecutorClearSpy = jest.spyOn(SfCommandletExecutor.errorCollection, 'clear');

      const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');

      // Act
      await (executor as any).postOperation(mockDeployResult);

      // Assert
      expect(getInstanceSpy).toHaveBeenCalled();
      expect(getPackageDirectoryPathsSpy).toHaveBeenCalled();
      expect(createOutputSpy).toHaveBeenCalled();
      expect(appendLineSpy).toHaveBeenCalled();
      expect(setPropertiesForFilesDeployMock).toHaveBeenCalledWith(mockDeployResult);
      expect(deployRetrieveExecutorClearSpy).toHaveBeenCalled();
      expect(sfCommandletExecutorClearSpy).toHaveBeenCalled();
      expect(unlockSpy).toHaveBeenCalled();
      expect(mockUnlock).toHaveBeenCalled();
    });

    it('should create diagnostics on failure', async () => {
      // Arrange
      const mockDeployResult = {
        response: {
          status: 'Failed'
        },
        getFileResponses: jest.fn().mockReturnValue([{ state: 'Failed', filePath: 'test/path', error: 'Test error' }])
      };
      const unsuccessfulOperationHandlerSpy = jest
        .spyOn(TestDeployExecutor.prototype as any, 'unsuccessfulOperationHandler')
        .mockImplementation(jest.fn());
      const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');

      // Act
      await (executor as any).postOperation(mockDeployResult);

      // Asserts
      expect(getInstanceSpy).toHaveBeenCalled();
      expect(getPackageDirectoryPathsSpy).toHaveBeenCalled();
      expect(createOutputSpy).toHaveBeenCalled();
      expect(appendLineSpy).toHaveBeenCalled();
      expect(setPropertiesForFilesDeployMock).toHaveBeenCalledWith(mockDeployResult);
      expect(unsuccessfulOperationHandlerSpy).toHaveBeenCalledWith(
        mockDeployResult,
        DeployRetrieveExecutor.errorCollection
      );
      expect(unlockSpy).toHaveBeenCalled();
      expect(mockUnlock).toHaveBeenCalled();
    });

    it('should treat SucceededPartial as success', async () => {
      // Arrange
      const mockDeployResult = {
        response: {
          status: 'SucceededPartial'
        },
        getFileResponses: jest.fn().mockReturnValue([])
      };
      const deployRetrieveExecutorClearSpy = jest.spyOn(DeployRetrieveExecutor.errorCollection, 'clear');
      SfCommandletExecutor.errorCollection = MockErrorCollection as any;
      const sfCommandletExecutorClearSpy = jest.spyOn(SfCommandletExecutor.errorCollection, 'clear');

      const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');

      // Act
      await (executor as any).postOperation(mockDeployResult);

      // Assert
      expect(getInstanceSpy).toHaveBeenCalled();
      expect(getPackageDirectoryPathsSpy).toHaveBeenCalled();
      expect(createOutputSpy).toHaveBeenCalled();
      expect(appendLineSpy).toHaveBeenCalled();
      expect(setPropertiesForFilesDeployMock).toHaveBeenCalledWith(mockDeployResult);
      expect(deployRetrieveExecutorClearSpy).toHaveBeenCalled();
      expect(sfCommandletExecutorClearSpy).toHaveBeenCalled();
      expect(unlockSpy).toHaveBeenCalled();
      expect(mockUnlock).toHaveBeenCalled();
    });

    it('should call createOutput with correct success status for Succeeded', () => {
      // Arrange
      const mockDeployResult = {
        response: {
          status: 'Succeeded'
        },
        getFileResponses: jest.fn().mockReturnValue([])
      };
      const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');
      const createOutputSpySucceeded = jest.spyOn(executor as any, 'createOutput').mockReturnValue('test output');

      // Act
      (executor as any).createOutput(mockDeployResult, ['path/to/package']);

      // Assert
      expect(createOutputSpySucceeded).toHaveBeenCalledWith(mockDeployResult, ['path/to/package']);
    });

    it('should call createOutput with correct success status for SucceededPartial', () => {
      // Arrange
      const mockDeployResult = {
        response: {
          status: 'SucceededPartial'
        },
        getFileResponses: jest.fn().mockReturnValue([])
      };
      const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');
      const createOutputSpyPartial = jest.spyOn(executor as any, 'createOutput').mockReturnValue('test output');

      // Act
      (executor as any).createOutput(mockDeployResult, ['path/to/package']);

      // Assert
      expect(createOutputSpyPartial).toHaveBeenCalledWith(mockDeployResult, ['path/to/package']);
    });
  });
});
