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
import { DeployExecutor } from '../../../src/commands/deployExecutor';
import { WorkspaceContext } from '../../../src/context/workspaceContext';

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

jest.mock('../../../src/commands/retrieveExecutor', () => {
  return {
    ...jest.requireActual('../../../src/commands/retrieveExecutor'),
    RetrieveExecutor: jest.fn()
  };
});

jest.mock('../../../src/conflict/metadataCacheService', () => {
  return {
    ...jest.requireActual('../../../src/conflict/metadataCacheService')
  };
});

jest.mock('../../../src/conflict/timestampConflictDetector');

jest.mock('../../../src/commands/util/postconditionCheckers');

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
  });

  it('should create Source Tracking and call ensureLocalTracking before deploying', async () => {
    // Arrange
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
});
