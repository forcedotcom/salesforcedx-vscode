/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestResult, MarkdownTextFormatTransformer } from '@salesforce/apex-node';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as settings from '../../../src/settings';
import { retrieveCoverageThreshold, retrievePerformanceThreshold } from '../../../src/settings';
import { writeAndOpenTestReport } from '../../../src/utils/testReportGenerator';

// Mock vscode.workspace.fs
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockOpenTextDocument = jest.fn().mockResolvedValue({});
const mockShowTextDocument = jest.fn().mockResolvedValue(undefined);
const mockExecuteCommand = jest.fn().mockResolvedValue(undefined);
const mockStat = jest.fn();

describe('testReportGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteFile.mockClear();
    mockOpenTextDocument.mockClear();
    mockShowTextDocument.mockClear();
    mockExecuteCommand.mockClear();
    mockStat.mockClear();
    // Default: file doesn't exist (stat throws)
    mockStat.mockRejectedValue(new Error('File not found'));

    // Set up mocks
    jest.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(mockWriteFile);
    jest.spyOn(vscode.workspace.fs, 'stat').mockImplementation(mockStat);
    jest.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(mockOpenTextDocument);
    jest.spyOn(vscode.window, 'showTextDocument').mockImplementation(mockShowTextDocument);
    jest.spyOn(vscode.commands, 'executeCommand').mockImplementation(mockExecuteCommand);

    // Mock settings to return default thresholds
    jest.spyOn(settings, 'retrievePerformanceThreshold').mockReturnValue(5000);
    jest.spyOn(settings, 'retrieveCoverageThreshold').mockReturnValue(75);

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

  // Helper function to collect stream output into a string
  const streamToString = async (stream: NodeJS.ReadableStream): Promise<string> => {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
  };

  // Helper function to generate markdown report using the library's transformer
  const generateMarkdownReport = async (
    result: TestResult,
    timestamp: Date,
    codeCoverage: boolean = false,
    sortOrder: 'runtime' | 'coverage' | 'severity' = 'runtime'
  ): Promise<string> => {
    const performanceThresholdMs = retrievePerformanceThreshold();
    const coverageThresholdPercent = retrieveCoverageThreshold();
    const transformer = new MarkdownTextFormatTransformer(result, {
      format: 'markdown',
      sortOrder,
      performanceThresholdMs,
      coverageThresholdPercent,
      codeCoverage,
      timestamp
    });
    return streamToString(transformer);
  };

  // Helper function to generate text report using the library's transformer
  const generateTextReport = async (
    result: TestResult,
    timestamp: Date,
    codeCoverage: boolean = false
  ): Promise<string> => {
    const performanceThresholdMs = retrievePerformanceThreshold();
    const coverageThresholdPercent = retrieveCoverageThreshold();
    const transformer = new MarkdownTextFormatTransformer(result, {
      format: 'text',
      sortOrder: 'runtime',
      performanceThresholdMs,
      coverageThresholdPercent,
      codeCoverage,
      timestamp
    });
    return streamToString(transformer);
  };

  const createMockTestResult = (): TestResult =>
    ({
      summary: {
        outcome: 'Passed',
        testsRan: 3,
        passing: 2,
        failing: 1,
        skipped: 0,
        testExecutionTimeInMs: 5000,
        testRunId: 'test-run-123'
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
    it('should generate markdown report with correct structure', async () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp);

      expect(report).toContain('# Apex Test Results');
      expect(report).toContain('## Summary');
      expect(report).toContain('**Total Tests:** 3');
      expect(report).toContain('✅ **Passed:** 2');
      expect(report).toContain('❌ **Failed:** 1');
    });

    it('should include failures section with error message and stack trace', async () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp);

      expect(report).toContain('## ❌ Failures (1)');
      expect(report).toContain('### TestClass2.testMethod3');
      expect(report).toContain('**Error Message**');
      expect(report).toContain('Assertion failed: Expected true but was false');
      expect(report).toContain('**Stack Trace**');
      expect(report).toContain('TestClass2.testMethod3: line 10');
    });

    it('should include passed tests section', async () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp);

      expect(report).toContain('## ✅ Passed Tests (2)');
      expect(report).toContain('- TestClass1.testMethod1');
      expect(report).toContain('- TestClass1.testMethod2');
    });

    it('should escape markdown special characters in test names', async () => {
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

      const report = await generateMarkdownReport(result, timestamp);

      // Should escape special characters (but not dots)
      expect(report).toContain('Test\\_Class\\*With\\[Special\\]Chars');
      expect(report).toContain('test\\_Method\\*With\\[Special\\]Chars');
    });

    it('should handle namespace prefix in class names', async () => {
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

      const report = await generateMarkdownReport(result, timestamp);

      expect(report).toContain('MyNamespace.TestClass.testMethod');
    });

    it('should handle skipped tests', async () => {
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

      const report = await generateMarkdownReport(result, timestamp);

      expect(report).toContain('## ⏭️ Skipped Tests (1)');
      expect(report).toContain('- TestClass.testMethod2');
    });

    it('should format duration correctly', async () => {
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

      const report = await generateMarkdownReport(result, timestamp);

      expect(report).toContain('**Duration:** 2m 5s');
      // Since the test takes 125 seconds (over 5s threshold), it's marked as poorly performing
      expect(report).toContain('(🐌 **2m 5s** - slow)');
    });

    it('should highlight poorly performing tests', async () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 2,
          passing: 2,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 12_000
        },
        tests: [
          {
            apexClass: {
              name: 'TestClass1',
              namespacePrefix: undefined
            },
            methodName: 'testMethod1',
            outcome: 'Pass',
            runTime: 6000, // 6 seconds - poorly performing
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class1',
                apexClassName: 'TestClass1',
                percentage: '90%'
              }
            ]
          },
          {
            apexClass: {
              name: 'TestClass2',
              namespacePrefix: undefined
            },
            methodName: 'testMethod2',
            outcome: 'Pass',
            runTime: 2000, // 2 seconds - OK
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class2',
                apexClassName: 'TestClass2',
                percentage: '90%'
              }
            ]
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp, true, 'severity');

      expect(report).toContain('## ⚠️ Test Quality Warnings');
      expect(report).toContain('### 🐌 Poorly Performing Tests (1)');
      expect(report).toContain('TestClass1.testMethod1');
      expect(report).toContain('6s');
      // Check for warning emoji and bold red runtime in table
      expect(report).toContain('⚠️');
      expect(report).toContain('font-weight: bold; color: #d32f2f');
    });

    it('should highlight poorly covered tests', async () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 2,
          passing: 2,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 4000
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
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class1',
                apexClassName: 'TestClass1',
                percentage: '50%' // Poor coverage
              }
            ]
          },
          {
            apexClass: {
              name: 'TestClass2',
              namespacePrefix: undefined
            },
            methodName: 'testMethod2',
            outcome: 'Pass',
            runTime: 2000,
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class2',
                apexClassName: 'TestClass2',
                percentage: '90%' // Good coverage
              }
            ]
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp, true, 'severity');

      expect(report).toContain('## ⚠️ Test Quality Warnings');
      expect(report).toContain('### 📉 Poorly Covered Tests (1)');
      expect(report).toContain('TestClass1.testMethod1');
      expect(report).toContain('50% coverage');
      // Check for warning emoji and bold red coverage in table
      expect(report).toContain('⚠️');
      expect(report).toContain('font-weight: bold; color: #d32f2f');
    });

    it('should highlight tests with both poor performance and poor coverage', async () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 1,
          passing: 1,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 6000
        },
        tests: [
          {
            apexClass: {
              name: 'TestClass1',
              namespacePrefix: undefined
            },
            methodName: 'testMethod1',
            outcome: 'Pass',
            runTime: 6000, // Poor performance
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class1',
                apexClassName: 'TestClass1',
                percentage: '50%' // Poor coverage
              }
            ]
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp, true, 'severity');

      // Check for warning emoji and bold red text for both coverage and runtime
      expect(report).toContain('⚠️');
      expect(report).toContain('font-weight: bold; color: #d32f2f');
    });

    it('should highlight poorly performing tests in passed tests section', async () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 1,
          passing: 1,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 6000
        },
        tests: [
          {
            apexClass: {
              name: 'TestClass1',
              namespacePrefix: undefined
            },
            methodName: 'testMethod1',
            outcome: 'Pass',
            runTime: 6000, // Poor performance
            message: undefined,
            stackTrace: undefined
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp);

      expect(report).toContain('(🐌 **6s** - slow)');
    });

    it('should highlight poorly covered tests in passed tests section', async () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 1,
          passing: 1,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 2000
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
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class1',
                apexClassName: 'TestClass1',
                percentage: '50%' // Poor coverage
              }
            ]
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp, true, 'severity');

      expect(report).toContain('(📉 **50%** coverage - low)');
    });

    it('should not show warnings section when no issues', async () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 1,
          passing: 1,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 2000
        },
        tests: [
          {
            apexClass: {
              name: 'TestClass1',
              namespacePrefix: undefined
            },
            methodName: 'testMethod1',
            outcome: 'Pass',
            runTime: 2000, // Good performance
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class1',
                apexClassName: 'TestClass1',
                percentage: '90%' // Good coverage
              }
            ]
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp, true, 'severity');

      expect(report).not.toContain('## ⚠️ Test Quality Warnings');
    });

    it('should sort poorly performing tests from worst to best', async () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 3,
          passing: 3,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 20_000
        },
        tests: [
          {
            apexClass: {
              name: 'TestClass1',
              namespacePrefix: undefined
            },
            methodName: 'testMethod1',
            outcome: 'Pass',
            runTime: 6000, // 6 seconds
            message: undefined,
            stackTrace: undefined
          },
          {
            apexClass: {
              name: 'TestClass2',
              namespacePrefix: undefined
            },
            methodName: 'testMethod2',
            outcome: 'Pass',
            runTime: 10_000, // 10 seconds - worst
            message: undefined,
            stackTrace: undefined
          },
          {
            apexClass: {
              name: 'TestClass3',
              namespacePrefix: undefined
            },
            methodName: 'testMethod3',
            outcome: 'Pass',
            runTime: 7000, // 7 seconds
            message: undefined,
            stackTrace: undefined
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp);

      // Find the position of each test in the poorly performing section
      const testMethod2Index = report.indexOf('TestClass2.testMethod2');
      const testMethod3Index = report.indexOf('TestClass3.testMethod3');
      const testMethod1Index = report.indexOf('TestClass1.testMethod1');

      // TestClass2 (10s) should come before TestClass3 (7s) and TestClass1 (6s)
      expect(testMethod2Index).toBeLessThan(testMethod3Index);
      expect(testMethod3Index).toBeLessThan(testMethod1Index);
    });

    it('should sort poorly covered tests from worst to best', async () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 3,
          passing: 3,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 6000
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
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class1',
                apexClassName: 'TestClass1',
                percentage: '50%' // Worst coverage
              }
            ]
          },
          {
            apexClass: {
              name: 'TestClass2',
              namespacePrefix: undefined
            },
            methodName: 'testMethod2',
            outcome: 'Pass',
            runTime: 2000,
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class2',
                apexClassName: 'TestClass2',
                percentage: '70%' // Better coverage
              }
            ]
          },
          {
            apexClass: {
              name: 'TestClass3',
              namespacePrefix: undefined
            },
            methodName: 'testMethod3',
            outcome: 'Pass',
            runTime: 2000,
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class3',
                apexClassName: 'TestClass3',
                percentage: '60%' // Middle coverage
              }
            ]
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp, true, 'severity');

      // Find the position of each test in the poorly covered section
      const testMethod1Index = report.indexOf('TestClass1.testMethod1');
      const testMethod3Index = report.indexOf('TestClass3.testMethod3');
      const testMethod2Index = report.indexOf('TestClass2.testMethod2');

      // TestClass1 (50%) should come before TestClass3 (60%) and TestClass2 (70%)
      expect(testMethod1Index).toBeLessThan(testMethod3Index);
      expect(testMethod3Index).toBeLessThan(testMethod2Index);
    });

    it('should sort test results table by severity (worst first)', async () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 4,
          passing: 4,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 15_000
        },
        tests: [
          {
            apexClass: {
              name: 'TestClass1',
              namespacePrefix: undefined
            },
            methodName: 'testMethod1',
            outcome: 'Pass',
            runTime: 2000, // Good performance
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class1',
                apexClassName: 'TestClass1',
                percentage: '90%' // Good coverage
              }
            ]
          },
          {
            apexClass: {
              name: 'TestClass2',
              namespacePrefix: undefined
            },
            methodName: 'testMethod2',
            outcome: 'Pass',
            runTime: 6000, // Poor performance
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class2',
                apexClassName: 'TestClass2',
                percentage: '50%' // Poor coverage - worst (both issues)
              }
            ]
          },
          {
            apexClass: {
              name: 'TestClass3',
              namespacePrefix: undefined
            },
            methodName: 'testMethod3',
            outcome: 'Pass',
            runTime: 2000, // Good performance
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class3',
                apexClassName: 'TestClass3',
                percentage: '60%' // Poor coverage only
              }
            ]
          },
          {
            apexClass: {
              name: 'TestClass4',
              namespacePrefix: undefined
            },
            methodName: 'testMethod4',
            outcome: 'Pass',
            runTime: 7000, // Poor performance only
            message: undefined,
            stackTrace: undefined,
            perClassCoverage: [
              {
                apexClassId: 'class4',
                apexClassName: 'TestClass4',
                percentage: '90%' // Good coverage
              }
            ]
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp, true, 'severity');

      // Find positions in the table section
      const tableStart = report.indexOf('## Test Results with Coverage');
      const testMethod2Index = report.indexOf('TestClass2.testMethod2', tableStart);
      const testMethod3Index = report.indexOf('TestClass3.testMethod3', tableStart);
      const testMethod4Index = report.indexOf('TestClass4.testMethod4', tableStart);
      const testMethod1Index = report.indexOf('TestClass1.testMethod1', tableStart);

      // TestClass2 (both issues) should come first
      expect(testMethod2Index).toBeLessThan(testMethod3Index);
      expect(testMethod2Index).toBeLessThan(testMethod4Index);
      expect(testMethod2Index).toBeLessThan(testMethod1Index);
      // TestClass1 (no issues) should come last
      expect(testMethod1Index).toBeGreaterThan(testMethod2Index);
      expect(testMethod1Index).toBeGreaterThan(testMethod3Index);
      expect(testMethod1Index).toBeGreaterThan(testMethod4Index);
    });

    it('should sort passed tests by runtime (slowest first)', async () => {
      const result: TestResult = {
        summary: {
          outcome: 'Passed',
          testsRan: 3,
          passing: 3,
          failing: 0,
          skipped: 0,
          testExecutionTimeInMs: 15_000
        },
        tests: [
          {
            apexClass: {
              name: 'TestClass1',
              namespacePrefix: undefined
            },
            methodName: 'testMethod1',
            outcome: 'Pass',
            runTime: 2000, // Good performance
            message: undefined,
            stackTrace: undefined
          },
          {
            apexClass: {
              name: 'TestClass2',
              namespacePrefix: undefined
            },
            methodName: 'testMethod2',
            outcome: 'Pass',
            runTime: 6000, // Poor performance
            message: undefined,
            stackTrace: undefined
          },
          {
            apexClass: {
              name: 'TestClass3',
              namespacePrefix: undefined
            },
            methodName: 'testMethod3',
            outcome: 'Pass',
            runTime: 8000, // Worse performance
            message: undefined,
            stackTrace: undefined
          }
        ]
      } as unknown as TestResult;
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateMarkdownReport(result, timestamp);

      // Find positions in the passed tests section
      const passedSectionStart = report.indexOf('## ✅ Passed Tests');
      const testMethod3Index = report.indexOf('TestClass3.testMethod3', passedSectionStart);
      const testMethod2Index = report.indexOf('TestClass2.testMethod2', passedSectionStart);
      const testMethod1Index = report.indexOf('TestClass1.testMethod1', passedSectionStart);

      // TestClass3 (8s) should come before TestClass2 (6s) and TestClass1 (2s)
      expect(testMethod3Index).toBeLessThan(testMethod2Index);
      expect(testMethod2Index).toBeLessThan(testMethod1Index);
    });
  });

  describe('generateTextReport', () => {
    it('should generate text report with correct structure', async () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateTextReport(result, timestamp);

      expect(report).toContain('Apex Test Results');
      expect(report).toContain('Summary:');
      expect(report).toContain('  Passed:  2');
      expect(report).toContain('  Failed:  1');
      expect(report).toContain('  Skipped: 0');
      expect(report).toContain('  Total:   3');
    });

    it('should include failures section in text format', async () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateTextReport(result, timestamp);

      expect(report).toContain('Failures:');
      expect(report).toContain('TestClass2.testMethod3');
      expect(report).toContain('Error:');
      expect(report).toContain('Assertion failed: Expected true but was false');
      expect(report).toContain('Stack Trace:');
    });

    it('should include passed tests section in text format', async () => {
      const result = createMockTestResult();
      const timestamp = new Date('2025-01-15T10:30:00Z');

      const report = await generateTextReport(result, timestamp);

      expect(report).toContain('Passed Tests:');
      expect(report).toContain('  - TestClass1.testMethod1');
      expect(report).toContain('  - TestClass1.testMethod2');
    });
  });

  describe('writeAndOpenTestReport', () => {
    it('should write markdown report and open preview', async () => {
      const result = createMockTestResult();
      const outputDir = path.join('test', 'output');

      await writeAndOpenTestReport(result, outputDir, 'markdown');

      expect(mockWriteFile).toHaveBeenCalled();
      // Refresh should be called before showing preview
      expect(mockExecuteCommand).toHaveBeenCalledWith('markdown.preview.refresh');
      expect(mockExecuteCommand).toHaveBeenCalledWith('markdown.showPreview', expect.any(Object));
      expect(mockOpenTextDocument).not.toHaveBeenCalled();
      expect(mockShowTextDocument).not.toHaveBeenCalled();
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

    it('should use library filename format: test-result-{testRunId}.md', async () => {
      const result = createMockTestResult();
      const outputDir = path.join('test', 'output');

      await writeAndOpenTestReport(result, outputDir, 'markdown');

      expect(mockStat).not.toHaveBeenCalled();
      const writeCall = mockWriteFile.mock.calls[0];
      const [uri] = writeCall;
      // Should use library format: test-result-{testRunId}.md
      expect(uri.fsPath).toContain('test-result-test-run-123.md');
    });
  });
});
