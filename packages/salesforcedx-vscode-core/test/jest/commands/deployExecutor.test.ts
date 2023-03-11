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
import { ComponentSet, DeployResult } from '@salesforce/source-deploy-retrieve';
import { SourceConflictError } from '@salesforce/source-tracking';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { DeployExecutor } from '../../../src/commands/baseDeployRetrieve';
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

jest.mock('../../../src/conflict/metadataCacheService');

describe('Deploy Executor', () => {
  const dummyProcessCwd = '/';
  const dummyComponentSet = new ComponentSet();
  const mockWorkspaceContext = { getConnection: jest.fn() } as any;

  let workspaceContextGetInstanceSpy: jest.SpyInstance;
  let createSourceTrackingSpy: jest.SpyInstance;
  let deploySpy: jest.SpyInstance;

  class TestDeployExecutor extends DeployExecutor<{}> {
    constructor(s: string, t: string, x?: boolean) {
      super(s, t);
      if (x) {
        const dummySourceConflictError = {} as SourceConflictError;
        throw new Error('source conflict error!');
      }
    }

    protected getComponents(
      response: ContinueResponse<{}>
    ): Promise<ComponentSet> {
      return new Promise(resolve => resolve(new ComponentSet()));
    }
    protected async doOperation(
      components: ComponentSet,
      token: vscode.CancellationToken
    ): Promise<DeployResult | undefined> {
      return undefined;
    }
  }

  beforeEach(async () => {
    jest.spyOn(process, 'cwd').mockReturnValue(dummyProcessCwd);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    workspaceContextGetInstanceSpy = jest
      .spyOn(WorkspaceContext, 'getInstance')
      .mockReturnValue(mockWorkspaceContext);
    jest
      .spyOn(ConfigUtil, 'getUsername')
      .mockResolvedValue('test@username.com');
    createSourceTrackingSpy = jest
      .spyOn(SourceTrackingService, 'createSourceTracking')
      .mockResolvedValue({} as any);
    deploySpy = jest
      .spyOn(dummyComponentSet, 'deploy')
      .mockResolvedValue({ pollStatus: jest.fn() } as any);
  });

  it('should create Source Tracking before deploying', async () => {
    // Arrange
    const executor = new TestDeployExecutor('testDeploy', 'testDeployLog');
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
  });

  it('should handle a SourceConflict error', async () => {
    // Arrange
    const executor = new TestDeployExecutor(
      'testDeploy',
      'testDeployLog',
      true
    );
    // (executor as any).doOperation = jest.fn().mockImplementation(() => {
    //   throw new Error();
    // });
    (executor as any).setupCancellation = jest.fn();

    // Act

    try {
      await (executor as any).doOperation(dummyComponentSet, {});
    } catch (error) {
      console.log('Error!');
    }

    // Assert
    expect(createSourceTrackingSpy).toHaveBeenCalled();
    // expect(deploySpy).toHaveBeenCalled();
    // const createSourceTrackingCallOrder =
    //   createSourceTrackingSpy.mock.invocationCallOrder[0];
    // const deployCallOrder = deploySpy.mock.invocationCallOrder[0];
    // expect(createSourceTrackingCallOrder).toBeLessThan(deployCallOrder);
    // Todo: expect conflict to be handled
  });
});
