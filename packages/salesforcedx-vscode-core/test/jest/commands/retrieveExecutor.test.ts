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
import { OrgType, workspaceContextUtils } from '../../../src/context';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { sfdxCoreSettings } from '../../../src/settings';

jest.mock('../../../src/sfdxProject/sfdxProjectConfig');

jest.mock('../../../src/conflict/metadataCacheService');

describe('Retrieve Executor', () => {
  const dummyProcessCwd = '/';
  const dummyComponentSet = new ComponentSet();
  const mockWorkspaceContext = { getConnection: jest.fn() } as any;
  const updateTrackingFromRetrieveMock = jest.fn().mockResolvedValue({});
  const dummySourceTracking = {
    updateTrackingFromRetrieve: updateTrackingFromRetrieveMock
  } as any;
  const dummyRetrieveResult = {
    components: {},
    localComponents: {},
    response: {}
  } as any;
  const dummyRetrieveOperation = {
    pollStatus: jest.fn().mockResolvedValue(dummyRetrieveResult)
  } as any;

  let workspaceContextGetInstanceSpy: jest.SpyInstance;
  let createSourceTrackingSpy: jest.SpyInstance;
  let retrieveSpy: jest.SpyInstance;
  let pollStatusMock: jest.SpyInstance;
  let updateTrackingAfterRetrieveMock: jest.SpyInstance;
  let getWorkspaceOrgTypeMock: jest.SpyInstance;
  let getEnableSourceTrackingForDeployAndRetrieveMock: jest.SpyInstance;

  class TestRetrieveExecutor extends RetrieveExecutor<{}> {
    protected getComponents(
      response: ContinueResponse<{}>
    ): Promise<ComponentSet> {
      return new Promise(resolve => resolve(dummyComponentSet));
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
      .mockResolvedValue(dummySourceTracking);
    retrieveSpy = jest
      .spyOn(dummyComponentSet, 'retrieve')
      .mockResolvedValue(dummyRetrieveOperation);
    pollStatusMock = jest
      .spyOn(dummyRetrieveOperation, 'pollStatus')
      .mockResolvedValue(dummyRetrieveResult);
    updateTrackingAfterRetrieveMock = jest
      .spyOn(SourceTrackingService, 'updateSourceTrackingAfterRetrieve')
      .mockResolvedValue();
    getWorkspaceOrgTypeMock = jest.spyOn(
      workspaceContextUtils,
      'getWorkspaceOrgType'
    );
    getEnableSourceTrackingForDeployAndRetrieveMock = jest.spyOn(
      sfdxCoreSettings,
      'getEnableSourceTrackingForDeployAndRetrieve'
    );
  });

  it('should create Source Tracking before retrieving and update it after retrieving when connected to a source-tracked org and “Enable source tracking” is enabled(true)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.SourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    const executor = new TestRetrieveExecutor(
      'testRetrieve',
      'testRetrieveLog'
    );
    (executor as any).setupCancellation = jest.fn();
    dummyRetrieveResult.response = { status: 'SucceededPartial' };

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(createSourceTrackingSpy).toHaveBeenCalled();
    expect(retrieveSpy).toHaveBeenCalled();
    const createSourceTrackingCallOrder =
      createSourceTrackingSpy.mock.invocationCallOrder[0];
    const retrieveCallOrder = retrieveSpy.mock.invocationCallOrder[0];
    expect(createSourceTrackingCallOrder).toBeLessThan(retrieveCallOrder);
    expect(pollStatusMock).toHaveBeenCalled();
    expect(updateTrackingAfterRetrieveMock).toHaveBeenCalledWith(
      dummySourceTracking,
      dummyRetrieveResult
    );
  });

  it('should NOT update source tracking after retrieving without a successful response when “Enable source tracking” is enabled(true)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.SourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    const executor = new TestRetrieveExecutor(
      'testRetrieve',
      'testRetrieveLog'
    );
    (executor as any).setupCancellation = jest.fn();
    dummyRetrieveResult.response = { status: 'Failed' };

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(createSourceTrackingSpy).toHaveBeenCalled();
    expect(retrieveSpy).toHaveBeenCalled();
    const createSourceTrackingCallOrder =
      createSourceTrackingSpy.mock.invocationCallOrder[0];
    const retrieveCallOrder = retrieveSpy.mock.invocationCallOrder[0];
    expect(createSourceTrackingCallOrder).toBeLessThan(retrieveCallOrder);
    expect(pollStatusMock).toHaveBeenCalled();
    expect(updateTrackingAfterRetrieveMock).not.toHaveBeenCalled();
  });

  it('should NOT create Source Tracking before retrieving and NOT update it after retrieving when connected to a non-source-tracked org and “Enable source tracking” is enabled(true)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.NonSourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    const executor = new TestRetrieveExecutor(
      'testRetrieve',
      'testRetrieveLog'
    );
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(createSourceTrackingSpy).not.toHaveBeenCalled();
    expect(retrieveSpy).toHaveBeenCalled();
    expect(pollStatusMock).toHaveBeenCalled();
    expect(updateTrackingAfterRetrieveMock).not.toHaveBeenCalled();
  });

  it('should NOT create Source Tracking before retrieving and NOT update it after retrieving when connected to a source-tracked org when “Enable source tracking” is disabled(false)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.SourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(false);
    const executor = new TestRetrieveExecutor(
      'testRetrieve',
      'testRetrieveLog'
    );
    (executor as any).setupCancellation = jest.fn();
    dummyRetrieveResult.response = { status: 'SucceededPartial' };

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(createSourceTrackingSpy).not.toHaveBeenCalled();
    expect(retrieveSpy).toHaveBeenCalled();
    const retrieveCallOrder = retrieveSpy.mock.invocationCallOrder[0];
    expect(pollStatusMock).toHaveBeenCalled();
    expect(updateTrackingAfterRetrieveMock).not.toHaveBeenCalled();
  });
});
