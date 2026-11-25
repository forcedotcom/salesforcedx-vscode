/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { stringifyTestResultChunks } from '../../src/streaming/testResultStringify';
import { type CodeCoverageResult, type PerClassCoverage } from '../../src/effect/coverageSchemas';
import { type TestResult } from '../../src/tests/types';
import { apexClassId, salesforceId } from '../schemaHelpers';

const firstAsyncApexJobId = salesforceId('707000000000001AAA');
const secondAsyncApexJobId = salesforceId('707000000000002AAA');

const tests: TestResult['tests'] = [
  {
    id: 'testId1',
    queueItemId: 'queueItemId1',
    stackTrace: null,
    message: null,
    asyncApexJobId: firstAsyncApexJobId,
    methodName: 'testMethod1',
    outcome: 'Pass',
    apexLogId: null,
    apexClass: {
      id: 'classId1',
      name: 'TestClass1',
      namespacePrefix: 'ns1',
      fullName: 'ns1.TestClass1'
    },
    runTime: 1.23,
    testTimestamp: '2023-01-01T00:00:00Z',
    fullName: 'ns1.TestClass1.testMethod1',
    perClassCoverage: [] as PerClassCoverage[] // Add PerClassCoverage objects here if needed
  },
  {
    id: 'testId2',
    queueItemId: 'queueItemId2',
    stackTrace: 'Exception in thread "main" java.lang.NullPointerException',
    message: 'Null pointer exception',
    asyncApexJobId: secondAsyncApexJobId,
    methodName: 'testMethod2',
    outcome: 'Fail',
    apexLogId: 'logId2',
    apexClass: {
      id: 'classId2',
      name: 'TestClass2',
      namespacePrefix: 'ns2',
      fullName: 'ns2.TestClass2'
    },
    runTime: 2.34,
    testTimestamp: '2023-01-02T00:00:00Z',
    fullName: 'ns2.TestClass2.testMethod2',
    perClassCoverage: [] as PerClassCoverage[] // Add PerClassCoverage objects here if needed
  }
];
const perClassCoverageData: PerClassCoverage[] = [
  {
    apexClassOrTriggerName: tests[0].apexClass.name,
    apexClassOrTriggerId: apexClassId('01p000000000001AAA'),
    apexTestClassId: apexClassId('01p000000000003AAA'),
    apexTestMethodName: tests[0].methodName,
    numLinesCovered: 80,
    numLinesUncovered: 20,
    percentage: '80%',
    coverage: {
      coveredLines: [1, 2, 3, 4, 5, 6, 7, 8],
      uncoveredLines: [9, 10]
    }
  },
  {
    apexClassOrTriggerName: tests[1].apexClass.name,
    apexClassOrTriggerId: apexClassId('01p000000000002AAA'),
    apexTestClassId: apexClassId('01p000000000004AAA'),
    apexTestMethodName: tests[1].methodName,
    numLinesCovered: 60,
    numLinesUncovered: 40,
    percentage: '60%',
    coverage: {
      coveredLines: [1, 2, 3, 4, 5, 6],
      uncoveredLines: [7, 8, 9, 10]
    }
  }
];
const coverageData: CodeCoverageResult[] = [
  {
    apexId: 'apexId1',
    name: 'ApexClass1',
    type: 'ApexClass',
    numLinesCovered: 80,
    numLinesUncovered: 20,
    percentage: '80%',
    coveredLines: [1, 2, 3, 4, 5, 6, 7, 8],
    uncoveredLines: [9, 10]
  },
  {
    apexId: 'apexId2',
    name: 'ApexTrigger1',
    type: 'ApexTrigger',
    numLinesCovered: 60,
    numLinesUncovered: 40,
    percentage: '60%',
    coveredLines: [1, 2, 3, 4, 5, 6],
    uncoveredLines: [7, 8, 9, 10]
  }
];
describe('TestResult JSON chunks', () => {
  let testResult: TestResult;

  beforeEach(() => {
    // Initialize testResult with some default values
    testResult = {
      summary: {
        failRate: '0%',
        testsRan: 1,
        orgId: '00Dxx0000001gPL',
        outcome: 'Passed',
        passing: 1,
        failing: 0,
        skipped: 0,
        passRate: '100%',
        skipRate: '0%',
        testStartTime: '1641340181000',
        testExecutionTimeInMs: 1,
        testTotalTimeInMs: 1,
        commandTimeInMs: 1,
        hostname: 'test.salesforce.com',
        username: 'test-user@test.com',
        testRunId: '707xx0000BfHFQA',
        userId: '005xx000001Swi2',
        testRunCoverage: '100%',
        orgWideCoverage: '80%',
        totalLines: 100,
        coveredLines: 80
      },
      tests: [],
      codecoverage: []
    };
  });

  it('serializes an empty test list with no code coverage', () => {
    const emptyTestsNoCoverage = structuredClone(testResult);
    delete emptyTestsNoCoverage.codecoverage;
    const output = [...stringifyTestResultChunks(emptyTestsNoCoverage)].join('');
    expect(() => JSON.parse(output)).not.toThrow();
    const expectedOutput = JSON.stringify(emptyTestsNoCoverage);
    expect(output).toBe(expectedOutput);
  });
  it('serializes tests without code coverage', () => {
    const testsWithoutCoverage = structuredClone(tests);
    const resultsWithTests = {
      ...testResult,
      tests: testsWithoutCoverage
    };
    delete resultsWithTests.codecoverage;
    const output = [...stringifyTestResultChunks(resultsWithTests)].join('');
    expect(() => JSON.parse(output)).not.toThrow();
    const expectedOutput = JSON.stringify(resultsWithTests);
    expect(output).toBe(expectedOutput);
  });
  it('serializes tests and code coverage', () => {
    const testsWithCoverage = structuredClone(tests);
    testsWithCoverage[0].perClassCoverage = [perClassCoverageData[0]];
    testsWithCoverage[1].perClassCoverage = perClassCoverageData;
    const resultsWithTests = {
      ...testResult,
      tests: testsWithCoverage,
      codecoverage: coverageData
    };
    const output = [...stringifyTestResultChunks(resultsWithTests)].join('');
    expect(() => JSON.parse(output)).not.toThrow();
    const expectedOutput = JSON.stringify(resultsWithTests);
    expect(output).toBe(expectedOutput);
  });

  it('includes setup results only when requested', () => {
    const result = {
      ...testResult,
      setup: [
        {
          methodName: 'testSetup',
          apexClass: { name: 'SetupClass', fullName: 'SetupClass' },
          testSetupTime: 1,
          fullName: 'SetupClass.testSetup'
        }
      ]
    };

    expect([...stringifyTestResultChunks(result)].join('')).toBe(
      JSON.stringify({ summary: result.summary, tests: result.tests, codecoverage: result.codecoverage })
    );
    expect([...stringifyTestResultChunks(result, { includeSetup: true })].join('')).toBe(
      JSON.stringify({
        summary: result.summary,
        tests: result.tests,
        setup: result.setup,
        codecoverage: result.codecoverage
      })
    );
  });
});
