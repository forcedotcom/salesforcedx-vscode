/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { setApiVersionOn } from '../../../../src/services/sdr/componentSetUtils';

describe('componentSetUtils', () => {
  beforeEach(() => {});

  describe('setApiVersionOn', () => {
    it('should use the api version from SFDX configuration', async () => {
      const configApiVersion = '30.0';
      const getUserConfiguredApiVersionMock = jest
        .spyOn(ConfigUtil, 'getUserConfiguredApiVersion')
        .mockResolvedValue(configApiVersion);

      const dummyComponentSet = new ComponentSet();
      await setApiVersionOn(dummyComponentSet);

      expect(getUserConfiguredApiVersionMock).toHaveBeenCalled();
      expect(dummyComponentSet.apiVersion).toEqual(configApiVersion);
    });

    // it('should use the api version from the Org when no User-configured api version is set', async () => {
    //   const executor = new TestDeployRetrieve();
    //   const getUserConfiguredApiVersionStub = sb
    //     .stub(ConfigUtil, 'getUserConfiguredApiVersion')
    //     .resolves(undefined);

    //   await executor.run({ data: {}, type: 'CONTINUE' });
    //   const components = executor.lifecycle.doOperationStub.firstCall.args[0];

    //   expect(components.apiVersion).to.equal(dummyOrgApiVersion);
    //   expect(getUserConfiguredApiVersionStub.calledOnce).to.equal(true);
    //   expect(getOrgApiVersionStub.calledOnce).to.equal(true);
    // });

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
