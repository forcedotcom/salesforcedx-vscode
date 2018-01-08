/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { LogFileUtil } from '../../../src/core/logFileUtil';
import { LogEntry, NoOp } from '../../../src/events';

// tslint:disable:no-unused-expression
describe('Log file utilities', () => {
  describe('Read log file', () => {
    let util: LogFileUtil;

    beforeEach(() => {
      util = new LogFileUtil();
    });

    it('Should return empty array with bad log file', () => {
      expect(util.readLogFile('foo.log')).to.be.empty;
    });

    it('Should return array of log lines', () => {
      const logFilePath = `${process.cwd()}/test/integration/config/data/apexTest.log`;
      expect(util.readLogFile(logFilePath)).to.not.be.empty;
    });
  });

  describe('Log event parser', () => {
    let util: LogFileUtil;

    beforeEach(() => {
      util = new LogFileUtil();
    });

    it('Should detect Unsupported with empty log line', () => {
      expect(util.parseLogEvent('')).to.be.an.instanceof(NoOp);
    });

    it('Should detect Unsupported with unexpected number of fields', () => {
      expect(util.parseLogEvent('timestamp|foo')).to.be.an.instanceof(NoOp);
    });

    it('Should detect Unsupported with unknown event', () => {
      expect(util.parseLogEvent('timestamp|foo|bar')).to.be.an.instanceof(NoOp);
    });

    it('Should detect LogEntry', () => {
      expect(
        util.parseLogEvent(
          '41.0 APEX_CODE,FINEST;APEX_PROFILING,FINEST;CALLOUT,FINEST;DB,FINEST;SYSTEM,FINE;VALIDATION,INFO;VISUALFORCE,FINER;WAVE,FINEST;WORKFLOW,FINER'
        )
      ).to.be.an.instanceof(LogEntry);
    });
  });
});
