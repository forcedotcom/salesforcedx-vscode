/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('../../../src/channels', () => ({
  channelService: { appendLine: jest.fn() }
}));
jest.mock('../../../src/messages', () => ({
  nls: {
    localize: (key: string, ...args: any[]) => {
      // Map error keys to themselves for error message tests
      const errorKeys = [
        'data_query_error_org_expired',
        'data_query_error_session_expired',
        'data_query_error_invalid_login',
        'data_query_error_insufficient_access',
        'data_query_error_malformed_query',
        'data_query_error_invalid_field',
        'data_query_error_invalid_type',
        'data_query_error_connection',
        'data_query_error_tooling_not_found',
        'data_query_error_message',
        'data_query_no_records',
        'data_query_table_title',
        'data_query_input_text',
        'data_query_running_query',
        'data_query_complete',
        'data_query_warning_limit',
        'data_query_success_message',
        'data_query_open_file',
        'parameter_gatherer_enter_soql_query',
        'REST_API',
        'REST_API_description',
        'tooling_API',
        'tooling_API_description'
      ];
      if (errorKeys.includes(key)) {
        return key;
      }
      return key;
    }
  }
}));

import { channelService } from '../../../src/channels';

import {
  convertToCSV,
  escapeCSVField,
  formatFieldValue,
  formatFieldValueForDisplay,
  generateTableOutput,
  buildQueryOptions,
  displayTableResults,
  convertQueryResultToCSV,
  formatErrorMessage
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
      const records = [{ Id: '001', Name: 'Test1', attributes: { type: 'Account', url: 'https://example.com' } }];
      const expected = 'Id,Name\n001,Test1';
      expect(convertToCSV(records)).toBe(expected);
    });

    it('should handle fields with special characters', () => {
      const records = [{ Id: '001', Name: 'Test,Value', Description: 'Test"Quote' }];
      const expected = 'Id,Name,Description\n001,"Test,Value","Test""Quote"';
      expect(convertToCSV(records)).toBe(expected);
    });

    describe('bad data handling', () => {
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

      it('should handle malformed records with undefined first record', () => {
        const records = [undefined, { Id: '001', Name: 'Test' }];
        // @ts-expect-error - bad input
        expect(convertToCSV(records)).toBe('');
      });

      it('should handle malformed records with null first record', () => {
        const records = [null, { Id: '001', Name: 'Test' }];
        // @ts-expect-error - bad input
        expect(convertToCSV(records)).toBe('');
      });

      it('should handle malformed records with non-object first record', () => {
        const records = ['not an object', { Id: '001', Name: 'Test' }];
        // @ts-expect-error - bad input
        expect(convertToCSV(records)).toBe('');
      });

      it('should handle records with empty object as first record', () => {
        const records = [{}, { Id: '001', Name: 'Test' }];
        expect(convertToCSV(records)).toBe('');
      });

      it('should handle records with malformed individual records', () => {
        const records = [{ Id: '001', Name: 'Test1' }, null, { Id: '002', Name: 'Test2' }];
        const expected = 'Id,Name\n001,Test1\n002,Test2';
        // @ts-expect-error - bad input
        expect(convertToCSV(records)).toBe(expected);
      });
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
      const records = [{ Id: '001', Name: 'Test1', attributes: { type: 'Account', url: 'https://example.com' } }];
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

    describe('bad data handling', () => {
      it('should handle malformed records with undefined first record', () => {
        const records = [undefined, { Id: '001', Name: 'Test' }];
        // @ts-expect-error - bad input
        expect(generateTableOutput(records, 'Test Table')).toBe('');
      });

      it('should handle malformed records with null first record', () => {
        const records = [null, { Id: '001', Name: 'Test' }];
        // @ts-expect-error - bad input
        expect(generateTableOutput(records, 'Test Table')).toBe('');
      });

      it('should handle malformed records with non-object first record', () => {
        const records = ['not an object', { Id: '001', Name: 'Test' }];
        // @ts-expect-error - bad input
        expect(generateTableOutput(records, 'Test Table')).toBe('');
      });

      it('should handle records with empty object as first record', () => {
        const records = [{}, { Id: '001', Name: 'Test' }];
        expect(generateTableOutput(records, 'Test Table')).toBe('');
      });

      it('should handle records with malformed individual records', () => {
        const records = [{ Id: '001', Name: 'Test1' }, null, { Id: '002', Name: 'Test2' }];
        // @ts-expect-error - bad input
        const output = generateTableOutput(records, 'Test Table');
        expect(output).toContain('Test Table');
        expect(output).toContain('Id');
        expect(output).toContain('Name');
        expect(output).toContain('001');
        expect(output).toContain('002');
      });
    });
  });

  describe('buildQueryOptions', () => {
    it('should return base options when maxFetch is undefined', () => {
      expect(buildQueryOptions()).toEqual({ autoFetch: true, scanAll: false });
    });
    it('should include maxFetch when provided', () => {
      expect(buildQueryOptions(100)).toEqual({ autoFetch: true, scanAll: false, maxFetch: 100 });
    });
  });

  describe('convertQueryResultToCSV', () => {
    it('should return no records message if records are empty', () => {
      const result = convertQueryResultToCSV({ records: [], totalSize: 0, done: true });
      expect(result).toBe('data_query_no_records');
    });
    it('should convert records to CSV if present', () => {
      const result = convertQueryResultToCSV({ records: [{ Id: '001', Name: 'Test' }], totalSize: 1, done: true });
      expect(result).toContain('Id,Name');
      expect(result).toContain('001,Test');
    });

    it('should handle null records', () => {
      // @ts-expect-error - null is not a valid type for records
      const result = convertQueryResultToCSV({ records: null, totalSize: 0, done: true });
      expect(result).toBe('data_query_no_records');
    });
  });

  describe('formatErrorMessage', () => {
    const errorCases = [
      { input: { message: 'HTTP response contains html content' }, expected: 'data_query_error_org_expired' },
      { input: { message: 'INVALID_SESSION_ID' }, expected: 'data_query_error_session_expired' },
      { input: { message: 'INVALID_LOGIN' }, expected: 'data_query_error_invalid_login' },
      { input: { message: 'INSUFFICIENT_ACCESS' }, expected: 'data_query_error_insufficient_access' },
      { input: { message: 'MALFORMED_QUERY' }, expected: 'data_query_error_malformed_query' },
      { input: { message: 'INVALID_FIELD' }, expected: 'data_query_error_invalid_field' },
      { input: { message: 'INVALID_TYPE' }, expected: 'data_query_error_invalid_type' },
      { input: { message: 'connection error' }, expected: 'data_query_error_connection' },
      { input: { message: 'tooling not found' }, expected: 'data_query_error_tooling_not_found' },
      { input: { message: 'Some other error' }, expected: 'data_query_error_message' }
    ];
    errorCases.forEach(({ input, expected }) => {
      it(`should handle error: ${input.message}`, () => {
        expect(formatErrorMessage(input)).toBe(expected);
      });
    });

    it('should handle Error instances', () => {
      const error = new Error('HTTP response contains html content');
      expect(formatErrorMessage(error)).toBe('data_query_error_org_expired');
    });

    it('should handle objects with message property', () => {
      const error = { message: 'INVALID_SESSION_ID' };
      expect(formatErrorMessage(error)).toBe('data_query_error_session_expired');
    });

    it('should handle string errors', () => {
      const error = 'Some random error message';
      expect(formatErrorMessage(error)).toBe('data_query_error_message');
    });

    it('should handle null and undefined', () => {
      expect(formatErrorMessage(null)).toBe('data_query_error_message');
      expect(formatErrorMessage(undefined)).toBe('data_query_error_message');
    });
  });

  describe('displayTableResults', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    it('should display no records message for empty results', () => {
      displayTableResults({ records: [], totalSize: 0, done: true });
      expect(channelService.appendLine).toHaveBeenCalledWith('data_query_no_records');
    });

    it('should display table for results with records', () => {
      displayTableResults({
        records: [{ Id: '001', Name: 'Test' }],
        totalSize: 1,
        done: true
      });
      expect(channelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('data_query_table_title'));
    });

    it('should handle null records', () => {
      // @ts-expect-error - null is not a valid type for records
      displayTableResults({ records: null, totalSize: 0, done: true });
      expect(channelService.appendLine).toHaveBeenCalledWith('data_query_no_records');
    });
  });
});
