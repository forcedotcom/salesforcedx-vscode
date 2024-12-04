/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { developerLogTraceFlag } from '../../../src/commands';

// tslint:disable:no-unused-expression
describe('Start Apex Debug Logging', () => {
  describe('Invalid start and end date', () => {
    beforeEach(() => {
      developerLogTraceFlag.setTraceFlagDebugLevelInfo(
        'fakeTraceFlagId',
        new Date().toUTCString(),
        new Date().toUTCString(),
        'fakeDebugLevelId'
      );
    });

    it('Should return false if date is invalid length', () => {
      expect(developerLogTraceFlag.isValidDateLength()).to.be.false;
    });

    it('Should update dates to a 30 minute window if date length is invalid', () => {
      expect(developerLogTraceFlag.isValidDateLength()).to.be.false;
      developerLogTraceFlag.validateDates();
      expect(
        developerLogTraceFlag.getExpirationDate().getTime() - developerLogTraceFlag.getStartDate().getTime()
      ).to.equal(developerLogTraceFlag.LOG_TIMER_LENGTH_MINUTES * developerLogTraceFlag.MILLISECONDS_PER_SECOND);
    });
  });

  describe('Validating debuglevelid', () => {
    it('Should return true if debuglevelid exists', () => {
      developerLogTraceFlag.setDebugLevelId('fakeDebugLevelId');
      expect(developerLogTraceFlag.isValidDebugLevelId()).to.be.true;
    });

    it('Should return false if debuglevelid is null', () => {
      developerLogTraceFlag.setDebugLevelId(null);
      expect(developerLogTraceFlag.isValidDebugLevelId()).to.be.false;
    });

    it('Should return false if debuglevelid is undefined', () => {
      developerLogTraceFlag.setDebugLevelId(undefined);
      expect(developerLogTraceFlag.isValidDebugLevelId()).to.be.false;
    });
  });
});
