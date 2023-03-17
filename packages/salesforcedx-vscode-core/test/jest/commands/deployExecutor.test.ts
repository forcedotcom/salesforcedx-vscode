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
import * as vscode from 'vscode';
import { DeployExecutor } from '../../../src/commands/baseDeployRetrieve';
import { TimestampConflictChecker } from '../../../src/commands/util/postconditionCheckers';
import { MetadataCacheService } from '../../../src/conflict';
import { TimestampConflictDetector } from '../../../src/conflict/timestampConflictDetector';
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

jest.mock('../../../src/conflict/timestampConflictDetector');

jest.mock('../../../src/commands/util/postconditionCheckers');

describe('Deploy Executor', () => {
  const dummyProcessCwd = '/';
  const dummyUsername = 'test@username.com';
  const dummyComponentSet = new ComponentSet();
  const mockWorkspaceContext = { getConnection: jest.fn() } as any;
  const dummyCacheResult = {} as any;
  const dummyDiffs = {} as any;

  let workspaceContextGetInstanceSpy: jest.SpyInstance;
  let getUsernameStub: jest.SpyInstance;
  let createSourceTrackingSpy: jest.SpyInstance;
  let deploySpy: jest.SpyInstance;
  let loadCacheStub: jest.SpyInstance;
  let createDiffsStub: jest.SpyInstance;
  let handleConflictsStub: jest.SpyInstance;

  class TestDeployExecutor extends DeployExecutor<{}> {
    constructor(s: string, t: string, x?: boolean) {
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
      .mockResolvedValue({} as any);
    deploySpy = jest
      .spyOn(dummyComponentSet, 'deploy')
      .mockResolvedValue({ pollStatus: jest.fn() } as any);
    loadCacheStub = jest
      .spyOn(MetadataCacheService.prototype, 'loadCache')
      .mockResolvedValue(dummyCacheResult);
    createDiffsStub = jest
      .spyOn(TimestampConflictDetector.prototype, 'createDiffs')
      .mockReturnValue(dummyDiffs);
    handleConflictsStub = jest
      .spyOn(TimestampConflictChecker.prototype, 'handleConflicts')
      .mockResolvedValue({} as any);
  });

  it('should create Source Tracking before deploying', async () => {
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
    expect(deploySpy).toHaveBeenCalled();
    const createSourceTrackingCallOrder =
      createSourceTrackingSpy.mock.invocationCallOrder[0];
    const deployCallOrder = deploySpy.mock.invocationCallOrder[0];
    expect(createSourceTrackingCallOrder).toBeLessThan(deployCallOrder);
    expect(createSourceTrackingCallOrder).toBeLessThan(deployCallOrder);
  });

  it('should handle a SourceConflict error', async () => {
    const executor = new TestDeployExecutor(
      'testDeploy',
      'force_source_deploy_with_sourcepath_beta'
    );

    const dummySourceConflictError = {
      name: 'SourceConflictError',
      message: '2 conflicts detected',
      data: [
        {
          state: 'Conflict',
          fullName: 'Test_Apex_Class_1',
          type: 'ApexClass',
          filePath:
            '/Users/kenneth.lewis/scratchpad/TestProject-…ault/classes/Test_Apex_Class_1.cls-meta.xml'
        },
        {
          state: 'Conflict',
          fullName: 'Test_Apex_Class_1',
          type: 'ApexClass',
          filePath:
            '/Users/kenneth.lewis/scratchpad/TestProject-…/main/default/classes/Test_Apex_Class_1.cls'
        }
      ]
    };

    await (executor as any).handleSourceConflictError(dummySourceConflictError);

    const dummyConflictComponentPaths = [
      dummySourceConflictError.data[0].filePath,
      dummySourceConflictError.data[1].filePath
    ];
    expect(getUsernameStub).toHaveBeenCalled();
    expect(loadCacheStub.mock.calls[0][0]).toEqual(dummyConflictComponentPaths);
    expect(createDiffsStub.mock.calls[0][0]).toEqual(dummyCacheResult);
    expect(handleConflictsStub.mock.calls[0][0]).toEqual(
      dummyConflictComponentPaths
    );
    expect(handleConflictsStub.mock.calls[0][1]).toEqual(dummyUsername);
    expect(handleConflictsStub.mock.calls[0][2]).toEqual(dummyDiffs);
    assertCalledInOrder(getUsernameStub, loadCacheStub);
    assertCalledInOrder(loadCacheStub, createDiffsStub);
    assertCalledInOrder(createDiffsStub, handleConflictsStub);
  });
});

function assertCalledInOrder(
  spy1: jest.SpyInstance<any, any>,
  spy2: jest.SpyInstance<any, any>
) {
  return spy1.mock.invocationCallOrder[0] < spy2.mock.invocationCallOrder[0];
}
