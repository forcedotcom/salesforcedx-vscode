/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { LogContextUtil } from '../../../src/core/logContextUtil';

describe('Log context utilities', () => {
  describe('Read log file', () => {
    let util: LogContextUtil;

    beforeEach(() => {
      util = new LogContextUtil();
    });

    it('Should return empty array with bad log file', () => {
      expect(util.readLogFile('foo.log')).toHaveLength(0);
    });

    it('Should return array of log lines', () => {
      const logFilePath = path.join(__dirname, '..', '..', 'integration', 'config', 'logs', 'recursive.log');
      expect(util.readLogFile(logFilePath)).not.toHaveLength(0);
    });

    it('Should get file size', () => {
      const logFilePath = path.join(__dirname, '..', '..', 'integration', 'config', 'logs', 'recursive.log');
      expect(util.getFileSize(logFilePath)).toBeGreaterThan(0);
    });

    it('Should strip brackets', () => {
      expect(util.stripBrackets('[20]')).toBe('20');
    });
  });
});
