import { expect } from 'chai';
import { developerLogTraceFlag } from '../src/commands';

// tslint:disable:no-unused-expression
describe('Force Start Apex Debug Logging', () => {
  describe('Invalid start and end date', () => {
    before(() => {
      developerLogTraceFlag.setTraceFlagDebugLevelInfo(
        'fakeTraceFlagId',
        new Date().toUTCString(),
        new Date().toUTCString(),
        'fakeDebugLevelId',
        'NONE',
        'INFO'
      );
    });

    it('Should return false if date is invalid length', async () => {
      expect(developerLogTraceFlag.isValidDateLength()).to.be.false;
    });

    it('Should update dates to a 30 minute window if date length is invalid', async () => {
      expect(developerLogTraceFlag.isValidDateLength()).to.be.false;
      developerLogTraceFlag.validateDates();
      expect(
        developerLogTraceFlag.getExpirationDate().getTime() -
          developerLogTraceFlag.getStartDate().getTime()
      ).to.equal(
        developerLogTraceFlag.LOG_TIMER_LENGTH_MINUTES *
          developerLogTraceFlag.MILLISECONDS_PER_SECOND
      );
    });

    it('Should create dates with a 30 minute window when creating a new traceflag', async () => {
      developerLogTraceFlag.createTraceFlagInfo();
      expect(
        developerLogTraceFlag.getExpirationDate().getTime() -
          developerLogTraceFlag.getStartDate().getTime()
      ).to.equal(
        developerLogTraceFlag.LOG_TIMER_LENGTH_MINUTES *
          developerLogTraceFlag.MILLISECONDS_PER_SECOND
      );
    });
  });
});
