/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { RequestService } from '../../../src/commands';

describe('RequestService', () => {
  describe('ENV Variables', () => {
    it('Should set SFDX_INSTANCE_URL to instanceUrl', () => {
      const requestService = new RequestService();
      requestService.instanceUrl = 'https://www.salesforce.com';

      const envVars = requestService.getEnvVars();
      expect(envVars['SFDX_INSTANCE_URL']).to.equal(requestService.instanceUrl);
    });

    it('Should set SFDX_DEFAULTUSERNAME to accessToken', () => {
      const requestService = new RequestService();
      requestService.accessToken = '123';

      const envVars = requestService.getEnvVars();
      expect(envVars['SFDX_DEFAULTUSERNAME']).to.equal(
        requestService.accessToken
      );
    });

    it('Should set HTTP_PROXY and HTTPS_PROXY to proxyUrl', () => {
      const requestService = new RequestService();
      requestService.proxyUrl = 'some-proxy';

      const envVars = requestService.getEnvVars();
      expect(envVars['HTTP_PROXY']).to.equal(requestService.proxyUrl);
      expect(envVars['HTTPS_PROXY']).to.equal(requestService.proxyUrl);
    });
  });
});
