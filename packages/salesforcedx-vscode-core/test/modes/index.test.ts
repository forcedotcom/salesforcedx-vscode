/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { isDemoMode, isProdOrg } from '../../src/modes/demo-mode';

// tslint:disable:no-unused-expression
describe('Demo Mode Utils', () => {
  describe('isDemoMode', () => {
    let originalValue: any;

    beforeEach(() => {
      originalValue = process.env.SFDX_ENV;
    });

    afterEach(() => {
      process.env.SFXD_ENV = originalValue;
    });

    it('Should report demo mode if SFDX_ENV === DEMO', () => {
      process.env.SFDX_ENV = 'DEMO';
      expect(isDemoMode()).to.be.true;
    });

    it('Should not report demo mode if SFDX_ENV !== DEMO', () => {
      process.env.SFDX_ENV = 'SOMETHING_ELSE';
      expect(isDemoMode()).to.be.false;
    });
  });

  describe('isProdOrg', () => {
    it('Should not be a prod org if trialExpirationDate is a date string', () => {
      expect(
        isProdOrg({
          status: 0,
          result: {
            orgId: '00D_BOGUS',
            username: '005_BOGUS',
            trialExpirationDate: '2021-08-08T23:59:59.000+0000'
          }
        })
      ).to.be.false;
    });

    it('Should be a prod org if trialExpirationDate is undefined', () => {
      expect(
        isProdOrg({
          status: 0,
          result: {
            orgId: '00D_BOGUS',
            username: '005_BOGUS'
          }
        })
      ).to.be.true;
    });

    it('Should be a prod org if trialExpirationDate is null', () => {
      expect(
        isProdOrg({
          status: 0,
          result: {
            orgId: '00D_BOGUS',
            username: '005_BOGUS',
            trialExpirationDate: null
          }
        })
      ).to.be.true;
    });
  });
});
