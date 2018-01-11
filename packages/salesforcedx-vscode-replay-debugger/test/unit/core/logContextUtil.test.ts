/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { LogContextUtil } from '../../../src/core/logContextUtil';
import { LogEntryState, NoOpState } from '../../../src/states';

// tslint:disable:no-unused-expression
describe('Log context utilities', () => {
  describe('Read log file', () => {
    let util: LogContextUtil;

    beforeEach(() => {
      util = new LogContextUtil();
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
    let util: LogContextUtil;

    beforeEach(() => {
      util = new LogContextUtil();
    });

    it('Should detect NoOp with empty log line', () => {
      expect(util.parseLogEvent('')).to.be.an.instanceof(NoOpState);
    });

    it('Should detect NoOp with unexpected number of fields', () => {
      expect(util.parseLogEvent('timestamp|foo')).to.be.an.instanceof(
        NoOpState
      );
    });

    it('Should detect NoOp with unknown event', () => {
      expect(util.parseLogEvent('timestamp|foo|bar')).to.be.an.instanceof(
        NoOpState
      );
    });

    it('Should detect LogEntry', () => {
      expect(
        util.parseLogEvent(
          '41.0 APEX_CODE,FINEST;APEX_PROFILING,FINEST;CALLOUT,FINEST;DB,FINEST;SYSTEM,FINE;VALIDATION,INFO;VISUALFORCE,FINER;WAVE,FINEST;WORKFLOW,FINER'
        )
      ).to.be.an.instanceof(LogEntryState);
    });
  });
});
