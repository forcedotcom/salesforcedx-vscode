/*
 * Copyright (c) 2026, salesforce.com, inc.
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

  describe('extractAnonApexSource', () => {
    let util: LogContextUtil;

    beforeEach(() => {
      util = new LogContextUtil();
    });

    it('Should return undefined for a log with no Execute Anonymous headers', () => {
      const log = '64.0 APEX_CODE,FINEST\n11:47:34.1 (1294793)|USER_INFO|[EXTERNAL]|005O8';
      expect(util.extractAnonApexSource(log)).toBeUndefined();
    });

    it('Should extract source lines from Execute Anonymous headers', () => {
      const log = [
        '67.0 APEX_CODE,FINEST',
        "Execute Anonymous: System.debug('hello');",
        'Execute Anonymous: Integer x = 10;',
        '11:46:26.49 (49472984)|USER_INFO|[EXTERNAL]|005O8'
      ].join('\n');
      expect(util.extractAnonApexSource(log)).toBe("System.debug('hello');\nInteger x = 10;");
    });

    it('Should handle Windows line endings in the log', () => {
      const log =
        "67.0 APEX_CODE,FINEST\r\nExecute Anonymous: System.debug('hello');\r\nExecute Anonymous: Integer x = 10;\r\n11:46:26.49|USER_INFO";
      expect(util.extractAnonApexSource(log)).toBe("System.debug('hello');\nInteger x = 10;");
    });

    it('Should stop collecting at the first non-header line after headers begin', () => {
      const log = [
        'Execute Anonymous: line1',
        'Execute Anonymous: line2',
        '11:46:26.49|USER_INFO',
        'Execute Anonymous: not collected'
      ].join('\n');
      expect(util.extractAnonApexSource(log)).toBe('line1\nline2');
    });
  });
});
