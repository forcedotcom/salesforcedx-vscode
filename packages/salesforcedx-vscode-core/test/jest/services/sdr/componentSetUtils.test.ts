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

jest.mock('../../../../src/context');
jest.mock('../../../../src/commands/baseDeployRetrieve.ts');
jest.mock('../../../../src/commands/util/postconditionCheckers.ts');
jest.mock('../../../../src/conflict/metadataCacheService.ts');
jest.mock('../../../../src/util/metaDataDictionary.ts');
jest.mock('vscode');
jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  return {
    // WorkspaceContextUtil: {
    // getInstance: jest.fn().mockReturnValue({ onOrgChange: jest.fn() })
    // },
    ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
    TelemetryService: { getInstance: jest.fn() },
    ChannelService: jest.fn().mockImplementation(() => {
      return {};
    }),
    ConfigUtil: {
      getUserConfiguredApiVersion: jest.fn().mockResolvedValue('56.0')
    }
  };
});

jest.mock('../../../../src/messages', () => {
  return { loadMessageBundle: jest.fn(), nls: { localize: jest.fn() } };
});

describe('componentSetUtils', () => {
  const configApiVersion = '56.0';
  // let getUserConfiguredApiVersionMock: jest.SpyInstance;
  let createFileSystemWatcherMock: jest.SpyInstance;
  let workspaceContextGetConnectionMock: jest.SpyInstance;
  let mockWatcher: any;

  beforeEach(() => {
    workspaceContextGetConnectionMock = jest
      .spyOn(WorkspaceContext.prototype, 'getConnection')
      .mockResolvedValue({
        getApiVersion: jest.fn().mockReturnValue('55.0')
      } as any);
    // getUserConfiguredApiVersionMock = jest
    //   .spyOn(ConfigUtil, 'getUserConfiguredApiVersion')
    //   .mockResolvedValue(configApiVersion);
    mockWatcher = {
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn()
    };
    createFileSystemWatcherMock = (vscode.workspace
      .createFileSystemWatcher as any).mockReturnValue(mockWatcher);
  });

  describe('setApiVersionOn', () => {
    it('should use the api version from SFDX configuration', async () => {
      const dummyComponentSet = new ComponentSet();
      await setApiVersionOn(dummyComponentSet);

      // expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(dummyComponentSet.apiVersion).toEqual(configApiVersion);
    });

    it('should use the api version from the Org when no User-configured api version is set', async () => {
      // getUserConfiguredApiVersionMock.mockResolvedValue(undefined);

      const dummyComponentSet = new ComponentSet();
      await setApiVersionOn(dummyComponentSet);

      // expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      // expect(getApiVersionMock).toHaveBeenCalled();
      expect(dummyComponentSet.apiVersion).toEqual('55.0');
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
