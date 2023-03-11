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
import * as fs from 'fs';
import * as vscode from 'vscode';
import { DeployExecutor } from '../../../src/commands/deployRetrieveExecutor';
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
    private throwSourceConflictError: boolean;
    constructor(s: string, t: string, x?: boolean) {
      super(s, t);
      this.throwSourceConflictError = x ?? false;
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
  });

  it('should handle a SourceConflict error', async () => {
    /*
    // Arrange
    // const executor = new TestDeployExecutor(
    //   'testDeploy',
    //   'testDeployLog',
    //   true
    // );
    // Arrange
    deploySpy = jest.spyOn(dummyComponentSet, 'deploy').mockResolvedValue({
      pollStatus: () => {
        throw new Error('SourceConflictError');
      }
    } as any);
    const executor = new TestDeployExecutor(
      'testDeploy',
      'force_source_deploy_with_sourcepath_beta'
    );
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});
    // (executor as any).doOperation = jest.fn().mockImplementation(() => {
    //   throw new Error();
    // });
    (executor as any).setupCancellation = jest.fn();

    // Act

    // let e;
    // try {
    //   await (executor as any).doOperation(dummyComponentSet, {});
    // } catch (error) {
    //   e = error;
    //   console.log('Error!');
    // }

    // Assert
    // expect(e).toBeDefined();
    expect(() => (executor as any).doOperation(dummyComponentSet, {})).toThrow(
      Error
    );
    // expect(deploySpy).toHaveBeenCalled();
    // const createSourceTrackingCallOrder =
    //   createSourceTrackingSpy.mock.invocationCallOrder[0];
    // const deployCallOrder = deploySpy.mock.invocationCallOrder[0];
    // expect(createSourceTrackingCallOrder).toBeLessThan(deployCallOrder);
    // Todo: expect conflict to be handled
    */
  });
});
