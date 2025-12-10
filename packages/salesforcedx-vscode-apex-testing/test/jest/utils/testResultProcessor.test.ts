/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestResult } from '@salesforce/apex-node';
import * as vscode from 'vscode';
import { FAIL_RESULT, PASS_RESULT, SKIP_RESULT } from '../../../src/constants';
import { parseStackTrace, updateTestRunResults } from '../../../src/utils/testResultProcessor';

// Mock HumanReporter before imports
const mockFormat = jest.fn().mockReturnValue('Mocked HumanReporter Output\nTest Results\n');

jest.mock('@salesforce/apex-node', () => {
  const actual = jest.requireActual('@salesforce/apex-node');
  // Create a mock class that returns an object with format method
  class MockHumanReporter {
    public format = mockFormat;
  }
  return {
    ...actual,
    HumanReporter: MockHumanReporter
  };
});

describe('testResultProcessor', () => {
  // Mock vscode.Uri.file to return a proper URI object
  beforeEach(() => {
    (vscode.Uri.file as jest.Mock) = jest.fn((path: string) => ({
      fsPath: path,
      path,
      scheme: 'file',
      authority: '',
      query: '',
      fragment: ''
    })) as any;
  });

  const createMockTestItem = (id: string, label: string, uri?: vscode.Uri): vscode.TestItem => {
    // Create a plain object with label and uri as direct, enumerable properties
    // The implementation accesses item.label and item.uri, so we need to ensure they're accessible
    const item: any = {
      id,
      label,
      uri,
      children: {
        size: 0,
        forEach: jest.fn(),
        get: jest.fn(),
        has: jest.fn(),
        values: jest.fn().mockReturnValue([]),
        keys: jest.fn(),
        entries: jest.fn(),
        [Symbol.iterator]: jest.fn()
      } as unknown as vscode.TestItemCollection
    };
    return item as vscode.TestItem;
  };

  const createMockTestRun = (): vscode.TestRun =>
    ({
      appendOutput: jest.fn(),
      passed: jest.fn(),
      failed: jest.fn(),
      skipped: jest.fn(),
      errored: jest.fn(),
      started: jest.fn(),
      end: jest.fn()
    }) as any;

  describe('parseStackTrace', () => {
    it('should parse valid stack trace with line number and class', () => {
      const stackTrace = 'MyTestClass.testMethod: line 42, column 1';
      const mockUri = vscode.Uri.file('/path/to/MyTestClass.cls');
      const classItem = createMockTestItem('class:MyTestClass', 'MyTestClass', mockUri);
      const classItems = new Map([['MyTestClass', classItem]]);

      // Verify the setup - the implementation uses Array.from(classItems.values()).find(item => item.label === className)
      const values = Array.from(classItems.values());
      expect(values.length).toBe(1);
      expect(values[0]).toBe(classItem);
      expect(values[0].label).toBe('MyTestClass');
      // Verify uri is accessible and truthy
      expect(values[0].uri).toBe(mockUri);
      expect(!!values[0].uri).toBe(true);

      const result = parseStackTrace(stackTrace, classItems);

      expect(result).toBeDefined();
      expect(result?.uri).toBe(mockUri);
      expect(result?.range.start.line).toBe(41); // 0-based (42 - 1)
      expect(result?.range.start.character).toBe(0);
    });

    it('should return undefined if line number not found', () => {
      const stackTrace = 'MyTestClass.testMethod: some error';
      const classItems = new Map();

      const result = parseStackTrace(stackTrace, classItems);

      expect(result).toBeUndefined();
    });

    it('should return undefined if class not found in stack trace', () => {
      const stackTrace = 'Some error at line 42';
      const classItems = new Map();

      const result = parseStackTrace(stackTrace, classItems);

      expect(result).toBeUndefined();
    });

    it('should return undefined if class item not found in map', () => {
      const stackTrace = 'UnknownClass.testMethod: line 42, column 1';
      const classItems = new Map();

      const result = parseStackTrace(stackTrace, classItems);

      expect(result).toBeUndefined();
    });

    it('should handle stack trace with namespace', () => {
      const stackTrace = 'namespace.MyTestClass.testMethod: line 42, column 1';
      const mockUri = vscode.Uri.file('/path/to/MyTestClass.cls');
      // Class items are typically stored without namespace prefix
      const classItem = createMockTestItem('class:MyTestClass', 'MyTestClass', mockUri);
      const classItems = new Map([['MyTestClass', classItem]]);

      const result = parseStackTrace(stackTrace, classItems);

      // Should find the class by matching the class name without namespace
      expect(result).toBeDefined();
      expect(result?.uri).toBe(mockUri);
      expect(result?.range.start.line).toBe(41); // 0-based (42 - 1)
      expect(result?.range.start.character).toBe(0);
    });

    it('should handle stack trace with namespace when class item has full namespace', () => {
      const stackTrace = 'namespace.MyTestClass.testMethod: line 42, column 1';
      const mockUri = vscode.Uri.file('/path/to/MyTestClass.cls');
      // Test case where class item is stored with full namespace
      const classItem = createMockTestItem('class:namespace.MyTestClass', 'namespace.MyTestClass', mockUri);
      const classItems = new Map([['namespace.MyTestClass', classItem]]);

      const result = parseStackTrace(stackTrace, classItems);

      // Should find the class by matching the full namespace.className
      expect(result).toBeDefined();
      expect(result?.uri).toBe(mockUri);
      expect(result?.range.start.line).toBe(41); // 0-based (42 - 1)
      expect(result?.range.start.character).toBe(0);
    });

    it('should handle multiple line numbers in stack trace', () => {
      const stackTrace = 'MyTestClass.testMethod: line 42, column 1\nOtherClass.otherMethod: line 10';
      const mockUri = vscode.Uri.file('/path/to/MyTestClass.cls');
      const classItem = createMockTestItem('class:MyTestClass', 'MyTestClass', mockUri);
      const classItems = new Map([['MyTestClass', classItem]]);

      const result = parseStackTrace(stackTrace, classItems);

      expect(result).toBeDefined();
      // Should use first line number (42 - 1 = 41, 0-based)
      expect(result?.range.start.line).toBe(41);
      expect(result?.uri).toBe(mockUri);
      expect(result?.range.start.character).toBe(0);
    });
  });

  describe('updateTestRunResults', () => {
    it('should update passed test results', () => {
      const run = createMockTestRun();
      const methodItem = createMockTestItem('method:MyClass.testMethod', 'testMethod');
      const methodItems = new Map([['MyClass.testMethod', methodItem]]);
      const classItems = new Map();

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'MyClass', namespacePrefix: null },
            methodName: 'testMethod',
            outcome: PASS_RESULT,
            runTime: 100
          }
        ],
        summary: { testsRan: 1, passing: 1, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [], methodItems, classItems, false);

      expect(run.passed).toHaveBeenCalledWith(methodItem, 100);
      expect(run.failed).not.toHaveBeenCalled();
      expect(run.skipped).not.toHaveBeenCalled();
      expect(run.appendOutput).toHaveBeenCalled();
    });

    it('should update failed test results with error message', () => {
      const run = createMockTestRun();
      const methodItem = createMockTestItem('method:MyClass.testMethod', 'testMethod');
      const methodItems = new Map([['MyClass.testMethod', methodItem]]);
      const classItems = new Map();

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'MyClass', namespacePrefix: null },
            methodName: 'testMethod',
            outcome: FAIL_RESULT,
            runTime: 50,
            message: 'Test failed',
            stackTrace: 'MyClass.testMethod: line 10'
          }
        ],
        summary: { testsRan: 1, passing: 0, failing: 1 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [], methodItems, classItems, false);

      expect(run.failed).toHaveBeenCalled();
      const failedCall = (run.failed as jest.Mock).mock.calls[0];
      expect(failedCall[0]).toBe(methodItem);
      expect(failedCall[1]).toBeInstanceOf(vscode.TestMessage);
      expect((failedCall[1] as vscode.TestMessage).message).toContain('Test failed');
      expect(failedCall[2]).toBe(50);
    });

    it('should update failed test results with stack trace location', () => {
      const run = createMockTestRun();
      const methodItem = createMockTestItem('method:MyClass.testMethod', 'testMethod');
      const mockUri = vscode.Uri.file('/path/to/MyClass.cls');
      const classItem = createMockTestItem('class:MyClass', 'MyClass', mockUri);
      const methodItems = new Map([['MyClass.testMethod', methodItem]]);
      const classItems = new Map([['MyClass', classItem]]);

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'MyClass', namespacePrefix: null },
            methodName: 'testMethod',
            outcome: FAIL_RESULT,
            runTime: 50,
            message: 'Test failed',
            stackTrace: 'MyClass.testMethod: line 10, column 1'
          }
        ],
        summary: { testsRan: 1, passing: 0, failing: 1 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [], methodItems, classItems, false);

      expect(run.failed).toHaveBeenCalled();
      const failedCall = (run.failed as jest.Mock).mock.calls[0];
      const message = failedCall[1] as vscode.TestMessage;
      expect(message.location).toBeDefined();
      expect(message.location?.uri).toBe(mockUri);
      expect(message.location?.range.start.line).toBe(9); // 0-based
    });

    it('should update skipped test results', () => {
      const run = createMockTestRun();
      const methodItem = createMockTestItem('method:MyClass.testMethod', 'testMethod');
      const methodItems = new Map([['MyClass.testMethod', methodItem]]);
      const classItems = new Map();

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'MyClass', namespacePrefix: null },
            methodName: 'testMethod',
            outcome: SKIP_RESULT,
            runTime: 0
          }
        ],
        summary: { testsRan: 1, passing: 0, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [], methodItems, classItems, false);

      expect(run.skipped).toHaveBeenCalledWith(methodItem);
      expect(run.passed).not.toHaveBeenCalled();
      expect(run.failed).not.toHaveBeenCalled();
    });

    it('should handle tests with namespace prefix', () => {
      const run = createMockTestRun();
      const methodItem = createMockTestItem('method:namespace.MyClass.testMethod', 'testMethod');
      const methodItems = new Map([['namespace.MyClass.testMethod', methodItem]]);
      const classItems = new Map();

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'MyClass', namespacePrefix: 'namespace' },
            methodName: 'testMethod',
            outcome: PASS_RESULT,
            runTime: 100
          }
        ],
        summary: { testsRan: 1, passing: 1, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [], methodItems, classItems, false);

      expect(run.passed).toHaveBeenCalledWith(methodItem, 100);
    });

    it('should handle tests from testsToRun parameter', () => {
      const run = createMockTestRun();
      const methodItem = createMockTestItem('method:MyClass.testMethod', 'testMethod');
      const methodItems = new Map();
      const classItems = new Map();

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'MyClass', namespacePrefix: null },
            methodName: 'testMethod',
            outcome: PASS_RESULT,
            runTime: 100
          }
        ],
        summary: { testsRan: 1, passing: 1, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [methodItem], methodItems, classItems, false);

      expect(run.passed).toHaveBeenCalledWith(methodItem, 100);
    });

    it('should handle tests not found in test map', () => {
      const run = createMockTestRun();
      const methodItems = new Map();
      const classItems = new Map();
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'MyClass', namespacePrefix: null },
            methodName: 'testMethod',
            outcome: PASS_RESULT,
            runTime: 100
          }
        ],
        summary: { testsRan: 1, passing: 1, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [], methodItems, classItems, false);

      expect(run.passed).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should add HumanReporter output', () => {
      const run = createMockTestRun();
      const methodItems = new Map();
      const classItems = new Map();

      // Ensure mockFormat returns the expected output for this test
      mockFormat.mockReturnValueOnce('Mocked HumanReporter Output\nTest Results\n');

      const result: TestResult = {
        tests: [],
        summary: { testsRan: 0, passing: 0, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [], methodItems, classItems, false);

      expect(run.appendOutput).toHaveBeenCalledWith('\r\n=== Test Results ===\r\n\r\n');
      // The output is split by lines and each line is added separately with \r\n
      // So we need to check if any call contains the HumanReporter output
      const outputCalls = (run.appendOutput as jest.Mock).mock.calls;
      const allOutput = outputCalls.map(call => call[0]).join('');
      expect(allOutput).toContain('Mocked HumanReporter Output');
    });

    it('should handle empty HumanReporter output', () => {
      const run = createMockTestRun();
      const methodItems = new Map();
      const classItems = new Map();

      // Mock HumanReporter to return empty string for this test
      mockFormat.mockReturnValueOnce('');

      const result: TestResult = {
        tests: [],
        summary: { testsRan: 0, passing: 0, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [], methodItems, classItems, false);

      expect(run.appendOutput).toHaveBeenCalledWith(expect.stringContaining('Test execution completed. Tests ran: 0'));
    });

    it('should handle code coverage parameter', () => {
      const run = createMockTestRun();
      const methodItems = new Map();
      const classItems = new Map();

      const result: TestResult = {
        tests: [],
        summary: { testsRan: 0, passing: 0, failing: 0 }
      } as unknown as TestResult;

      // Reset mock to track calls
      mockFormat.mockClear();

      updateTestRunResults(result, run, [], methodItems, classItems, true);

      // Verify format was called with correct parameters (codeCoverage = true)
      expect(mockFormat).toHaveBeenCalledWith(result, true, false);
    });

    it('should handle multiple test results', () => {
      const run = createMockTestRun();
      const method1 = createMockTestItem('method:MyClass.testMethod1', 'testMethod1');
      const method2 = createMockTestItem('method:MyClass.testMethod2', 'testMethod2');
      const methodItems = new Map([
        ['MyClass.testMethod1', method1],
        ['MyClass.testMethod2', method2]
      ]);
      const classItems = new Map();

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'MyClass', namespacePrefix: null },
            methodName: 'testMethod1',
            outcome: PASS_RESULT,
            runTime: 100
          },
          {
            apexClass: { name: 'MyClass', namespacePrefix: null },
            methodName: 'testMethod2',
            outcome: FAIL_RESULT,
            runTime: 50,
            message: 'Failed',
            stackTrace: ''
          }
        ],
        summary: { testsRan: 2, passing: 1, failing: 1 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [], methodItems, classItems, false);

      expect(run.passed).toHaveBeenCalledWith(method1, 100);
      expect(run.failed).toHaveBeenCalled();
    });

    it('should combine error message and stack trace for failed tests', () => {
      const run = createMockTestRun();
      const methodItem = createMockTestItem('method:MyClass.testMethod', 'testMethod');
      const methodItems = new Map([['MyClass.testMethod', methodItem]]);
      const classItems = new Map();

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'MyClass', namespacePrefix: null },
            methodName: 'testMethod',
            outcome: FAIL_RESULT,
            runTime: 50,
            message: 'Error message',
            stackTrace: 'Stack trace line 1\nStack trace line 2'
          }
        ],
        summary: { testsRan: 1, passing: 0, failing: 1 }
      } as unknown as TestResult;

      updateTestRunResults(result, run, [], methodItems, classItems, false);

      const failedCall = (run.failed as jest.Mock).mock.calls[0];
      const message = failedCall[1] as vscode.TestMessage;
      expect(message.message).toContain('Error message');
      expect(message.message).toContain('Stack trace line 1');
    });
  });
});
