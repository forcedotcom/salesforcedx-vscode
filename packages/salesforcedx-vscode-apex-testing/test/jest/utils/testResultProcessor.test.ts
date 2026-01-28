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
  const actual = jest.requireActual('@salesforce/apex-node') as any;
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

    // Mock vscode.Range as a constructor for parseStackTrace tests

    (vscode.Range as any) = jest.fn(
      (startLine: number, startCharacter: number, endLine: number, endCharacter: number) => ({
        start: { line: startLine, character: startCharacter },
        end: { line: endLine, character: endCharacter }
      })
    );

    // Mock vscode.Location as a constructor for parseStackTrace tests

    (vscode.Location as any) = jest.fn((uri: vscode.Uri, range: vscode.Range) => ({
      uri,
      range
    }));

    // Mock vscode.TestMessage as a constructor for updateTestRunResults tests

    (vscode.TestMessage as any) = jest.fn((message: string) => ({
      message,
      location: undefined
    }));
  });

  const createMockTestItem = (
    id: string,
    label: string,
    uri?: vscode.Uri,
    children?: vscode.TestItem[]
  ): vscode.TestItem => {
    // Create a plain object with label and uri as direct, enumerable properties
    // The implementation accesses item.label and item.uri, so we need to ensure they're accessible
    const childrenArray = children ?? [];

    const item: any = {
      id,
      label,
      uri,
      children: {
        size: childrenArray.length,
        forEach: jest.fn((callback: (item: vscode.TestItem) => void) => {
          childrenArray.forEach(callback);
        }),
        get: jest.fn(),
        has: jest.fn(),
        values: jest.fn().mockReturnValue(childrenArray),
        keys: jest.fn(),
        entries: jest.fn(),
        [Symbol.iterator]: jest.fn().mockReturnValue(childrenArray[Symbol.iterator]())
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

      updateTestRunResults({
        result,
        run,
        testsToRun: [],
        methodItems,
        classItems,
        codeCoverage: false,
        concise: false
      });

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

      updateTestRunResults({
        result,
        run,
        testsToRun: [],
        methodItems,
        classItems,
        codeCoverage: false,
        concise: false
      });

      expect(run.failed).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const failedCall = (run.failed as jest.Mock).mock.calls[0];
      expect(failedCall[0]).toBe(methodItem);
      // Check that TestMessage was created (it's a mock constructor)
      expect(failedCall[1]).toBeDefined();
      expect(failedCall[1]).toHaveProperty('message');

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

      updateTestRunResults({
        result,
        run,
        testsToRun: [],
        methodItems,
        classItems,
        codeCoverage: false,
        concise: false
      });

      expect(run.failed).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      updateTestRunResults({ result, run, testsToRun: [], methodItems, classItems, codeCoverage: false });

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

      updateTestRunResults({
        result,
        run,
        testsToRun: [],
        methodItems,
        classItems,
        codeCoverage: false,
        concise: false
      });

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

      updateTestRunResults({ result, run, testsToRun: [methodItem], methodItems, classItems, codeCoverage: false });

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

      updateTestRunResults({
        result,
        run,
        testsToRun: [],
        methodItems,
        classItems,
        codeCoverage: false,
        concise: false
      });

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

      updateTestRunResults({ result, run, testsToRun: [], methodItems, classItems, codeCoverage: false });

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

      updateTestRunResults({ result, run, testsToRun: [], methodItems, classItems, codeCoverage: false });

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

      updateTestRunResults({ result, run, testsToRun: [], methodItems, classItems, codeCoverage: true });

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

      updateTestRunResults({ result, run, testsToRun: [], methodItems, classItems, codeCoverage: false });

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

      updateTestRunResults({ result, run, testsToRun: [], methodItems, classItems, codeCoverage: false });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const failedCall = (run.failed as jest.Mock).mock.calls[0];

      const message = failedCall[1] as vscode.TestMessage;

      expect(message.message).toContain('Error message');

      expect(message.message).toContain('Stack trace line 1');
    });

    it('should update class items when class is in testsToRun', () => {
      const run = createMockTestRun();
      const method1 = createMockTestItem('method:MyClass.testMethod1', 'testMethod1');
      const method2 = createMockTestItem('method:MyClass.testMethod2', 'testMethod2');
      const classItem = createMockTestItem('class:MyClass', 'MyClass', undefined, [method1, method2]);

      const methodItems = new Map([
        ['MyClass.testMethod1', method1],
        ['MyClass.testMethod2', method2]
      ]);

      const classItems = new Map([['MyClass', classItem]]);

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
            outcome: PASS_RESULT,
            runTime: 50
          }
        ],
        summary: { testsRan: 2, passing: 2, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults({ result, run, testsToRun: [classItem], methodItems, classItems, codeCoverage: false });

      // Methods should be updated
      expect(run.passed).toHaveBeenCalledWith(method1, 100);
      expect(run.passed).toHaveBeenCalledWith(method2, 50);
      // Class should be updated with aggregate results
      expect(run.passed).toHaveBeenCalledWith(classItem, 150); // Total duration
    });

    it('should recursively collect methods under suite and update class children', () => {
      const run = createMockTestRun();
      const method1 = createMockTestItem('method:Class1.testMethod1', 'testMethod1');
      const method2 = createMockTestItem('method:Class2.testMethod2', 'testMethod2');
      const class1Item = createMockTestItem('suite-class:MySuite:Class1', 'Class1', undefined, [method1]);
      const class2Item = createMockTestItem('suite-class:MySuite:Class2', 'Class2', undefined, [method2]);
      const suiteItem = createMockTestItem('suite:MySuite', 'MySuite', undefined, [class1Item, class2Item]);

      const methodItems = new Map([
        ['Class1.testMethod1', method1],
        ['Class2.testMethod2', method2]
      ]);

      const classItems = new Map([
        ['Class1', createMockTestItem('class:Class1', 'Class1')],
        ['Class2', createMockTestItem('class:Class2', 'Class2')]
      ]);

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'Class1', namespacePrefix: null },
            methodName: 'testMethod1',
            outcome: PASS_RESULT,
            runTime: 100
          },
          {
            apexClass: { name: 'Class2', namespacePrefix: null },
            methodName: 'testMethod2',
            outcome: PASS_RESULT,
            runTime: 50
          }
        ],
        summary: { testsRan: 2, passing: 2, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults({ result, run, testsToRun: [suiteItem], methodItems, classItems, codeCoverage: false });

      // Methods should be updated (found recursively)
      expect(run.passed).toHaveBeenCalledWith(method1, 100);
      expect(run.passed).toHaveBeenCalledWith(method2, 50);
      // Suite should be updated with aggregate results
      expect(run.passed).toHaveBeenCalledWith(suiteItem, 150);
      // Class items under suite should be updated
      expect(run.passed).toHaveBeenCalledWith(class1Item, 100);
      expect(run.passed).toHaveBeenCalledWith(class2Item, 50);
    });

    it('should handle suite with mixed pass/fail results and update class children correctly', () => {
      const run = createMockTestRun();
      const method1 = createMockTestItem('method:Class1.testMethod1', 'testMethod1');
      const method2 = createMockTestItem('method:Class1.testMethod2', 'testMethod2');
      const class1Item = createMockTestItem('suite-class:MySuite:Class1', 'Class1', undefined, [method1, method2]);
      const suiteItem = createMockTestItem('suite:MySuite', 'MySuite', undefined, [class1Item]);

      const methodItems = new Map([
        ['Class1.testMethod1', method1],
        ['Class1.testMethod2', method2]
      ]);

      const classItems = new Map([['Class1', createMockTestItem('class:Class1', 'Class1')]]);

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'Class1', namespacePrefix: null },
            methodName: 'testMethod1',
            outcome: PASS_RESULT,
            runTime: 100
          },
          {
            apexClass: { name: 'Class1', namespacePrefix: null },
            methodName: 'testMethod2',
            outcome: FAIL_RESULT,
            runTime: 50,
            message: 'Failed',
            stackTrace: ''
          }
        ],
        summary: { testsRan: 2, passing: 1, failing: 1 }
      } as unknown as TestResult;

      updateTestRunResults({ result, run, testsToRun: [suiteItem], methodItems, classItems, codeCoverage: false });

      // Methods should be updated
      expect(run.passed).toHaveBeenCalledWith(method1, 100);
      expect(run.failed).toHaveBeenCalledWith(method2, expect.objectContaining({ message: expect.any(String) }), 50);
      // Suite should show failed (because one test failed)
      expect(run.failed).toHaveBeenCalledWith(suiteItem, expect.objectContaining({ message: expect.any(String) }), 150);
      // Class should show failed (because one test failed)
      expect(run.failed).toHaveBeenCalledWith(
        class1Item,
        expect.objectContaining({ message: expect.any(String) }),
        150
      );
    });

    it('should handle class with methods not in methodItems but found recursively', () => {
      const run = createMockTestRun();
      const method1 = createMockTestItem('method:MyClass.testMethod1', 'testMethod1');
      const method2 = createMockTestItem('method:MyClass.testMethod2', 'testMethod2');
      const classItem = createMockTestItem('class:MyClass', 'MyClass', undefined, [method1, method2]);

      // methodItems is empty - methods should be found recursively from classItem

      const methodItems = new Map();

      const classItems = new Map([['MyClass', classItem]]);

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
            outcome: PASS_RESULT,
            runTime: 50
          }
        ],
        summary: { testsRan: 2, passing: 2, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults({ result, run, testsToRun: [classItem], methodItems, classItems, codeCoverage: false });

      // Methods should be found and updated (via recursive collection)
      expect(run.passed).toHaveBeenCalledWith(method1, 100);
      expect(run.passed).toHaveBeenCalledWith(method2, 50);
      // Class should be updated with aggregate results
      expect(run.passed).toHaveBeenCalledWith(classItem, 150);
    });

    it('should handle suite with namespaced classes correctly', () => {
      const run = createMockTestRun();
      const method1 = createMockTestItem('method:namespace.Class1.testMethod1', 'testMethod1');
      const class1Item = createMockTestItem('suite-class:MySuite:Class1', 'Class1', undefined, [method1]);
      const suiteItem = createMockTestItem('suite:MySuite', 'MySuite', undefined, [class1Item]);

      const methodItems = new Map([['namespace.Class1.testMethod1', method1]]);
      const classItems = new Map([
        ['namespace.Class1', createMockTestItem('class:namespace.Class1', 'namespace.Class1')]
      ]);

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'Class1', namespacePrefix: 'namespace' },
            methodName: 'testMethod1',
            outcome: PASS_RESULT,
            runTime: 100
          }
        ],
        summary: { testsRan: 1, passing: 1, failing: 0 }
      } as unknown as TestResult;

      updateTestRunResults({ result, run, testsToRun: [suiteItem], methodItems, classItems, codeCoverage: false });

      // Method should be updated (found recursively)
      expect(run.passed).toHaveBeenCalledWith(method1, 100);
      // Suite should be updated
      expect(run.passed).toHaveBeenCalledWith(suiteItem, 100);
      // Note: class1Item might not be updated if label doesn't match namespace.Class1
      // This is expected behavior - suite-class items use simple class names
    });

    it('should mark only the failing suite as failed when running multiple suites', () => {
      const run = createMockTestRun();

      // Suite 1 with a passing test
      const method1 = createMockTestItem('method:PassingClass.testPass', 'testPass');
      const class1Item = createMockTestItem('suite-class:PassingSuite:PassingClass', 'PassingClass', undefined, [
        method1
      ]);
      const passingSuite = createMockTestItem('suite:PassingSuite', 'PassingSuite', undefined, [class1Item]);

      // Suite 2 with a failing test
      const method2 = createMockTestItem('method:FailingClass.testFail', 'testFail');
      const class2Item = createMockTestItem('suite-class:FailingSuite:FailingClass', 'FailingClass', undefined, [
        method2
      ]);
      const failingSuite = createMockTestItem('suite:FailingSuite', 'FailingSuite', undefined, [class2Item]);

      const methodItems = new Map([
        ['PassingClass.testPass', method1],
        ['FailingClass.testFail', method2]
      ]);
      const classItems = new Map([
        ['PassingClass', createMockTestItem('class:PassingClass', 'PassingClass')],
        ['FailingClass', createMockTestItem('class:FailingClass', 'FailingClass')]
      ]);

      const result: TestResult = {
        tests: [
          {
            apexClass: { name: 'PassingClass', namespacePrefix: null },
            methodName: 'testPass',
            outcome: PASS_RESULT,
            runTime: 100
          },
          {
            apexClass: { name: 'FailingClass', namespacePrefix: null },
            methodName: 'testFail',
            outcome: FAIL_RESULT,
            runTime: 50,
            message: 'Test failed',
            stackTrace: ''
          }
        ],
        summary: { testsRan: 2, passing: 1, failing: 1 }
      } as unknown as TestResult;

      updateTestRunResults({
        result,
        run,
        testsToRun: [passingSuite, failingSuite],
        methodItems,
        classItems,
        codeCoverage: false
      });

      // Methods should be updated correctly
      expect(run.passed).toHaveBeenCalledWith(method1, 100);
      expect(run.failed).toHaveBeenCalledWith(method2, expect.any(Object), 50);

      // CRITICAL: Only the failing suite should be marked as failed
      expect(run.passed).toHaveBeenCalledWith(passingSuite, 100);
      expect(run.failed).toHaveBeenCalledWith(failingSuite, expect.any(Object), 50);

      // Verify passingSuite was NOT marked as failed
      const failedCalls = (run.failed as jest.Mock).mock.calls;
      const passingSuiteFailedCall = failedCalls.find(
        (call: [vscode.TestItem, vscode.TestMessage, number]) => call[0].id === 'suite:PassingSuite'
      );
      expect(passingSuiteFailedCall).toBeUndefined();
    });
  });
});
