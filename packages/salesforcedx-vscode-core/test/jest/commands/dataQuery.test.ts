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
      expect(formatFieldValueForDisplay(obj)).toBe('001, Test'); // Shows just the values
    });

    it('should handle objects without Id', () => {
      const obj = { Name: 'Test' };
      expect(formatFieldValueForDisplay(obj)).toBe('Test'); // Shows just the values
    });

    it('should fallback to [Object] when no meaningful field exists', () => {
      const obj = { attributes: { type: 'Account' }, someNumber: 123 };
      expect(formatFieldValueForDisplay(obj)).toBe('123'); // Shows just the values
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(60);
      expect(formatFieldValueForDisplay(longString)).toBe(`${'a'.repeat(47)}...`);
    });

    it('should not truncate short strings', () => {
      const shortString = 'test';
      expect(formatFieldValueForDisplay(shortString)).toBe('test');
    });

    it('should handle objects with multiple fields', () => {
      const obj = { Name: 'John Doe', Email: 'john@example.com', Phone: '555-1234' };
      expect(formatFieldValueForDisplay(obj)).toBe('John Doe, john@example.com, 555-1234');
    });

    it('should filter out attributes field from objects', () => {
      const obj = {
        attributes: { type: 'User', url: '/services/data/v60.0/sobjects/User/005XX' },
        Name: 'John Doe',
        Id: '005XX0000001'
      };
      expect(formatFieldValueForDisplay(obj)).toBe('John Doe, 005XX0000001');
      expect(formatFieldValueForDisplay(obj)).not.toContain('type');
      expect(formatFieldValueForDisplay(obj)).not.toContain('url');
    });

    it('should handle objects with only attributes field', () => {
      const obj = { attributes: { type: 'User', url: '/services/data/v60.0/sobjects/User/005XX' } };
      expect(formatFieldValueForDisplay(obj)).toBe('[Object]');
    });

    it('should handle objects with null and undefined values', () => {
      const obj = { Name: 'John Doe', NullField: null, UndefinedField: undefined, EmptyString: '' };
      expect(formatFieldValueForDisplay(obj)).toBe('John Doe, null, undefined, ');
    });

    it('should handle objects with numeric and boolean values', () => {
      const obj = { Name: 'Test', Count: 42, IsActive: true, Score: 3.14, IsDeleted: false };
      expect(formatFieldValueForDisplay(obj)).toBe('Test, 42, true, 3.14, false');
    });

    it('should handle objects with date values', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      const obj = { Name: 'Test', CreatedDate: date };
      const result = formatFieldValueForDisplay(obj);
      expect(result).toContain('Test');
      expect(result).toContain('2023'); // Should contain the year from the date
      // Note: Date string might be truncated due to 50 character limit
    });

    it('should truncate long comma-separated values', () => {
      const obj = {
        Field1: 'Very long value that should be truncated because it exceeds the limit',
        Field2: 'Another very long value that will make the total exceed 50 characters'
      };
      const result = formatFieldValueForDisplay(obj);
      expect(result).toHaveLength(50); // Should be exactly 50 characters (47 + '...')
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle nested objects within objects', () => {
      const obj = {
        Name: 'Test',
        NestedObject: { Id: '001XX', Name: 'Nested' }
      };
      expect(formatFieldValueForDisplay(obj)).toBe('Test, [object Object]');
    });

    it('should handle arrays within objects', () => {
      const obj = {
        Name: 'Test',
        Tags: ['tag1', 'tag2', 'tag3']
      };
      expect(formatFieldValueForDisplay(obj)).toBe('Test, tag1,tag2,tag3');
    });

    it('should handle empty objects', () => {
      expect(formatFieldValueForDisplay({})).toBe('[Object]');
    });

    it('should handle objects with special characters', () => {
      const obj = {
        Name: 'Test & Co.',
        Description: 'Special chars: <>&"\'',
        Unicode: '🚀 Unicode test'
      };
      expect(formatFieldValueForDisplay(obj)).toBe('Test & Co., Special chars: <>&"\', 🚀 Unicode test');
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

      expect(output).toContain('005'); // Shows the Id from the object (prioritized over Name)
    });

    it('should handle dot notation fields from SOQL', () => {
      // When querying SELECT Createdby.Name FROM Account, Salesforce returns flattened field names
      const records = [{ Id: '001', 'Createdby.Name': 'Jane Doe' }];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain('Jane Doe'); // Should show the actual value, not [Object]
      expect(output).toContain('Createdby.Name'); // Should show the field name as column header
    });

    it('should handle relationship objects without dot notation', () => {
      // When querying SELECT Createdby FROM Account, Salesforce returns the whole object
      const records = [
        { Id: '001', Createdby: { Id: '005XX0000000001', Name: 'Jane Doe', Username: 'jane@example.com' } }
      ];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain('Createdby.Id'); // Should create separate column for nested Id
      expect(output).toContain('Createdby.Name'); // Should create separate column for nested Name
      expect(output).toContain('005XX0000000001'); // Should show the actual Id value
      expect(output).toContain('Jane Doe'); // Should show the actual Name value
      expect(output).not.toContain('[Object]'); // Should not show [Object]
    });

    it('should flatten nested objects into separate columns', () => {
      // Test case similar to "SELECT Account.Id, Account.Name FROM Contact"
      const records = [{ Id: '003XX0000001', Account: { Id: '001Hr00001lNW3IIAW', Name: 'Edge Communications' } }];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain('Account.Id'); // Should have separate column for Account.Id
      expect(output).toContain('Account.Name'); // Should have separate column for Account.Name
      expect(output).toContain('001Hr00001lNW3IIAW'); // Should show the account Id
      expect(output).toContain('Edge Communications'); // Should show the account Name
      expect(output).not.toContain('001Hr00001lNW3IIAW, Edge Communications'); // Should not combine values
    });

    it('should handle mixed null and non-null relationship objects', () => {
      // Test case for "SELECT Id, ApexClass.Name, ApexClass.ApiVersion FROM ApexTestResult"
      // where some records have null ApexClass and others don't
      const records = [
        { Id: '07MHr000007AtGNMA0', ApexClass: null },
        { Id: '07MHr000007B0ZRMA0', ApexClass: { Name: 'MyUnitTest', ApiVersion: 64 } },
        { Id: '07MHr000007B1akMAC', ApexClass: { Name: 'FileUtilitiesTest', ApiVersion: 63 } }
      ];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain('ApexClass.Name'); // Should have separate column for ApexClass.Name
      expect(output).toContain('ApexClass.ApiVersion'); // Should have separate column for ApexClass.ApiVersion
      expect(output).toContain('MyUnitTest'); // Should show the class name
      expect(output).toContain('FileUtilitiesTest'); // Should show the other class name
      expect(output).toContain('64'); // Should show the API version
      expect(output).toContain('63'); // Should show the other API version
      expect(output).not.toContain('ApexClass  '); // Should NOT have empty ApexClass column
    });

    it('should preserve field order and put Id first', () => {
      // Test that Id appears first and field order is preserved
      const records = [
        { Id: '07MHr000007AtGNMA0', ApexClass: null },
        { Id: '07MHr000007B0ZRMA0', ApexClass: { Name: 'MyUnitTest', ApiVersion: 64 } }
      ];
      const output = generateTableOutput(records, 'Test Table');

      // Id should appear before ApexClass fields
      const idIndex = output.indexOf('Id');
      const apexClassNameIndex = output.indexOf('ApexClass.Name');
      const apexClassApiVersionIndex = output.indexOf('ApexClass.ApiVersion');

      expect(idIndex).toBeLessThan(apexClassNameIndex);
      expect(idIndex).toBeLessThan(apexClassApiVersionIndex);
      expect(apexClassNameIndex).toBeLessThan(apexClassApiVersionIndex);
    });

    it('should handle complex nested objects with multiple levels', () => {
      const records = [
        {
          Id: '001XX0000001',
          Account: {
            Id: '001XX0000002',
            Name: 'Test Account',
            Owner: { Id: '005XX0000001', Name: 'John Doe' }
          }
        }
      ];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain('Account.Id');
      expect(output).toContain('Account.Name');
      expect(output).toContain('Account.Owner'); // Complex nested object should show as comma-separated
      expect(output).toContain('005XX0000001, John Doe'); // Owner values should be joined
    });

    it('should handle records with attributes field properly', () => {
      const records = [
        {
          attributes: { type: 'Account', url: '/services/data/v60.0/sobjects/Account/001XX' },
          Id: '001XX0000001',
          Name: 'Test Account',
          Owner: {
            attributes: { type: 'User', url: '/services/data/v60.0/sobjects/User/005XX' },
            Id: '005XX0000001',
            Name: 'John Doe'
          }
        }
      ];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).not.toContain('attributes'); // Should not show attributes columns
      expect(output).toContain('Id');
      expect(output).toContain('Name');
      expect(output).toContain('Owner.Id');
      expect(output).toContain('Owner.Name');
      expect(output).not.toContain('type'); // Should not show attributes content
      expect(output).not.toContain('url'); // Should not show attributes content
    });

    it('should handle empty nested objects', () => {
      const records = [{ Id: '001XX0000001', EmptyRelation: {} }];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain('Id');
      expect(output).not.toContain('EmptyRelation'); // Empty objects should not create columns
    });

    it('should handle deeply nested objects', () => {
      const records = [
        {
          Id: '001XX0000001',
          Level1: {
            Id: '002XX0000001',
            Level2: {
              Id: '003XX0000001',
              Name: 'Deep Value'
            }
          }
        }
      ];
      const output = generateTableOutput(records, 'Test Table');

      expect(output).toContain('Id');
      expect(output).toContain('Level1.Id');
      expect(output).toContain('Level1.Level2'); // Deep nesting should be comma-separated
      expect(output).toContain('003XX0000001, Deep Value');
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
        const output = generateTableOutput(records, 'Test Table');
        // Should still generate table by examining all records, not just the first
        expect(output).toContain('Id');
        expect(output).toContain('Name');
        expect(output).toContain('001');
        expect(output).toContain('Test');
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

    it('should add newline before table output', () => {
      displayTableResults({
        records: [{ Id: '001', Name: 'Test' }],
        totalSize: 1,
        done: true
      });
      expect(channelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/^\n/));
    });
  });

  describe('Helper Functions', () => {
    describe('isRecord', () => {
      // Note: isRecord is not exported, but we can test it indirectly through other functions
      it('should identify valid records through generateTableOutput', () => {
        const validRecords = [{ Id: '001', Name: 'Test' }];
        const output = generateTableOutput(validRecords, 'Test');
        expect(output).toContain('Test');
      });

      it('should handle invalid records through generateTableOutput', () => {
        const invalidRecords = [null, undefined, 'string', 123];
        // @ts-expect-error - testing bad input
        const output = generateTableOutput(invalidRecords, 'Test');
        expect(output).toBe('');
      });
    });

    describe('flattenRecord', () => {
      // Note: flattenRecord is not exported, but we can test it indirectly
      it('should flatten records correctly through generateTableOutput', () => {
        const records = [
          {
            Id: '001',
            Account: { Id: '002', Name: 'Test Account' },
            SimpleField: 'Simple'
          }
        ];
        const output = generateTableOutput(records, 'Test');

        expect(output).toContain('Id');
        expect(output).toContain('Account.Id');
        expect(output).toContain('Account.Name');
        expect(output).toContain('SimpleField');
        expect(output).toContain('001');
        expect(output).toContain('002');
        expect(output).toContain('Test Account');
        expect(output).toContain('Simple');
      });
    });

    describe('getAllFlattenedFields', () => {
      // Note: getAllFlattenedFields is not exported, but we can test it indirectly
      it('should collect all fields from multiple records', () => {
        const records = [
          { Id: '001', Account: { Id: '002' } },
          { Id: '003', Account: { Name: 'Test' } },
          { Id: '004', Contact: { Email: 'test@example.com' } }
        ];
        const output = generateTableOutput(records, 'Test');

        expect(output).toContain('Id');
        expect(output).toContain('Account.Id');
        expect(output).toContain('Account.Name');
        expect(output).toContain('Contact.Email');
      });

      it('should preserve field order', () => {
        const records = [
          { Id: '001', ZField: 'last', AField: 'first' },
          { Id: '002', BField: 'middle' }
        ];
        const output = generateTableOutput(records, 'Test');

        // Id should come first
        const idIndex = output.indexOf('Id');
        const zFieldIndex = output.indexOf('ZField');
        const aFieldIndex = output.indexOf('AField');
        const bFieldIndex = output.indexOf('BField');

        expect(idIndex).toBeLessThan(zFieldIndex);
        expect(idIndex).toBeLessThan(aFieldIndex);
        expect(idIndex).toBeLessThan(bFieldIndex);
        expect(zFieldIndex).toBeLessThan(aFieldIndex);
        expect(zFieldIndex).toBeLessThan(bFieldIndex);
        expect(aFieldIndex).toBeLessThan(bFieldIndex);
      });

      it('should skip null values when determining fields', () => {
        const records = [
          { Id: '001', NullField: null },
          { Id: '002', NullField: { Name: 'Not Null' } }
        ];
        const output = generateTableOutput(records, 'Test');

        expect(output).toContain('Id');
        expect(output).toContain('NullField.Name');
        expect(output).not.toContain('NullField  '); // Should not have empty NullField column
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle circular references in objects', () => {
      const obj: any = { Name: 'Test' };
      obj.circular = obj; // Create circular reference

      // Should not crash, should convert to string representation
      const result = formatFieldValueForDisplay(obj);
      expect(typeof result).toBe('string');
      expect(result).toContain('Test');
    });

    it('should handle very large objects', () => {
      const largeObj: any = {};
      for (let i = 0; i < 100; i++) {
        largeObj[`field${i}`] = `value${i}`;
      }

      const result = formatFieldValueForDisplay(largeObj);
      expect(typeof result).toBe('string');
      expect(result.length).toBeLessThanOrEqual(50); // Should be truncated
    });

    it('should handle objects with symbol properties', () => {
      const sym = Symbol('test');
      const obj = {
        Name: 'Test',
        [sym]: 'symbol value'
      };

      const result = formatFieldValueForDisplay(obj);
      expect(result).toBe('Test'); // Symbols should be ignored by Object.entries
    });

    it('should handle objects with getter properties', () => {
      const obj = {
        Name: 'Test',
        get computed() {
          return 'computed value';
        }
      };

      const result = formatFieldValueForDisplay(obj);
      expect(result).toBe('Test, computed value');
    });
  });
});
