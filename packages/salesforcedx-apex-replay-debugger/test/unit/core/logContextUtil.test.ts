/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogContextUtil } from '../../../src/core/logContextUtil';

describe('Log context utilities', () => {
  describe('Read log file from contents', () => {
    let util: LogContextUtil;

    beforeEach(() => {
      util = new LogContextUtil();
    });

    it('Should return empty array with empty contents', () => {
      expect(util.readLogFileFromContents('')).toHaveLength(0);
    });

    it('Should return array of log lines from contents', () => {
      const logContents = 'line1\nline2\nline3';
      const lines = util.readLogFileFromContents(logContents);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('line1');
      expect(lines[1]).toBe('line2');
      expect(lines[2]).toBe('line3');
    });

    it('Should handle Windows line endings', () => {
      const logContents = 'line1\r\nline2\r\nline3';
      const lines = util.readLogFileFromContents(logContents);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('line1');
      expect(lines[1]).toBe('line2');
      expect(lines[2]).toBe('line3');
    });

    it('Should trim whitespace', () => {
      const logContents = '  line1  \n  line2  \n  line3  ';
      const lines = util.readLogFileFromContents(logContents);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('line1');
      expect(lines[1]).toBe('line2');
      expect(lines[2]).toBe('line3');
    });

    it('Should get file size from contents', () => {
      const logContents = 'line1\nline2\nline3';
      expect(util.getFileSizeFromContents(logContents)).toBe(logContents.length);
    });

    it('Should strip brackets', () => {
      expect(util.stripBrackets('[20]')).toBe('20');
    });
  });
});
