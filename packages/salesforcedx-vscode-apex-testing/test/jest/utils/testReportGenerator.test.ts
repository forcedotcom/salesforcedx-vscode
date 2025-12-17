/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestResult } from '@salesforce/apex-node';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  generateMarkdownReport,
  generateTextReport,
  writeAndOpenTestReport
} from '../../../src/utils/testReportGenerator';

// Mock vscode.workspace.fs
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockOpenTextDocument = jest.fn().mockResolvedValue({});
const mockShowTextDocument = jest.fn().mockResolvedValue(undefined);

describe('testReportGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteFile.mockClear();
    mockOpenTextDocument.mockClear();
    mockShowTextDocument.mockClear();

    // Set up mocks
    jest.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(mockWriteFile);
    jest.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(mockOpenTextDocument);
    jest.spyOn(vscode.window, 'showTextDocument').mockImplementation(mockShowTextDocument);

    // Mock vscode.Uri.file
    (vscode.Uri.file as jest.Mock) = jest.fn((p: string) => ({
      fsPath: p,
      path: p,
      scheme: 'file',
      authority: '',
      query: '',
      fragment: ''
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockTestResult = (): TestResult =>
    ({
      summary: {
        outcome: 'Passed',
        testsRan: 3,
        passing: 2,
        failing: 1,
        skipped: 0,
        testExecutionTimeInMs: 5000
      },
      tests: [
        {
          apexClass: {
            name: 'TestClass1',
            namespacePrefix: undefined
          },
          methodName: 'testMethod1',
          outcome: 'Pass',
          runTime: 2000,
          message: undefined,
          stackTrace: undefined
        },
        {
          apexClass: {
            name: 'TestClass1',
            namespacePrefix: undefined
          },
          methodName: 'testMethod2',
          outcome: 'Pass',
          runTime: 1500,
          message: undefined,
          stackTrace: undefined
        },
        {
          apexClass: {
            name: 'TestClass2',
            namespacePrefix: undefined
          },
          methodName: 'testMethod3',
          outcome: 'Fail',
          runTime: 1500,
          message: 'Assertion failed: Expected true but was false',
          stackTrace: 'TestClass2.testMethod3: line 10, column 1\nClass.TestClass2.testMethod3: line 10'
        }
      ]
    }) as unknown as TestResult;

  describe('generateMarkdownReport', () => {
    it('should generate markdown report with correct structure', () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = generateMarkdownReport(result, timestamp);

      expect(report).toContain('# Apex Test Results');
      expect(report).toContain('## Summary');
      expect(report).toContain('| ✅ Passed | 2 |');
      expect(report).toContain('| ❌ Failed | 1 |');
      expect(report).toContain('| ⏭️ Skipped | 0 |');
      expect(report).toContain('| **Total** | **3** |');
    });

    it('should include failures section with error message and stack trace', () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = generateMarkdownReport(result, timestamp);

      expect(report).toContain('## ❌ Failures');
      expect(report).toContain('### TestClass2.testMethod3');
      expect(report).toContain('**Error:**');
      expect(report).toContain('Assertion failed: Expected true but was false');
      expect(report).toContain('**Stack Trace:**');
      expect(report).toContain('TestClass2.testMethod3: line 10');
    });

    it('should include passed tests section', () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = generateMarkdownReport(result, timestamp);

      expect(report).toContain('## ✅ Passed Tests');
      expect(report).toContain('- TestClass1.testMethod1');
      expect(report).toContain('- TestClass1.testMethod2');
    });

    it('should escape markdown special characters in test names', () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 1,
          passing: 1,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 1000
        },
        tests: [
          {
            apexClass: {
              name: 'Test_Class*With[Special]Chars',
              namespacePrefix: undefined
            },
            methodName: 'test_Method*With[Special]Chars',
            outcome: 'Pass',
            runTime: 1000,
            message: undefined,
            stackTrace: undefined
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = generateMarkdownReport(result, timestamp);

      // Should escape special characters (but not dots)
      expect(report).toContain('Test\\_Class\\*With\\[Special\\]Chars');
      expect(report).toContain('test\\_Method\\*With\\[Special\\]Chars');
    });

    it('should handle namespace prefix in class names', () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 1,
          passing: 1,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 1000
        },
        tests: [
          {
            apexClass: {
              name: 'TestClass',
              namespacePrefix: 'MyNamespace'
            },
            methodName: 'testMethod',
            outcome: 'Pass',
            runTime: 1000,
            message: undefined,
            stackTrace: undefined
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = generateMarkdownReport(result, timestamp);

      expect(report).toContain('MyNamespace.TestClass.testMethod');
    });

    it('should handle skipped tests', () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 2,
          passing: 1,
          failing: 0,
          skipped: 1,
          testExecutionTimeInMs: 2000
        },
        tests: [
          {
            apexClass: {
              name: 'TestClass',
              namespacePrefix: undefined
            },
            methodName: 'testMethod1',
            outcome: 'Pass',
            runTime: 1000,
            message: undefined,
            stackTrace: undefined
          },
          {
            apexClass: {
              name: 'TestClass',
              namespacePrefix: undefined
            },
            methodName: 'testMethod2',
            outcome: 'Skip',
            runTime: 0,
            message: undefined,
            stackTrace: undefined
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = generateMarkdownReport(result, timestamp);

      expect(report).toContain('## ⏭️ Skipped Tests');
      expect(report).toContain('- TestClass.testMethod2');
    });

    it('should format duration correctly', () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 1,
          passing: 1,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 125_000 // 2 minutes 5 seconds
        },
        tests: [
          {
            apexClass: {
              name: 'TestClass',
              namespacePrefix: undefined
            },
            methodName: 'testMethod',
            outcome: 'Pass',
            runTime: 125_000,
            message: undefined,
            stackTrace: undefined
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = generateMarkdownReport(result, timestamp);

      expect(report).toContain('| **Duration** | 2m 5s |');
      expect(report).toContain('(2m 5s)');
    });
  });

  describe('generateTextReport', () => {
    it('should generate text report with correct structure', () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = generateTextReport(result, timestamp);

      expect(report).toContain('Apex Test Results');
      expect(report).toContain('Summary:');
      expect(report).toContain('  Passed:  2');
      expect(report).toContain('  Failed:  1');
      expect(report).toContain('  Skipped: 0');
      expect(report).toContain('  Total:   3');
    });

    it('should include failures section in text format', () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = generateTextReport(result, timestamp);

      expect(report).toContain('Failures:');
      expect(report).toContain('TestClass2.testMethod3');
      expect(report).toContain('Error:');
      expect(report).toContain('Assertion failed: Expected true but was false');
      expect(report).toContain('Stack Trace:');
    });

    it('should include passed tests section in text format', () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = generateTextReport(result, timestamp);

      expect(report).toContain('Passed Tests:');
      expect(report).toContain('  - TestClass1.testMethod1');
      expect(report).toContain('  - TestClass1.testMethod2');
    });
  });

  describe('writeAndOpenTestReport', () => {
    it('should write markdown report and open it', async () => {
      const result = createMockTestResult();
      const outputDir = path.join('test', 'output');

      await writeAndOpenTestReport(result, outputDir, 'markdown');

      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockOpenTextDocument).toHaveBeenCalled();
      expect(mockShowTextDocument).toHaveBeenCalled();
    });

    it('should write text report and open it', async () => {
      const result = createMockTestResult();
      const outputDir = path.join('test', 'output');

      await writeAndOpenTestReport(result, outputDir, 'text');

      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockOpenTextDocument).toHaveBeenCalled();
      expect(mockShowTextDocument).toHaveBeenCalled();
    });

    it('should encode content as UTF-8', async () => {
      const result = createMockTestResult();
      const outputDir = path.join('test', 'output');

      await writeAndOpenTestReport(result, outputDir, 'markdown');

      expect(mockWriteFile).toHaveBeenCalled();
      const writeCall = mockWriteFile.mock.calls[0];
      expect(writeCall).toBeDefined();
      const [, content] = writeCall;
      expect(content).toBeInstanceOf(Uint8Array);

      // Verify it's UTF-8 encoded
      const decoder = new TextDecoder('utf-8');
      const decoded = decoder.decode(content);
      expect(decoded).toContain('# Apex Test Results');
    });
  });
});
