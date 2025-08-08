/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigUtil, ContinueResponse, SourceTrackingService } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { RetrieveExecutor } from '../../../src/commands/retrieveExecutor';
import { OrgType, workspaceContextUtils } from '../../../src/context';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { salesforceCoreSettings } from '../../../src/settings';

jest.mock('../../../src/salesforceProject/salesforceProjectConfig');

jest.mock('../../../src/conflict/metadataCacheService');

describe('Retrieve Executor', () => {
  const dummyProcessCwd = path.sep;
  const dummyComponentSet = {
    size: 1, // Ensure non-zero size to avoid early return
    retrieve: jest.fn()
  } as unknown as ComponentSet;
  const mockWorkspaceContext = {
    getConnection: jest.fn().mockResolvedValue({
      getUsername: jest.fn().mockReturnValue('test@example.com')
    })
  } as unknown as WorkspaceContext;
  const updateTrackingFromRetrieveMock = jest.fn().mockResolvedValue({});
  const dummySourceTracking = {
    updateTrackingFromRetrieve: updateTrackingFromRetrieveMock,
    ensureRemoteTracking: jest.fn().mockResolvedValue(undefined),
    getConflicts: jest.fn().mockResolvedValue([])
  };
  const dummyRetrieveResult = {
    components: {},
    localComponents: {},
    response: {}
  };
  const dummyRetrieveOperation = {
    pollStatus: jest.fn().mockResolvedValue(dummyRetrieveResult)
  };

  let workspaceContextGetInstanceSpy: jest.SpyInstance;
  let getSourceTrackingSpy: jest.SpyInstance;
  let retrieveSpy: jest.SpyInstance;
  let pollStatusMock: jest.SpyInstance;
  let updateTrackingAfterRetrieveMock: jest.SpyInstance;
  let getWorkspaceOrgTypeMock: jest.SpyInstance;
  let getEnableSourceTrackingForDeployAndRetrieveMock: jest.SpyInstance;

  class TestRetrieveExecutor extends RetrieveExecutor<{}> {
    protected getComponents(response: ContinueResponse<{}>): Promise<ComponentSet> {
      return new Promise(resolve => resolve(dummyComponentSet));
    }
  }

  beforeEach(() => {
    jest.spyOn(process, 'cwd').mockReturnValue(dummyProcessCwd);
    jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.File } as vscode.FileStat);
    jest.spyOn(ConfigUtil, 'getUsername').mockResolvedValue('test@username.com');
    workspaceContextGetInstanceSpy = jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue(mockWorkspaceContext);
    getSourceTrackingSpy = jest
      .spyOn(SourceTrackingService, 'getSourceTracking')
      .mockResolvedValue(dummySourceTracking as any);
    retrieveSpy = jest.spyOn(dummyComponentSet, 'retrieve').mockResolvedValue(dummyRetrieveOperation as any);
    pollStatusMock = jest.spyOn(dummyRetrieveOperation, 'pollStatus').mockResolvedValue(dummyRetrieveResult);
    updateTrackingAfterRetrieveMock = jest
      .spyOn(SourceTrackingService, 'updateSourceTrackingAfterRetrieve')
      .mockResolvedValue();
    getWorkspaceOrgTypeMock = jest.spyOn(workspaceContextUtils, 'getWorkspaceOrgType');
    getEnableSourceTrackingForDeployAndRetrieveMock = jest.spyOn(
      salesforceCoreSettings,
      'getEnableSourceTrackingForDeployAndRetrieve'
    );
  });

  it('should create Source Tracking before retrieving and update it after retrieving when connected to a source-tracked org and "Enable source tracking" is enabled(true)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.SourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    const executor = new TestRetrieveExecutor('testRetrieve', 'testRetrieveLog');
    (executor as any).setupCancellation = jest.fn();
    dummyRetrieveResult.response = { status: 'SucceededPartial' };

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(getSourceTrackingSpy).toHaveBeenCalled();
    expect(retrieveSpy).toHaveBeenCalled();
    const getSourceTrackingCallOrder = getSourceTrackingSpy.mock.invocationCallOrder[0];
    const retrieveCallOrder = retrieveSpy.mock.invocationCallOrder[0];
    expect(getSourceTrackingCallOrder).toBeLessThan(retrieveCallOrder);
    expect(pollStatusMock).toHaveBeenCalled();
    expect(updateTrackingAfterRetrieveMock).toHaveBeenCalledWith(dummySourceTracking, dummyRetrieveResult);
  });

  it('should NOT update source tracking after retrieving without a successful response when "Enable source tracking" is enabled(true)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.SourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    const executor = new TestRetrieveExecutor('testRetrieve', 'testRetrieveLog');
    (executor as any).setupCancellation = jest.fn();
    dummyRetrieveResult.response = { status: 'Failed' };

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(getSourceTrackingSpy).toHaveBeenCalled();
    expect(retrieveSpy).toHaveBeenCalled();
    const getSourceTrackingCallOrder = getSourceTrackingSpy.mock.invocationCallOrder[0];
    const retrieveCallOrder = retrieveSpy.mock.invocationCallOrder[0];
    expect(getSourceTrackingCallOrder).toBeLessThan(retrieveCallOrder);
    expect(pollStatusMock).toHaveBeenCalled();
    expect(updateTrackingAfterRetrieveMock).not.toHaveBeenCalled();
  });

  it('should create Source Tracking before retrieving and update it after retrieving when connected to a non-source-tracked org and "Enable source tracking" is enabled(true)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.NonSourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(true);
    const executor = new TestRetrieveExecutor('testRetrieve', 'testRetrieveLog');
    (executor as any).setupCancellation = jest.fn();

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(getSourceTrackingSpy).toHaveBeenCalled();
    expect(retrieveSpy).toHaveBeenCalled();
    expect(pollStatusMock).toHaveBeenCalled();
    expect(updateTrackingAfterRetrieveMock).not.toHaveBeenCalled();
  });

  it('should create Source Tracking before retrieving and update it after retrieving when connected to a source-tracked org even when "Enable source tracking" is disabled(false)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.SourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(false);
    const executor = new TestRetrieveExecutor('testRetrieve', 'testRetrieveLog');
    (executor as any).setupCancellation = jest.fn();
    dummyRetrieveResult.response = { status: 'SucceededPartial' };

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(getSourceTrackingSpy).toHaveBeenCalled();
    expect(retrieveSpy).toHaveBeenCalled();
    expect(pollStatusMock).toHaveBeenCalled();
    expect(updateTrackingAfterRetrieveMock).toHaveBeenCalled();
  });

  it('should NOT create Source Tracking before retrieving and NOT update it after retrieving when connected to a non-source-tracked org and "Enable source tracking" is disabled(false)', async () => {
    // Arrange
    getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.NonSourceTracked);
    getEnableSourceTrackingForDeployAndRetrieveMock.mockReturnValue(false);
    const executor = new TestRetrieveExecutor('testRetrieve', 'testRetrieveLog');
    (executor as any).setupCancellation = jest.fn();
    dummyRetrieveResult.response = { status: 'SucceededPartial' };

    // Act
    await (executor as any).doOperation(dummyComponentSet, {});

    // Assert
    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(getSourceTrackingSpy).not.toHaveBeenCalled();
    expect(retrieveSpy).toHaveBeenCalled();
    expect(pollStatusMock).toHaveBeenCalled();
    expect(updateTrackingAfterRetrieveMock).not.toHaveBeenCalled();
  });
});
