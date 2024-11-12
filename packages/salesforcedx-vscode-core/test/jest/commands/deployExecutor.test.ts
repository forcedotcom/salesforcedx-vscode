/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigUtil, ContinueResponse, SourceTrackingService } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import * as fs from 'fs';
import { channelService } from '../../../src/channels';
import { DeployExecutor, DeployRetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { SfCommandletExecutor } from '../../../src/commands/util';
import { PersistentStorageService } from '../../../src/conflict';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import * as diagnostics from '../../../src/diagnostics';
import { SalesforcePackageDirectories } from '../../../src/salesforceProject';
import { DeployQueue, salesforceCoreSettings } from '../../../src/settings';

jest.mock('@salesforce/source-deploy-retrieve-bundle', () => {
  return {
    ...jest.requireActual('@salesforce/source-deploy-retrieve-bundle'),
    ComponentSet: jest.fn().mockImplementation(() => {
      return {
        deploy: jest.fn().mockImplementation(() => {
          return { pollStatus: jest.fn() };
        }),
        getSourceComponents: jest.fn().mockReturnValue([
          { name: '1', type: 'ApexClass' },
          { name: '2', type: 'ApexClass' }
        ])
      };
    })
  };
});

jest.mock('../../../src/commands/baseDeployRetrieve', () => {
  return {
    ...jest.requireActual('../../../src/commands/baseDeployRetrieve'),
    RetrieveExecutor: jest.fn()
  };
});

jest.mock('../../../src/conflict/metadataCacheService', () => {
  return {
    ...jest.requireActual('../../../src/conflict/metadataCacheService')
  };
});

jest.mock('../../../src/commands/util/overwriteComponentPrompt');
jest.mock('../../../src/commands/util/timestampConflictChecker');
jest.mock('../../../src/conflict/timestampConflictDetector');
jest.mock('../../../src/salesforceProject/salesforceProjectConfig');

describe('Deploy Executor', () => {
  const dummyProcessCwd = '/';
  const dummyUsername = 'test@username.com';
  const dummyComponentSet = new ComponentSet();
  const mockWorkspaceContext = { getConnection: jest.fn() } as any;
  const ensureLocalTrackingSpy = jest.fn();

  let workspaceContextGetInstanceSpy: jest.SpyInstance;
  let getUsernameStub: jest.SpyInstance;
  let getSourceTrackingSpy: jest.SpyInstance;
  let deploySpy: jest.SpyInstance;
  let getEnableSourceTrackingForDeployAndRetrieveMock: jest.SpyInstance;

  class TestDeployExecutor extends DeployExecutor<{}> {
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
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    workspaceContextGetInstanceSpy = jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue(mockWorkspaceContext);
    getUsernameStub = jest.spyOn(ConfigUtil, 'getUsername').mockResolvedValue(dummyUsername);
    getSourceTrackingSpy = jest.spyOn(SourceTrackingService, 'getSourceTracking').mockResolvedValue({
      ensureLocalTracking: ensureLocalTrackingSpy
    } as any);
    deploySpy = jest.spyOn(dummyComponentSet, 'deploy').mockResolvedValue({ pollStatus: jest.fn() } as any);
    getEnableSourceTrackingForDeployAndRetrieveMock = jest.spyOn(
      salesforceCoreSettings,
      'getEnableSourceTrackingForDeployAndRetrieve'
    );
  });

  it('should create Source Tracking and call ensureLocalTracking before deploying', async () => {
    // Arrange
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    deploySpy = jest.spyOn(dummyComponentSet, 'deploy').mockResolvedValue({ pollStatus: jest.fn() } as any);
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

  it('should NOT create Source Tracking and NOT call ensureLocalTracking before deploying when "Enable Source Tracking" is disabled(false)', async () => {
    // Arrange
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(false);
    deploySpy = jest.spyOn(dummyComponentSet, 'deploy').mockResolvedValue({ pollStatus: jest.fn() } as any);
    const executor = new TestDeployExecutor('testDeploy', 'deploy_with_sourcepath');
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
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
        }
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
        }
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
  });
});
