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
import { RetrieveExecutor } from '../../../src/commands/baseDeployRetrieve';
import { WorkspaceContext } from '../../../src/context/workspaceContext';

jest.mock('@salesforce/source-deploy-retrieve', () => {
  return {
    ...jest.requireActual('@salesforce/source-deploy-retrieve'),
    ComponentSet: jest.fn().mockImplementation(() => {
      return {
        retrieve: jest.fn().mockImplementation(() => {
          return { pollStatus: jest.fn() };
        })
      };
    })
  };
});

jest.mock('../../../src/sfdxProject/sfdxProjectConfig');

jest.mock('../../../src/conflict/metadataCacheService');

describe('Retrieve Executor', () => {
  const dummyProcessCwd = '/';
  const dummyComponentSet = new ComponentSet();
  const mockWorkspaceContext = { getConnection: jest.fn() } as any;

  let workspaceContextGetInstanceSpy: jest.SpyInstance;
  let createSourceTrackingSpy: jest.SpyInstance;
  let retrieveSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;

  class TestRetrieveExecutor extends RetrieveExecutor<{}> {
    protected getComponents(
      response: ContinueResponse<{}>
    ): Promise<ComponentSet> {
      return new Promise(resolve => resolve(new ComponentSet()));
    }
  }

  beforeEach(async () => {
    jest.spyOn(process, 'cwd').mockReturnValue(dummyProcessCwd);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest
      .spyOn(ConfigUtil, 'getUsername')
      .mockResolvedValue('test@username.com');
    workspaceContextGetInstanceSpy = jest
      .spyOn(WorkspaceContext, 'getInstance')
      .mockReturnValue(mockWorkspaceContext);
    createSourceTrackingSpy = jest
      .spyOn(SourceTrackingService, 'createSourceTracking')
      .mockResolvedValue({} as any);
    retrieveSpy = jest
      .spyOn(dummyComponentSet, 'retrieve')
      .mockResolvedValue({ pollStatus: jest.fn() } as any);
    consoleInfoSpy = jest.spyOn(console, 'info');
  });

  it('should create Source Tracking before retrieving', async () => {
    // Arrange
    const executor = new TestRetrieveExecutor(
      'testRetrieve',
      'testRetrieveLog'
    );
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(createSourceTrackingSpy).toHaveBeenCalled();
    expect(retrieveSpy).toHaveBeenCalled();
    const createSourceTrackingCallOrder =
      createSourceTrackingSpy.mock.invocationCallOrder[0];
    const retrieveCallOrder = retrieveSpy.mock.invocationCallOrder[0];
    expect(createSourceTrackingCallOrder).toBeLessThan(retrieveCallOrder);
  });
});
