/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import { pipeline } from 'node:stream/promises';
import matchSnapshot from 'mocha-snap';
import {
  writeResultFiles,
  ApexTestResultOutcome,
  ResultFormat,
  TestResult,
  OutputDirConfig,
  CodeCoverageResult,
  PerClassCoverage
} from '../../src';

describe('writeResultFiles - Snapshot Tests', () => {
  let tempDir: string;

  beforeEach(async function () {
    tempDir = join(
      tmpdir(),
      `apex-snapshot-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  // Mock runPipeline function for testing
  const mockRunPipeline = async (
    readable: Readable,
    filePath: string
  ): Promise<string> => {
    await pipeline(readable, createWriteStream(filePath));
    return filePath;
  };

  const mockTestResult: TestResult = {
    summary: {
      outcome: 'Completed',
      testsRan: 3,
      passing: 2,
      failing: 1,
      skipped: 0,
      passRate: '67%',
      failRate: '33%',
      skipRate: '0%',
      testStartTime: '2023-01-01T12:00:00.000Z',
      testExecutionTimeInMs: 1500,
      testTotalTimeInMs: 2500,
      commandTimeInMs: 3500,
      hostname: 'snapshot-test-host',
      orgId: '00D000000000000EAA',
      username: 'snapshot@example.com',
      testRunId: 'snapshot-test-run-456',
      userId: '005000000000000AAA'
    },
    tests: [
      {
        id: '01p000000000001AAA',
        queueItemId: '709000000000001AAA',
        stackTrace: null as string | null,
        message: null as string | null,
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testSnapshotMethod1',
        outcome: ApexTestResultOutcome.Pass,
        apexLogId: null as string | null,
        apexClass: {
          id: '01p000000000001AAA',
          name: 'SnapshotTestClass1',
          namespacePrefix: null as string | null,
          fullName: 'SnapshotTestClass1'
        },
        runTime: 750,
        testTimestamp: '2023-01-01T12:00:00.500Z',
        fullName: 'SnapshotTestClass1.testSnapshotMethod1'
      },
      {
        id: '01p000000000002AAA',
        queueItemId: '709000000000002AAA',
        stackTrace: 'System.AssertException: Snapshot test assertion failed',
        message: 'Snapshot test failed with detailed error message',
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testSnapshotMethod2',
        outcome: ApexTestResultOutcome.Fail,
        apexLogId: '07L000000000001AAA',
        apexClass: {
          id: '01p000000000002AAA',
          name: 'SnapshotTestClass2',
          namespacePrefix: 'TestNamespace',
          fullName: 'TestNamespace.SnapshotTestClass2'
        },
        runTime: 450,
        testTimestamp: '2023-01-01T12:00:01.200Z',
        fullName: 'TestNamespace.SnapshotTestClass2.testSnapshotMethod2'
      },
      {
        id: '01p000000000003AAA',
        queueItemId: '709000000000003AAA',
        stackTrace: null as string | null,
        message: null as string | null,
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testSnapshotMethod3',
        outcome: ApexTestResultOutcome.Pass,
        apexLogId: null as string | null,
        apexClass: {
          id: '01p000000000003AAA',
          name: 'SnapshotTestClass3',
          namespacePrefix: null as string | null,
          fullName: 'SnapshotTestClass3'
        },
        runTime: 300,
        testTimestamp: '2023-01-01T12:00:01.800Z',
        fullName: 'SnapshotTestClass3.testSnapshotMethod3'
      }
    ]
  };

  const mockCodeCoverageResult: CodeCoverageResult = {
    apexId: '01p000000000001AAA',
    name: 'SnapshotTestClass1',
    type: 'ApexClass' as const,
    numLinesCovered: 8,
    numLinesUncovered: 2,
    percentage: '80%',
    coveredLines: [1, 2, 3, 4, 5, 6, 7, 8],
    uncoveredLines: [9, 10]
  };

  const mockPerClassCoverage: PerClassCoverage = {
    apexClassOrTriggerName: 'SnapshotTestClass1',
    apexClassOrTriggerId: '01p000000000001AAA',
    apexTestClassId: '01p000000000002AAA',
    apexTestMethodName: 'testSnapshotMethod1',
    numLinesCovered: 8,
    numLinesUncovered: 2,
    percentage: '80%',
    coverage: mockCodeCoverageResult
  };

  it('should produce consistent JSON output', async function () {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.json]
    };

    await writeResultFiles(
      mockTestResult,
      outputConfig,
      false,
      mockRunPipeline
    );

    const jsonFilePath = join(
      tempDir,
      'test-result-snapshot-test-run-456.json'
    );
    const content = await readFile(jsonFilePath, 'utf8');
    const parsedContent = JSON.parse(content);

    // Snapshot the parsed JSON structure
    matchSnapshot(parsedContent);
  });

  it('should produce consistent TAP output', async function () {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.tap]
    };

    await writeResultFiles(
      mockTestResult,
      outputConfig,
      false,
      mockRunPipeline
    );

    const tapFilePath = join(
      tempDir,
      'test-result-snapshot-test-run-456-tap.txt'
    );
    const content = await readFile(tapFilePath, 'utf8');

    // Snapshot the TAP output
    matchSnapshot(content);
  });

  it('should produce consistent JUnit output', async function () {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      resultFormats: [ResultFormat.junit]
    };

    await writeResultFiles(
      mockTestResult,
      outputConfig,
      false,
      mockRunPipeline
    );

    const junitFilePath = join(
      tempDir,
      'test-result-snapshot-test-run-456-junit.xml'
    );
    const content = await readFile(junitFilePath, 'utf8');

    // Snapshot the JUnit XML output
    matchSnapshot(content);
  });

  it('should produce consistent code coverage output', async function () {
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

    await writeResultFiles(
      testResultWithCoverage,
      outputConfig,
      true,
      mockRunPipeline
    );

    const coverageFilePath = join(
      tempDir,
      'test-result-snapshot-test-run-456-codecoverage.json'
    );
    const content = await readFile(coverageFilePath, 'utf8');
    const parsedContent = JSON.parse(content);

    // Snapshot the code coverage structure
    matchSnapshot(parsedContent);
  });

  it('should produce consistent fileInfos output', async function () {
    const outputConfig: OutputDirConfig = {
      dirPath: tempDir,
      fileInfos: [
        {
          filename: 'snapshot-custom.txt',
          content: 'Snapshot custom content for testing'
        },
        {
          filename: 'snapshot-metadata.json',
          content: {
            timestamp: '2023-01-01T12:00:00.000Z',
            version: '2.0.0',
            environment: 'snapshot-test',
            features: ['feature1', 'feature2'],
            config: {
              debug: true,
              timeout: 5000,
              retries: 3
            }
          }
        }
      ]
    };

    await writeResultFiles(
      mockTestResult,
      outputConfig,
      false,
      mockRunPipeline
    );

    // Test string content
    const textFilePath = join(tempDir, 'snapshot-custom.txt');
    const textContent = await readFile(textFilePath, 'utf8');
    matchSnapshot(textContent);

    // Test JSON object content
    const jsonFilePath = join(tempDir, 'snapshot-metadata.json');
    const jsonContent = await readFile(jsonFilePath, 'utf8');
    const parsedJsonContent = JSON.parse(jsonContent);
    matchSnapshot(parsedJsonContent);
  });

  it('should produce consistent comprehensive output with all options', async function () {
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
      resultFormats: [ResultFormat.json, ResultFormat.tap, ResultFormat.junit],
      fileInfos: [
        {
          filename: 'comprehensive-test.txt',
          content: 'Comprehensive test content'
        },
        {
          filename: 'comprehensive-config.json',
          content: {
            test: 'comprehensive',
            settings: {
              parallel: true,
              verbose: false
            }
          }
        }
      ]
    };

    const result = await writeResultFiles(
      testResultWithCoverage,
      outputConfig,
      true,
      mockRunPipeline
    );

    // Snapshot the list of created files (sorted for consistency)
    const sortedResult = result
      .map((path) => path.replace(tempDir, '[TEMP_DIR]'))
      .sort();
    matchSnapshot(sortedResult);

    // Snapshot each file's content
    for (const filePath of result) {
      const fileName = filePath.split('/').pop();
      const content = await readFile(filePath, 'utf8');

      if (fileName?.endsWith('.json')) {
        const parsedContent = JSON.parse(content);
        matchSnapshot(parsedContent);
      } else {
        matchSnapshot(content);
      }
    }
  });
});
