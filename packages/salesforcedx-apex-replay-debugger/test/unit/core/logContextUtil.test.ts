/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { LogContextUtil } from '../../../src/core/logContextUtil';

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
      const logFilePath = `${process.cwd()}/test/integration/config/logs/recursive.log`;
      expect(util.readLogFile(logFilePath)).to.not.be.empty;
    });

    it('Should strip brackets', () => {
      expect(util.stripBrackets('[20]')).to.equal('20');
    });
  });
});
