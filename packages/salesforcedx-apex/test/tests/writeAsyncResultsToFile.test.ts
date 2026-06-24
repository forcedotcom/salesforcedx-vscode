/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { join } from 'path';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'os';
import {
  writeAsyncResultsToFile,
  ApexTestResultOutcome,
  TestResult
} from '../../src';

describe('writeAsyncResultsToFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `apex-async-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  const mockFormattedResults: TestResult = {
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
      testRunId: 'async-test-run-123',
      userId: '005000000000000AAA'
    },
    tests: [
      {
        id: '01p000000000001AAA',
        queueItemId: '709000000000001AAA',
        stackTrace: null as string | null,
        message: null as string | null,
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testAsyncMethod1',
        outcome: ApexTestResultOutcome.Pass,
        apexLogId: null as string | null,
        apexClass: {
          id: '01p000000000001AAA',
          name: 'AsyncTestClass1',
          namespacePrefix: null as string | null,
          fullName: 'AsyncTestClass1'
        },
        runTime: 750,
        testTimestamp: '2023-01-01T00:00:00.000Z',
        fullName: 'AsyncTestClass1.testAsyncMethod1'
      },
      {
        id: '01p000000000002AAA',
        queueItemId: '709000000000002AAA',
        stackTrace: 'System.AssertException: Async test assertion failed',
        message: 'Async test failed',
        asyncApexJobId: '707000000000001AAA',
        methodName: 'testAsyncMethod2',
        outcome: ApexTestResultOutcome.Fail,
        apexLogId: '07L000000000001AAA',
        apexClass: {
          id: '01p000000000002AAA',
          name: 'AsyncTestClass2',
          namespacePrefix: null as string | null,
          fullName: 'AsyncTestClass2'
        },
        runTime: 450,
        testTimestamp: '2023-01-01T00:00:01.000Z',
        fullName: 'AsyncTestClass2.testAsyncMethod2'
      }
    ]
  };

  it('should create rawResults.json file in default temp directory', async () => {
    const runId = 'test-run-456';

    await writeAsyncResultsToFile(mockFormattedResults, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    expect(existsSync(expectedPath)).to.be.true;

    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);
    expect(parsedContent.summary.testRunId).to.equal('async-test-run-123');
    expect(parsedContent.tests).to.have.length(2);
    expect(parsedContent.tests[0].methodName).to.equal('testAsyncMethod1');
    expect(parsedContent.tests[1].methodName).to.equal('testAsyncMethod2');

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });

  it('should preserve all test result data accurately', async () => {
    const runId = 'test-data-preservation';

    await writeAsyncResultsToFile(mockFormattedResults, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);

    // Verify summary data
    expect(parsedContent.summary.outcome).to.equal('Completed');
    expect(parsedContent.summary.testsRan).to.equal(2);
    expect(parsedContent.summary.passing).to.equal(1);
    expect(parsedContent.summary.failing).to.equal(1);
    expect(parsedContent.summary.passRate).to.equal('50%');
    expect(parsedContent.summary.hostname).to.equal('test-host');

    // Verify test details
    const passedTest = parsedContent.tests.find(
      (t: TestResult['tests'][number]) => t.outcome === 'Pass'
    );
    const failedTest = parsedContent.tests.find(
      (t: TestResult['tests'][number]) => t.outcome === 'Fail'
    );

    expect(passedTest).to.exist;
    expect(passedTest.methodName).to.equal('testAsyncMethod1');
    expect(passedTest.runTime).to.equal(750);
    expect(passedTest.apexClass.name).to.equal('AsyncTestClass1');

    expect(failedTest).to.exist;
    expect(failedTest.methodName).to.equal('testAsyncMethod2');
    expect(failedTest.stackTrace).to.include('System.AssertException');
    expect(failedTest.message).to.equal('Async test failed');

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });

  it('should create properly formatted JSON', async () => {
    const runId = 'json-format-test';

    await writeAsyncResultsToFile(mockFormattedResults, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    const content = await readFile(expectedPath, 'utf8');

    // Verify it's valid JSON
    expect(() => JSON.parse(content)).to.not.throw();

    // Verify JSON structure matches expected format
    const parsedContent = JSON.parse(content);
    expect(parsedContent).to.have.property('summary');
    expect(parsedContent).to.have.property('tests');
    expect(parsedContent.tests).to.be.an('array');

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });

  it('should handle empty test results', async () => {
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
        testStartTime: '2023-01-01T00:00:00.000Z',
        testExecutionTimeInMs: 0,
        testTotalTimeInMs: 0,
        commandTimeInMs: 100,
        hostname: 'test-host',
        orgId: '00D000000000000EAA',
        username: 'test@example.com',
        testRunId: 'empty-test-run',
        userId: '005000000000000AAA'
      },
      tests: []
    };

    const runId = 'empty-results-test';

    await writeAsyncResultsToFile(emptyResults, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    expect(existsSync(expectedPath)).to.be.true;

    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);
    expect(parsedContent.summary.testsRan).to.equal(0);
    expect(parsedContent.tests).to.have.length(0);

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });

  it('should handle special characters in runId', async () => {
    const runId = 'test-run-with-special-chars_123-456';

    await writeAsyncResultsToFile(mockFormattedResults, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    expect(existsSync(expectedPath)).to.be.true;

    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);
    expect(parsedContent.summary.testRunId).to.equal('async-test-run-123');

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });

  it('should create directory structure if it does not exist', async () => {
    const runId = 'nested/deep/directory/structure';

    await writeAsyncResultsToFile(mockFormattedResults, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    expect(existsSync(expectedPath)).to.be.true;

    // Cleanup
    await rm(join(tmpdir(), 'nested'), { recursive: true, force: true });
  });

  it('should handle large test results efficiently', async () => {
    // Create a large test result with many tests
    const largeTestResult: TestResult = {
      ...mockFormattedResults,
      summary: {
        ...mockFormattedResults.summary,
        testsRan: 1000,
        passing: 800,
        failing: 200
      },
      tests: Array.from({ length: 1000 }, (_, i) => ({
        id: `01p00000000000${i.toString().padStart(4, '0')}AAA`,
        queueItemId: `709000000000${i.toString().padStart(3, '0')}AAA`,
        stackTrace:
          i % 5 === 0 ? 'Stack trace for failed test' : (null as string | null),
        message: i % 5 === 0 ? 'Test failed' : (null as string | null),
        asyncApexJobId: '707000000000001AAA',
        methodName: `testMethod${i}`,
        outcome:
          i % 5 === 0 ? ApexTestResultOutcome.Fail : ApexTestResultOutcome.Pass,
        apexLogId: null as string | null,
        apexClass: {
          id: `01p00000000000${i.toString().padStart(4, '0')}AAA`,
          name: `TestClass${i}`,
          namespacePrefix: null as string | null,
          fullName: `TestClass${i}`
        },
        runTime: Math.floor(Math.random() * 1000),
        testTimestamp: '2023-01-01T00:00:00.000Z',
        fullName: `TestClass${i}.testMethod${i}`
      }))
    };

    const runId = 'large-test-results';
    const startTime = Date.now();

    await writeAsyncResultsToFile(largeTestResult, runId);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (less than 5 seconds)
    expect(duration).to.be.lessThan(5000);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    expect(existsSync(expectedPath)).to.be.true;

    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);
    expect(parsedContent.tests).to.have.length(1000);

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });

  it('should handle concurrent writes to different runIds', async () => {
    const runIds = ['concurrent-1', 'concurrent-2', 'concurrent-3'];

    const writePromises = runIds.map((runId) =>
      writeAsyncResultsToFile(mockFormattedResults, runId)
    );

    await Promise.all(writePromises);

    // Verify all files were created
    for (const runId of runIds) {
      const expectedPath = join(tmpdir(), runId, 'rawResults.json');
      expect(existsSync(expectedPath)).to.be.true;

      const content = await readFile(expectedPath, 'utf8');
      const parsedContent = JSON.parse(content);
      expect(parsedContent.summary.testRunId).to.equal('async-test-run-123');

      // Cleanup
      await rm(join(tmpdir(), runId), { recursive: true, force: true });
    }
  });

  it('should maintain consistent output format across multiple writes', async () => {
    const runId1 = 'consistency-test-1';
    const runId2 = 'consistency-test-2';

    await writeAsyncResultsToFile(mockFormattedResults, runId1);
    await writeAsyncResultsToFile(mockFormattedResults, runId2);

    const path1 = join(tmpdir(), runId1, 'rawResults.json');
    const path2 = join(tmpdir(), runId2, 'rawResults.json');

    const content1 = await readFile(path1, 'utf8');
    const content2 = await readFile(path2, 'utf8');

    // Both files should have identical content
    expect(content1).to.equal(content2);

    // Cleanup
    await rm(join(tmpdir(), runId1), { recursive: true, force: true });
    await rm(join(tmpdir(), runId2), { recursive: true, force: true });
  });

  it('should handle test results with null and undefined values', async () => {
    const testResultWithNulls: TestResult = {
      summary: {
        outcome: 'Completed',
        testsRan: 1,
        passing: 1,
        failing: 0,
        skipped: 0,
        passRate: '100%',
        failRate: '0%',
        skipRate: '0%',
        testStartTime: '2023-01-01T00:00:00.000Z',
        testExecutionTimeInMs: 500,
        testTotalTimeInMs: 1000,
        commandTimeInMs: 1500,
        hostname: 'test-host',
        orgId: '00D000000000000EAA',
        username: 'test@example.com',
        testRunId: 'null-test-run',
        userId: '005000000000000AAA'
      },
      tests: [
        {
          id: '01p000000000001AAA',
          queueItemId: '709000000000001AAA',
          stackTrace: null as string | null,
          message: null as string | null,
          asyncApexJobId: '707000000000001AAA',
          methodName: 'testWithNulls',
          outcome: ApexTestResultOutcome.Pass,
          apexLogId: null as string | null,
          apexClass: {
            id: '01p000000000001AAA',
            name: 'TestClassWithNulls',
            namespacePrefix: null as string | null,
            fullName: 'TestClassWithNulls'
          },
          runTime: 250,
          testTimestamp: '2023-01-01T00:00:00.000Z',
          fullName: 'TestClassWithNulls.testWithNulls'
        }
      ]
    };

    const runId = 'null-values-test';

    await writeAsyncResultsToFile(testResultWithNulls, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);

    expect(parsedContent.tests[0].stackTrace).to.be.null;
    expect(parsedContent.tests[0].message).to.be.null;
    expect(parsedContent.tests[0].apexLogId).to.be.null;
    expect(parsedContent.tests[0].apexClass.namespacePrefix).to.be.null;

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });

  it('should handle test results with complex nested data', async () => {
    const complexTestResult: TestResult = {
      ...mockFormattedResults,
      tests: [
        {
          ...mockFormattedResults.tests[0],
          // Add some complex nested data if available in the type
          perClassCoverage: [] // Empty array to test array handling
        }
      ]
    };

    const runId = 'complex-data-test';

    await writeAsyncResultsToFile(complexTestResult, runId);

    const expectedPath = join(tmpdir(), runId, 'rawResults.json');
    const content = await readFile(expectedPath, 'utf8');
    const parsedContent = JSON.parse(content);

    expect(parsedContent.tests[0]).to.have.property('perClassCoverage');
    expect(parsedContent.tests[0].perClassCoverage).to.be.an('array');

    // Cleanup
    await rm(join(tmpdir(), runId), { recursive: true, force: true });
  });
});
