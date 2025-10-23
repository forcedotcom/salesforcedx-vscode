/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  readLogFileFromContents,
  stripBrackets,
  getFileSizeFromContents,
  substringFromLastPeriod
} from '../../../src/core/logContextUtil';

describe('Log context utilities', () => {
  describe('Read log file from contents', () => {
    it('Should return empty array with empty contents', () => {
      expect(readLogFileFromContents('')).toHaveLength(0);
    });

    it('Should return array of log lines from contents', () => {
      const logContents = 'line1\nline2\nline3';
      const lines = readLogFileFromContents(logContents);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('line1');
      expect(lines[1]).toBe('line2');
      expect(lines[2]).toBe('line3');
    });

    it('Should handle Windows line endings', () => {
      const logContents = 'line1\r\nline2\r\nline3';
      const lines = readLogFileFromContents(logContents);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('line1');
      expect(lines[1]).toBe('line2');
      expect(lines[2]).toBe('line3');
    });

    it('Should trim whitespace', () => {
      const logContents = '  line1  \n  line2  \n  line3  ';
      const lines = readLogFileFromContents(logContents);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('line1');
      expect(lines[1]).toBe('line2');
      expect(lines[2]).toBe('line3');
    });

    it('Should get file size from contents', () => {
      const logContents = 'line1\nline2\nline3';
      expect(getFileSizeFromContents(logContents)).toBe(logContents.length);
    });

    it('Should strip brackets', () => {
      expect(stripBrackets('[20]')).toBe('20');
    });
  });

  describe('substringFromLastPeriod', () => {
    it('Should return substring after last period', () => {
      expect(substringFromLastPeriod('com.example.MyClass')).toBe('MyClass');
    });

    it('Should return original string if no period', () => {
      expect(substringFromLastPeriod('MyClass')).toBe('MyClass');
    });

    it('Should handle multiple periods', () => {
      expect(substringFromLastPeriod('a.b.c.d.e')).toBe('e');
    });

    it('Should handle trailing period', () => {
      expect(substringFromLastPeriod('example.')).toBe('');
    });

    it('Should handle empty string', () => {
      expect(substringFromLastPeriod('')).toBe('');
    });

    it('Should handle single period', () => {
      expect(substringFromLastPeriod('.')).toBe('');
    });
  });
});
