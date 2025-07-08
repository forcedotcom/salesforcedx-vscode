/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  convertToCSV,
  escapeCSVField,
  formatFieldValue,
  formatFieldValueForDisplay,
  generateTableOutput
} from '../../../src/commands/dataQuery';

describe('DataQuery Pure Functions', () => {
  describe('formatFieldValueForDisplay', () => {
    it('should handle null and undefined values', () => {
      expect(formatFieldValueForDisplay(null)).toBe('');
      expect(formatFieldValueForDisplay(undefined)).toBe('');
    });

    it('should handle primitive values', () => {
      expect(formatFieldValueForDisplay('test')).toBe('test');
      expect(formatFieldValueForDisplay(123)).toBe('123');
      expect(formatFieldValueForDisplay(true)).toBe('true');
    });

    it('should handle objects with Id', () => {
      const obj = { Id: '001', Name: 'Test' };
      expect(formatFieldValueForDisplay(obj)).toBe('001');
    });

    it('should handle objects without Id', () => {
      const obj = { Name: 'Test' };
      expect(formatFieldValueForDisplay(obj)).toBe('[Object]');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(60);
      expect(formatFieldValueForDisplay(longString)).toBe(`${'a'.repeat(47)}...`);
    });

    it('should not truncate short strings', () => {
      const shortString = 'test';
      expect(formatFieldValueForDisplay(shortString)).toBe('test');
    });
  });

  describe('formatFieldValue', () => {
    it('should handle null and undefined values', () => {
      expect(formatFieldValue(null)).toBe('');
      expect(formatFieldValue(undefined)).toBe('');
    });

    it('should handle primitive values', () => {
      expect(formatFieldValue('test')).toBe('test');
      expect(formatFieldValue(123)).toBe('123');
      expect(formatFieldValue(true)).toBe('true');
    });

    it('should stringify objects', () => {
      const obj = { Id: '001', Name: 'Test' };
      expect(formatFieldValue(obj)).toBe('{"Id":"001","Name":"Test"}');
    });
  });

  describe('escapeCSVField', () => {
    it('should not escape simple fields', () => {
      expect(escapeCSVField('test')).toBe('test');
      expect(escapeCSVField('123')).toBe('123');
    });

    it('should escape fields with commas', () => {
      expect(escapeCSVField('test,value')).toBe('"test,value"');
    });

    it('should escape fields with quotes', () => {
      expect(escapeCSVField('test"value')).toBe('"test""value"');
    });

    it('should escape fields with newlines', () => {
      expect(escapeCSVField('test\nvalue')).toBe('"test\nvalue"');
    });

    it('should escape fields with carriage returns', () => {
      expect(escapeCSVField('test\rvalue')).toBe('"test\rvalue"');
    });
  });

  describe('convertToCSV', () => {
    it('should return empty string for empty records', () => {
      expect(convertToCSV([])).toBe('');
    });

    it('should convert simple records to CSV', () => {
      const records = [
        { Id: '001', Name: 'Test1' },
        { Id: '002', Name: 'Test2' }
      ];
      const expected = 'Id,Name\n001,Test1\n002,Test2';
      expect(convertToCSV(records)).toBe(expected);
    });

    it('should filter out attributes field', () => {
      const records = [{ Id: '001', Name: 'Test1', attributes: { type: 'Account' } }];
      const expected = 'Id,Name\n001,Test1';
      expect(convertToCSV(records)).toBe(expected);
    });

    it('should handle fields with special characters', () => {
      const records = [{ Id: '001', Name: 'Test,Value', Description: 'Test"Quote' }];
      const expected = 'Id,Name,Description\n001,"Test,Value","Test""Quote"';
      expect(convertToCSV(records)).toBe(expected);
    });

    it('should handle null and undefined values', () => {
      const records = [{ Id: '001', Name: null, Description: undefined }];
      const expected = 'Id,Name,Description\n001,,';
      expect(convertToCSV(records)).toBe(expected);
    });

    it('should handle object values', () => {
      const records = [{ Id: '001', Owner: { Id: '005', Name: 'John' } }];
      const expected = 'Id,Owner\n001,"{""Id"":""005"",""Name"":""John""}"';
      expect(convertToCSV(records)).toBe(expected);
    });
  });

  describe('generateTableOutput', () => {
    it('should return empty string for empty records', () => {
      expect(generateTableOutput([], 'Test Table')).toBe('');
    });

    it('should generate table for simple records', () => {
      const records = [
        { Id: '001', Name: 'Test1' },
        { Id: '002', Name: 'Test2' }
      ];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain('Test Table');
      expect(output).toContain('Id');
      expect(output).toContain('Name');
      expect(output).toContain('001');
      expect(output).toContain('002');
      expect(output).toContain('Test1');
      expect(output).toContain('Test2');
    });

    it('should filter out attributes field', () => {
      const records = [{ Id: '001', Name: 'Test1', attributes: { type: 'Account' } }];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain('Id');
      expect(output).toContain('Name');
      expect(output).not.toContain('attributes');
    });

    it('should handle long field values with truncation', () => {
      const longName = 'a'.repeat(60);
      const records = [{ Id: '001', Name: longName }];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain(`${'a'.repeat(47)}...`);
    });

    it('should handle object values', () => {
      const records = [{ Id: '001', Owner: { Id: '005', Name: 'John' } }];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain('005'); // Should show the Id from the object
    });
  });
});
