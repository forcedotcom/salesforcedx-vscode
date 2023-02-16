/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { WorkspaceContext } from '../../../../src/context/workspaceContext';
import { setApiVersionOn } from '../../../../src/services/sdr/componentSetUtils';

jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  return {
    ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
    TelemetryService: { getInstance: jest.fn() },
    ChannelService: jest.fn().mockImplementation(() => {
      return {};
    })
  };
});

jest.mock('../../../../src/messages', () => {
  return { loadMessageBundle: jest.fn(), nls: { localize: jest.fn() } };
});

describe('componentSetUtils', () => {
  const userConfigApiVersion = '49.0';
  const orgApiVersion = '56.0';
  let createFileSystemWatcherMock: jest.SpyInstance;
  let getUserConfiguredApiVersionMock: jest.SpyInstance;
  let workspaceContextGetConnectionMock: jest.SpyInstance;
  const mockConnection = {
    getApiVersion: jest.fn().mockReturnValue(orgApiVersion)
  } as any;
  const mockWatcher = {
    onDidChange: jest.fn(),
    onDidCreate: jest.fn(),
    onDidDelete: jest.fn()
  };

  beforeEach(() => {
    workspaceContextGetConnectionMock = jest
      .spyOn(WorkspaceContext.prototype, 'getConnection')
      .mockResolvedValue(mockConnection);
    createFileSystemWatcherMock = (vscode.workspace
      .createFileSystemWatcher as any).mockReturnValue(mockWatcher);
    getUserConfiguredApiVersionMock = jest
      .spyOn(ConfigUtil, 'getUserConfiguredApiVersion')
      .mockResolvedValue(userConfigApiVersion);
    workspaceContextGetConnectionMock = jest
      .spyOn(WorkspaceContext, 'getInstance')
      .mockReturnValue({
        getConnection: jest.fn().mockResolvedValue({
          getApiVersion: jest.fn().mockReturnValue(orgApiVersion)
        })
      } as any);
  });

  describe('setApiVersionOn', () => {
    it('should use the api version from SFDX configuration', async () => {
      const dummyComponentSet = new ComponentSet();
      await setApiVersionOn(dummyComponentSet);

      expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(mockConnection.getApiVersion).not.toHaveBeenCalled();
      expect(dummyComponentSet.apiVersion).toEqual(userConfigApiVersion);
    });

    it('should use the api version from the Org when no User-configured api version is set', async () => {
      getUserConfiguredApiVersionMock.mockResolvedValue(undefined);

      const dummyComponentSet = new ComponentSet();
      await setApiVersionOn(dummyComponentSet);

      expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(workspaceContextGetConnectionMock).toHaveBeenCalled();
      expect(dummyComponentSet.apiVersion).toEqual(orgApiVersion);
    });

    // it('should not override api version if getComponents set it already', async () => {
    //   const executor = new TestDeployRetrieve();

    //   const getComponentsResult = new ComponentSet();
    //   getComponentsResult.apiVersion = '41.0';
    //   executor.lifecycle.getComponentsStub.returns(getComponentsResult);

    //   const configApiVersion = '45.0';
    //   sb.stub(ConfigUtil, 'getUserConfiguredApiVersion').returns(
    //     configApiVersion
    //   );

    //   await executor.run({ data: {}, type: 'CONTINUE' });
    //   const components = executor.lifecycle.doOperationStub.firstCall.args[0];

    //   expect(components.apiVersion).to.equal(getComponentsResult.apiVersion);
    // });
  });
});
