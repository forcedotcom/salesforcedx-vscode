/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ConfigUtil,
  ContinueResponse,
  SourceTrackingService
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import { DeployExecutor } from '../../../src/commands/baseDeployRetrieve';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { DeployQueue, sfdxCoreSettings } from '../../../src/settings';
import { PersistentStorageService } from '../../../src/conflict';
import { SfdxPackageDirectories } from '../../../src/sfdxProject';
import { channelService } from '../../../src/channels';

jest.mock('@salesforce/source-deploy-retrieve', () => {
  return {
    ...jest.requireActual('@salesforce/source-deploy-retrieve'),
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
jest.mock('../../../src/sfdxProject/sfdxProjectConfig');

describe('Deploy Executor', () => {
  const dummyProcessCwd = '/';
  const dummyUsername = 'test@username.com';
  const dummyComponentSet = new ComponentSet();
  const mockWorkspaceContext = { getConnection: jest.fn() } as any;
  const ensureLocalTrackingSpy = jest.fn();

  let workspaceContextGetInstanceSpy: jest.SpyInstance;
  let getUsernameStub: jest.SpyInstance;
  let createSourceTrackingSpy: jest.SpyInstance;
  let deploySpy: jest.SpyInstance;
  let getEnableSourceTrackingForDeployAndRetrieveMock: jest.SpyInstance;

  class TestDeployExecutor extends DeployExecutor<{}> {
    constructor(s: string, t: string) {
      super(s, t);
    }

    protected getComponents(
      response: ContinueResponse<{}>
    ): Promise<ComponentSet> {
      return new Promise(resolve => resolve(new ComponentSet()));
    }
  }

  beforeEach(async () => {
    jest.spyOn(process, 'cwd').mockReturnValue(dummyProcessCwd);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    workspaceContextGetInstanceSpy = jest
      .spyOn(WorkspaceContext, 'getInstance')
      .mockReturnValue(mockWorkspaceContext);
    getUsernameStub = jest
      .spyOn(ConfigUtil, 'getUsername')
      .mockResolvedValue(dummyUsername);
    createSourceTrackingSpy = jest
      .spyOn(SourceTrackingService, 'createSourceTracking')
      .mockResolvedValue({
        ensureLocalTracking: ensureLocalTrackingSpy
      } as any);
    deploySpy = jest
      .spyOn(dummyComponentSet, 'deploy')
      .mockResolvedValue({ pollStatus: jest.fn() } as any);
    getEnableSourceTrackingForDeployAndRetrieveMock = jest.spyOn(
      sfdxCoreSettings,
      'getEnableSourceTrackingForDeployAndRetrieve'
    );
  });

  it('should create Source Tracking and call ensureLocalTracking before deploying', async () => {
    // Arrange
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    deploySpy = jest
      .spyOn(dummyComponentSet, 'deploy')
      .mockResolvedValue({ pollStatus: jest.fn() } as any);
    const executor = new TestDeployExecutor(
      'testDeploy',
      'force_source_deploy_with_sourcepath_beta'
    );
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(createSourceTrackingSpy).toHaveBeenCalled();
    expect(ensureLocalTrackingSpy).toHaveBeenCalled();
    expect(deploySpy).toHaveBeenCalled();
    const createSourceTrackingCallOrder =
      createSourceTrackingSpy.mock.invocationCallOrder[0];
    const ensureLocalTrackingSpyCallOrder =
      ensureLocalTrackingSpy.mock.invocationCallOrder[0];
    const deployCallOrder = deploySpy.mock.invocationCallOrder[0];
    // In order to be sure that a Source Tracking instance is initialized
    // and tracking files appropriately, createSourceTracking and ensureLocalTracking
    // need to be called before the deploy operation is started.
    expect(createSourceTrackingCallOrder).toBeLessThan(deployCallOrder);
    expect(ensureLocalTrackingSpyCallOrder).toBeLessThan(deployCallOrder);
  });

  it('should NOT create Source Tracking and NOT call ensureLocalTracking before deploying when "Enable Source Tracking" is disabled(false)', async () => {
    // Arrange
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(false);
    deploySpy = jest
      .spyOn(dummyComponentSet, 'deploy')
      .mockResolvedValue({ pollStatus: jest.fn() } as any);
    const executor = new TestDeployExecutor(
      'testDeploy',
      'force_source_deploy_with_sourcepath_beta'
    );
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(createSourceTrackingSpy).not.toHaveBeenCalled();
    expect(ensureLocalTrackingSpy).not.toHaveBeenCalled();
    expect(deploySpy).toHaveBeenCalled();
  });

  it('should clear errors on success', async () => {
    const mockDeployResult = {
      response: { status: 'Succeeded' }
    };
    const setPropertiesForFilesDeployMock = jest.fn();
    const getInstanceSpy = jest
      .spyOn(PersistentStorageService, 'getInstance')
      .mockReturnValue({
        setPropertiesForFilesDeploy: setPropertiesForFilesDeployMock
      } as any);
    jest
      .spyOn(SfdxPackageDirectories, 'getPackageDirectoryPaths')
      .mockResolvedValue('path/to/foo' as any);
    jest
      .spyOn(TestDeployExecutor.prototype as any, 'createOutput')
      .mockReturnValue('path/to/foo' as any);
    const appendLineMock = jest
      .spyOn(channelService, 'appendLine')
      .mockImplementation(jest.fn());
    const executor = new TestDeployExecutor(
      'testDeploy',
      'force_source_deploy_with_sourcepath_beta'
    );
    (executor as any).errorCollection = { clear: jest.fn() };

    // Act
    await (executor as any).postOperation(mockDeployResult);

    // Assert
    expect(getInstanceSpy).toHaveBeenCalled();
    expect(setPropertiesForFilesDeployMock).toHaveBeenCalledWith(
      mockDeployResult
    );
    expect(TestDeployExecutor.errorCollection.clear).toHaveBeenCalled();
  });

  it('should unlock queue on failure', async () => {
    // Arrange
    const mock = jest.fn();
    const unlock = jest
      .spyOn(DeployQueue, 'get')
      .mockReturnValue({ unlock: mock } as any);
    const executor = new TestDeployExecutor(
      'testDeploy',
      'force_source_deploy_with_sourcepath_beta'
    );
    // Act
    await (executor as any).postOperation();

    // Asserts
    expect(unlock).toHaveBeenCalled();
    expect(mock).toHaveBeenCalled();
  });
});
