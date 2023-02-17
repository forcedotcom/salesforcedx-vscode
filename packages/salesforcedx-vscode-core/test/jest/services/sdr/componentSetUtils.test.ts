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
    ...jest.requireActual('@salesforce/salesforcedx-utils-vscode')
  };
});

jest.mock('../../../../src/messages', () => {
  return { loadMessageBundle: jest.fn(), nls: { localize: jest.fn() } };
});

describe('componentSetUtils', () => {
  const userConfigApiVersion = '49.0';
  const orgApiVersion = '56.0';
  let getUserConfiguredApiVersionMock: jest.SpyInstance;
  let workspaceContextGetConnectionMock: jest.SpyInstance;
  const mockConnection = {
    getApiVersion: jest.fn().mockReturnValue(orgApiVersion)
  } as any;

  beforeEach(() => {
    workspaceContextGetConnectionMock = jest
      .spyOn(WorkspaceContext.prototype, 'getConnection')
      .mockResolvedValue(mockConnection);
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
    it('should use the api version from SFDX configuration when it is set', async () => {
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
  });
});
