/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { WorkspaceContext } from '../../../../src/context/workspaceContext';
import { setApiVersionOn } from '../../../../src/services/sdr/componentSetUtils';

describe('componentSetUtils', () => {
  const configApiVersion = '56.0';
  const orgApiVersion = '55.0';
  let getUserConfiguredApiVersionMock: jest.SpyInstance;
  let workspaceContextGetInstanceMock: jest.SpyInstance;

  beforeEach(() => {
    getUserConfiguredApiVersionMock = jest
      .spyOn(ConfigUtil, 'getUserConfiguredApiVersion')
      .mockResolvedValue(configApiVersion);
    workspaceContextGetInstanceMock = jest
      .spyOn(WorkspaceContext, 'getInstance')
      .mockReturnValue({
        getConnection: jest
          .fn()
          .mockResolvedValue({ getApiVersion: orgApiVersion })
      } as any);
  });

  describe('setApiVersionOn', () => {
    it('should use the api version from SFDX configuration', async () => {
      const dummyComponentSet = new ComponentSet();
      await setApiVersionOn(dummyComponentSet);

      expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(dummyComponentSet.apiVersion).toEqual(configApiVersion);
    });

    it('should use the api version from the Org when no User-configured api version is set', async () => {
      getUserConfiguredApiVersionMock.mockResolvedValue(undefined);

      const dummyComponentSet = new ComponentSet();
      await setApiVersionOn(dummyComponentSet);

      expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(workspaceContextGetInstanceMock).toHaveBeenCalled();
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
