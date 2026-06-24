/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'os';
import matchSnapshot from 'mocha-snap';
import {
  writeAsyncResultsToFile,
  ApexTestResultOutcome,
  TestResult
} from '../../src';

describe('writeAsyncResultsToFile - Snapshot Tests', () => {
  let tempDir: string;

  beforeEach(async function () {
    tempDir = join(
      tmpdir(),
      `apex-async-snapshot-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  const mockSnapshotResults: TestResult = {
    summary: {
      outcome: 'Completed',
      testsRan: 4,
      passing: 3,
      failing: 1,
      skipped: 0,
      passRate: '75%',
      failRate: '25%',
      skipRate: '0%',
      testStartTime: '2023-01-01T14:30:00.000Z',
      testExecutionTimeInMs: 2000,
      testTotalTimeInMs: 3000,
      commandTimeInMs: 4000,
      hostname: 'async-snapshot-host',
      orgId: '00D000000000000EAA',
      username: 'async-snapshot@example.com',
      testRunId: 'async-snapshot-run-789',
      userId: '005000000000000AAA'
    },
    tests: [
      {
        id: '01p000000000001AAA',
        queueItemId: '709000000000001AAA',
        stackTrace: null as string | null,
        message: null as string | null,
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testAsyncSnapshotMethod1',
        outcome: ApexTestResultOutcome.Pass,
        apexLogId: null as string | null,
        apexClass: {
          id: '01p000000000001AAA',
          name: 'AsyncSnapshotTestClass1',
          namespacePrefix: null as string | null,
          fullName: 'AsyncSnapshotTestClass1'
        },
        runTime: 800,
        testTimestamp: '2023-01-01T14:30:00.500Z',
        fullName: 'AsyncSnapshotTestClass1.testAsyncSnapshotMethod1'
      },
      {
        id: '01p000000000002AAA',
        queueItemId: '709000000000002AAA',
        stackTrace:
          'System.AsyncException: Async operation failed\\nLine 15: someMethod()\\nLine 23: anotherMethod()',
        message: 'Async test failed with complex error details',
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testAsyncSnapshotMethod2',
        outcome: ApexTestResultOutcome.Fail,
        apexLogId: '07L000000000001AAA',
        apexClass: {
          id: '01p000000000002AAA',
          name: 'AsyncSnapshotTestClass2',
          namespacePrefix: 'AsyncNamespace',
          fullName: 'AsyncNamespace.AsyncSnapshotTestClass2'
        },
        runTime: 600,
        testTimestamp: '2023-01-01T14:30:01.100Z',
        fullName:
          'AsyncNamespace.AsyncSnapshotTestClass2.testAsyncSnapshotMethod2'
      },
      {
        id: '01p000000000003AAA',
        queueItemId: '709000000000003AAA',
        stackTrace: null as string | null,
        message: null as string | null,
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testAsyncSnapshotMethod3',
        outcome: ApexTestResultOutcome.Pass,
        apexLogId: null as string | null,
        apexClass: {
          id: '01p000000000003AAA',
          name: 'AsyncSnapshotTestClass3',
          namespacePrefix: null as string | null,
          fullName: 'AsyncSnapshotTestClass3'
        },
        runTime: 400,
        testTimestamp: '2023-01-01T14:30:01.500Z',
        fullName: 'AsyncSnapshotTestClass3.testAsyncSnapshotMethod3'
      },
      {
        id: '01p000000000004AAA',
        queueItemId: '709000000000004AAA',
        stackTrace: null as string | null,
        message: null as string | null,
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testAsyncSnapshotMethod4',
        outcome: ApexTestResultOutcome.Pass,
        apexLogId: null as string | null,
        apexClass: {
          id: '01p000000000004AAA',
          name: 'AsyncSnapshotTestClass4',
          namespacePrefix: 'AnotherNamespace',
          fullName: 'AnotherNamespace.AsyncSnapshotTestClass4'
        },
        runTime: 200,
        testTimestamp: '2023-01-01T14:30:01.700Z',
        fullName:
          'AnotherNamespace.AsyncSnapshotTestClass4.testAsyncSnapshotMethod4'
      }
    ]
  };

  it('should produce consistent async results JSON output', async function () {
    const runId = 'snapshot-async-test-123';

    await writeAsyncResultsToFile(mockSnapshotResults, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);

    // Snapshot the complete async results structure
    matchSnapshot(parsedContent);

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });

  it('should produce consistent output with null values', async function () {
    const resultsWithNulls: TestResult = {
      summary: {
        ...mockSnapshotResults.summary,
        testRunId: 'null-values-snapshot-test'
      },
      tests: [
        {
          id: '01p000000000001AAA',
          queueItemId: '709000000000001AAA',
          stackTrace: null as string | null,
          message: null as string | null,
          asyncApexJobId: '707000000000001AAA',
          methodName: 'testWithNullValues',
          outcome: ApexTestResultOutcome.Pass,
          apexLogId: null as string | null,
          apexClass: {
            id: '01p000000000001AAA',
            name: 'NullValuesTestClass',
            namespacePrefix: null as string | null,
            fullName: 'NullValuesTestClass'
          },
          runTime: 250,
          testTimestamp: '2023-01-01T14:30:00.000Z',
          fullName: 'NullValuesTestClass.testWithNullValues'
        }
      ]
    };

    const runId = 'null-values-snapshot';

    await writeAsyncResultsToFile(resultsWithNulls, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);

    // Snapshot to ensure null values are handled consistently
    matchSnapshot(parsedContent);

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });

  it('should produce consistent output with complex nested data', async function () {
    const complexResults: TestResult = {
      ...mockSnapshotResults,
      tests: [
        {
          ...mockSnapshotResults.tests[0],
          perClassCoverage: [] // Test empty arrays
        },
        {
          ...mockSnapshotResults.tests[1],
          stackTrace:
            'Multi-line\\nstack\\ntrace\\nwith\\nspecial\\ncharacters: "quotes", \\backslashes, and [brackets]'
        }
      ]
    };

    const runId = 'complex-data-snapshot';

    await writeAsyncResultsToFile(complexResults, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);

    // Snapshot to ensure complex data structures are handled consistently
    matchSnapshot(parsedContent);

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });

  it('should produce consistent output with empty test results', async function () {
    const emptyResults: TestResult = {
      summary: {
        outcome: 'Completed',
        testsRan: 0,
        passing: 0,
        failing: 0,
        skipped: 0,
        passRate: '0%',
        failRate: '0%',
        skipRate: '0%',
        testStartTime: '2023-01-01T14:30:00.000Z',
        testExecutionTimeInMs: 0,
        testTotalTimeInMs: 0,
        commandTimeInMs: 100,
        hostname: 'empty-test-host',
        orgId: '00D000000000000EAA',
        username: 'empty@example.com',
        testRunId: 'empty-snapshot-test',
        userId: '005000000000000AAA'
      },
      tests: []
    };

    const runId = 'empty-results-snapshot';

    await writeAsyncResultsToFile(emptyResults, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);

    // Snapshot to ensure empty results are handled consistently
    matchSnapshot(parsedContent);

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });
});
