/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceTrackingService } from '@salesforce/salesforcedx-utils';
import {
  ConfigUtil,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import { RetrieveExecutor } from '../../../src/commands/executors/RetrieveExecutor';
import { WorkspaceContext } from '../../../src/context/workspaceContext';

const dummyProjectPath = '/a/project/path';
jest.mock('@salesforce/source-deploy-retrieve', () => {
  return {
    ...jest.requireActual('@salesforce/source-deploy-retrieve'),
    getRootWorkspacePath: () => dummyProjectPath,
    ComponentSet: jest.fn().mockImplementation(() => {
      return {
        retrieve: jest.fn().mockImplementation(() => {
          return { pollStatus: jest.fn() };
        })
      };
    })
  };
});

jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  return {
    ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
    getRootWorkspacePath: () => dummyProjectPath,
    ChannelService: jest.fn().mockImplementation(() => {
      return {};
    }),
    TelemetryService: { getInstance: jest.fn() },
    TelemetryBuilder: jest.fn()
  };
});

jest.mock('../../../src/messages', () => {
  return { loadMessageBundle: jest.fn(), nls: { localize: jest.fn() } };
});

jest.mock('../../../src/commands/util/postconditionCheckers');

jest.mock('../../../src/sfdxProject/sfdxProjectConfig');

describe('Retrieve Executor', () => {
  const dummyProcessCwd = '/';
  const workspaceContextGetInstanceSpy = jest.spyOn(
    WorkspaceContext,
    'getInstance'
  );
  const mockWorkspaceContext = { getConnection: jest.fn() } as any;
  const createSourceTrackingSpy = jest.spyOn(
    SourceTrackingService,
    'createSourceTracking'
  );
  const dummyComponentSet = new ComponentSet();
  const retrieveSpy = jest.spyOn(dummyComponentSet, 'retrieve');

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
    workspaceContextGetInstanceSpy.mockReturnValue(mockWorkspaceContext);
    createSourceTrackingSpy.mockResolvedValue({} as any);
    retrieveSpy.mockResolvedValue({ pollStatus: jest.fn() } as any);
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
