/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  writeResultFiles,
  ApexTestResultOutcome,
  ResultFormat,
  TestResult,
  TestRunIdResult,
  OutputDirConfig,
  CodeCoverageResult,
  PerClassCoverage
} from '../../src';

describe('writeResultFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `apex-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  // Mock runPipeline function for testing
  const mockRunPipeline = async (readable: Readable, filePath: string): Promise<string> => {
    await pipeline(readable, createWriteStream(filePath));
    return filePath;
  };

  const mockTestResult: TestResult = {
    summary: {
      outcome: 'Completed',
      testsRan: 2,
      passing: 1,
      failing: 1,
      skipped: 0,
      passRate: '50%',
      failRate: '50%',
      skipRate: '0%',
      testStartTime: '2023-01-01T00:00:00.000Z',
      testExecutionTimeInMs: 1000,
      testTotalTimeInMs: 2000,
      commandTimeInMs: 3000,
      hostname: 'test-host',
      orgId: '00D000000000000EAA',
      username: 'test@example.com',
      testRunId: 'test-run-123',
      userId: '005000000000000AAA'
    },
    tests: [
      {
        id: '01p000000000001AAA',
        queueItemId: '709000000000001AAA',
        stackTrace: null as string | null,
        message: null as string | null,
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testMethod1',
        outcome: ApexTestResultOutcome.Pass,
        apexLogId: null as string | null,
        apexClass: {
          id: '01p000000000001AAA',
          name: 'TestClass1',
          namespacePrefix: null as unknown as string,
          fullName: 'TestClass1'
        },
        runTime: 500,
        testTimestamp: '2023-01-01T00:00:00.000Z',
        fullName: 'TestClass1.testMethod1'
      },
      {
        id: '01p000000000002AAA',
        queueItemId: '709000000000002AAA',
        stackTrace: 'System.AssertException: Assertion Failed',
        message: 'Test failed',
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testMethod2',
        outcome: ApexTestResultOutcome.Fail,
        apexLogId: '07L000000000001AAA',
        apexClass: {
          id: '01p000000000002AAA',
          name: 'TestClass2',
          namespacePrefix: null as unknown as string,
          fullName: 'TestClass2'
        },
        runTime: 300,
        testTimestamp: '2023-01-01T00:00:01.000Z',
        fullName: 'TestClass2.testMethod2'
      }
    ]
  };

  const mockCodeCoverageResult: CodeCoverageResult = {
    apexId: '01p000000000001AAA',
    name: 'TestClass1',
    type: 'ApexClass' as const,
    numLinesCovered: 5,
    numLinesUncovered: 2,
    percentage: '71%',
    coveredLines: [1, 2, 3, 4, 5],
    uncoveredLines: [6, 7]
  };

  const mockPerClassCoverage: PerClassCoverage = {
    apexClassOrTriggerName: 'TestClass1',
    apexClassOrTriggerId: '01p000000000001AAA',
    apexTestClassId: '01p000000000002AAA',
    apexTestMethodName: 'testMethod1',
    numLinesCovered: 5,
    numLinesUncovered: 2,
    percentage: '71%',
    coverage: mockCodeCoverageResult
  };

  it('should create test-run-id.txt file', async () => {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir
    };

    const result = await writeResultFiles(mockTestResult, outputConfig, false, mockRunPipeline);

    expect(result).toContain(join(tempDir, 'test-run-id.txt'));
    const content = await readFile(join(tempDir, 'test-run-id.txt'), 'utf8');
    expect(content).toBe('test-run-123');
  });

  it('should create JSON result file when format is specified', async () => {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.json]
    };

    const result = await writeResultFiles(mockTestResult, outputConfig, false, mockRunPipeline);

    const jsonFilePath = join(tempDir, 'test-result-test-run-123.json');
    expect(result).toContain(jsonFilePath);
    expect(existsSync(jsonFilePath)).toBe(true);

    const content = await readFile(jsonFilePath, 'utf8');
    const parsedContent = JSON.parse(content);
    expect(parsedContent.summary.testRunId).toBe('test-run-123');
    expect(parsedContent.tests).toHaveLength(2);
  });

  it('should create TAP result file when format is specified', async () => {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.tap]
    };

    const result = await writeResultFiles(mockTestResult, outputConfig, false, mockRunPipeline);

    const tapFilePath = join(tempDir, 'test-result-test-run-123-tap.txt');
    expect(result).toContain(tapFilePath);
    expect(existsSync(tapFilePath)).toBe(true);

    const content = await readFile(tapFilePath, 'utf8');
    expect(content).toContain('1..2');
    expect(content).toContain('ok 1 TestClass1.testMethod1');
    expect(content).toContain('not ok 2 TestClass2.testMethod2');
  });

  it('should create JUnit result file when format is specified', async () => {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.junit]
    };

    const result = await writeResultFiles(mockTestResult, outputConfig, false, mockRunPipeline);

    const junitFilePath = join(tempDir, 'test-result-test-run-123-junit.xml');
    expect(result).toContain(junitFilePath);
    expect(existsSync(junitFilePath)).toBe(true);

    const content = await readFile(junitFilePath, 'utf8');
    expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(content).toContain('<testsuite');
    expect(content).toContain('testMethod1');
    expect(content).toContain('testMethod2');
  });

  it('should create code coverage file when codeCoverage is true', async () => {
    const testResultWithCoverage: TestResult = {
      ...mockTestResult,
      tests: [
        {
          ...mockTestResult.tests[0],
          perClassCoverage: [mockPerClassCoverage]
        },
        ...mockTestResult.tests.slice(1)
      ]
    };

    const outputConfig: OutputDirConfig = {
      dirPath: tempDir
    };

    const result = await writeResultFiles(testResultWithCoverage, outputConfig, true, mockRunPipeline);

    const coverageFilePath = join(tempDir, 'test-result-test-run-123-codecoverage.json');
    expect(result).toContain(coverageFilePath);
    expect(existsSync(coverageFilePath)).toBe(true);

    const content = await readFile(coverageFilePath, 'utf8');
    const parsedContent = JSON.parse(content);
    expect(parsedContent).toHaveLength(1);
    expect(parsedContent[0]).toHaveLength(1);
    expect(parsedContent[0][0].apexClassOrTriggerName).toBe('TestClass1');
  });

  it('should create custom files when fileInfos is provided', async () => {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      fileInfos: [
        {
          filename: 'custom.txt',
          content: 'Custom content'
        },
        {
          filename: 'custom.json',
          content: { key: 'value', number: 42 }
        }
      ]
    };

    const result = await writeResultFiles(mockTestResult, outputConfig, false, mockRunPipeline);

    const textFilePath = join(tempDir, 'custom.txt');
    const jsonFilePath = join(tempDir, 'custom.json');

    expect(result).toContain(textFilePath);
    expect(result).toContain(jsonFilePath);

    const textContent = await readFile(textFilePath, 'utf8');
    expect(textContent).toBe('Custom content');

    const jsonContent = await readFile(jsonFilePath, 'utf8');
    const parsedJson = JSON.parse(jsonContent);
    expect(parsedJson.key).toBe('value');
    expect(parsedJson.number).toBe(42);
  });

  it('should handle TestRunIdResult type', async () => {
    const testRunIdResult: TestRunIdResult = {
      testRunId: 'run-id-456'
    };

    const outputConfig: OutputDirConfig = {
      dirPath: tempDir
    };

    const result = await writeResultFiles(testRunIdResult, outputConfig, false, mockRunPipeline);

    expect(result).toContain(join(tempDir, 'test-run-id.txt'));
    const content = await readFile(join(tempDir, 'test-run-id.txt'), 'utf8');
    expect(content).toBe('run-id-456');
  });

  it('should throw error for invalid result format', async () => {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: ['invalid' as ResultFormat]
    };

    await expect(writeResultFiles(mockTestResult, outputConfig, false, mockRunPipeline)).rejects.toThrow();
  });

  it('should only write the test-run-id file for a TestRunIdResult with result formats', async () => {
    const testRunIdResult: TestRunIdResult = {
      testRunId: 'run-id-456'
    };

    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.json]
    };

    // A TestRunIdResult is not a full TestResult, so result-format files are skipped.
    const result = await writeResultFiles(testRunIdResult, outputConfig, false, mockRunPipeline);
    expect(result).toEqual([join(tempDir, 'test-run-id.txt')]);
  });

  it('should only write the test-run-id file for a TestRunIdResult with code coverage', async () => {
    const testRunIdResult: TestRunIdResult = {
      testRunId: 'run-id-456'
    };

    const outputConfig: OutputDirConfig = {
      dirPath: tempDir
    };

    const result = await writeResultFiles(testRunIdResult, outputConfig, true, mockRunPipeline);
    expect(result).toEqual([join(tempDir, 'test-run-id.txt')]);
  });

  it('should create nested directories', async () => {
    const nestedDir = join(tempDir, 'nested', 'deep', 'path');
    const outputConfig: OutputDirConfig = {
      dirPath: nestedDir
    };

    const result = await writeResultFiles(mockTestResult, outputConfig, false, mockRunPipeline);

    expect(result).toContain(join(nestedDir, 'test-run-id.txt'));
    expect(existsSync(join(nestedDir, 'test-run-id.txt'))).toBe(true);
  });

  it('should create markdown result file when format is specified', async () => {
    // Add coverage data to ensure table appears in markdown output
    const testResultWithCoverage: TestResult = {
      ...mockTestResult,
      tests: [
        {
          ...mockTestResult.tests[0],
          perClassCoverage: [mockPerClassCoverage]
        },
        ...mockTestResult.tests.slice(1)
      ]
    };

    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.markdown]
    };

    const result = await writeResultFiles(
      testResultWithCoverage,
      outputConfig,
      true, // Enable code coverage to show table
      mockRunPipeline
    );

    const markdownFilePath = join(tempDir, 'test-result-test-run-123.md');
    expect(result).toContain(markdownFilePath);
    expect(existsSync(markdownFilePath)).toBe(true);

    const content = await readFile(markdownFilePath, 'utf8');
    expect(content).toContain('# Apex Test Results');
    expect(content).toContain('## Summary');
    expect(content).toContain('<table'); // Table appears when coverage is enabled
    expect(content).toContain('TestClass1');
    expect(content).toContain('TestClass2');
  });

  it('should create text result file when format is specified', async () => {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.text]
    };

    const result = await writeResultFiles(mockTestResult, outputConfig, false, mockRunPipeline);

    const textFilePath = join(tempDir, 'test-result-test-run-123.txt');
    expect(result).toContain(textFilePath);
    expect(existsSync(textFilePath)).toBe(true);

    const content = await readFile(textFilePath, 'utf8');
    expect(content).toContain('Apex Test Results');
    expect(content).toContain('Summary');
    expect(content).not.toContain('<table'); // Text format should not have HTML
    expect(content).not.toContain('##'); // Text format should not have markdown headers
  });

  it('should create markdown file with code coverage when enabled', async () => {
    const testResultWithCoverage: TestResult = {
      ...mockTestResult,
      tests: [
        {
          ...mockTestResult.tests[0],
          perClassCoverage: [mockPerClassCoverage]
        },
        ...mockTestResult.tests.slice(1)
      ],
      codecoverage: [mockCodeCoverageResult]
    };

    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.markdown]
    };

    const result = await writeResultFiles(testResultWithCoverage, outputConfig, true, mockRunPipeline);

    const markdownFilePath = join(tempDir, 'test-result-test-run-123.md');
    expect(result).toContain(markdownFilePath);

    const content = await readFile(markdownFilePath, 'utf8');
    expect(content).toContain('Code Coverage');
    expect(content).toContain('TestClass1');
  });

  it('should handle all result formats together', async () => {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.json, ResultFormat.tap, ResultFormat.junit, ResultFormat.markdown, ResultFormat.text]
    };

    const result = await writeResultFiles(mockTestResult, outputConfig, false, mockRunPipeline);

    expect(result).toHaveLength(6); // test-run-id.txt + 5 format files
    expect(result).toContain(join(tempDir, 'test-run-id.txt'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123.json'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123-tap.txt'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123-junit.xml'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123.md'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123.txt'));
  });

  it('should handle comprehensive scenario with all options', async () => {
    const testResultWithCoverage: TestResult = {
      ...mockTestResult,
      tests: [
        {
          ...mockTestResult.tests[0],
          perClassCoverage: [mockPerClassCoverage]
        },
        ...mockTestResult.tests.slice(1)
      ]
    };

    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [
        ResultFormat.json,
        ResultFormat.tap,
        ResultFormat.junit,
        ResultFormat.markdown,
        ResultFormat.text
      ],
      fileInfos: [
        {
          filename: 'custom.txt',
          content: 'Custom content'
        },
        {
          filename: 'metadata.json',
          content: { timestamp: '2023-01-01', version: '1.0' }
        }
      ]
    };

    const result = await writeResultFiles(testResultWithCoverage, outputConfig, true, mockRunPipeline);

    // Should have: test-run-id.txt + 5 formats + 1 coverage + 2 custom files = 9 files
    expect(result).toHaveLength(9);

    // Verify all files exist
    for (const filePath of result) {
      expect(existsSync(filePath)).toBe(true);
    }

    // Verify specific files
    expect(result).toContain(join(tempDir, 'test-run-id.txt'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123.json'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123-tap.txt'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123-junit.xml'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123.md'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123.txt'));
    expect(result).toContain(join(tempDir, 'test-result-test-run-123-codecoverage.json'));
    expect(result).toContain(join(tempDir, 'custom.txt'));
    expect(result).toContain(join(tempDir, 'metadata.json'));
  });
});
