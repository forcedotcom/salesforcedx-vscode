/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { ApexTestResultOutcome } from '../../src';
import { TestResultStringifyStream } from '../../src/streaming';
import {
  CodeCoverageResult,
  PerClassCoverage,
  TestResult
} from '../../src/tests';

const tests = [
  {
    id: 'testId1',
    queueItemId: 'queueItemId1',
    stackTrace: null,
    message: null,
    asyncApexJobId: 'asyncApexJobId1',
    methodName: 'testMethod1',
    outcome: ApexTestResultOutcome.Pass,
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
    asyncApexJobId: 'asyncApexJobId2',
    methodName: 'testMethod2',
    outcome: ApexTestResultOutcome.Fail,
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
    apexClassOrTriggerId: tests[0].apexClass.id,
    apexTestClassId: tests[0].id,
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
    apexClassOrTriggerId: tests[1].apexClass.id,
    apexTestClassId: tests[1].id,
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
describe('TestResultStringifyStream', () => {
  let testResult: TestResult;
  let stream: TestResultStringifyStream;

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

  it('should transform TestResult into a JSON string with empty tests and no coverage', (done) => {
    let output = '';
    const emptyTestsNoCoverage = structuredClone(testResult);
    delete emptyTestsNoCoverage.codecoverage;
    // Initialize the stream with the testResult
    stream = new TestResultStringifyStream(emptyTestsNoCoverage);

    stream.on('data', (chunk: string) => {
      output += chunk;
    });

    stream.on('end', () => {
      expect(() => JSON.parse(output)).to.not.throw();
      const expectedOutput = JSON.stringify(emptyTestsNoCoverage);
      expect(output).to.equal(expectedOutput);
      done();
    });

    stream._read();
  });
  it('should transform TestResult into a JSON string with tests and no coverage', (done) => {
    let output = '';
    const testsWithoutCoverage = structuredClone(tests);
    const resultsWithTests = {
      ...testResult,
      tests: testsWithoutCoverage
    };
    delete resultsWithTests.codecoverage;
    // Initialize the stream with the testResult
    stream = new TestResultStringifyStream(resultsWithTests);

    stream.on('data', (chunk: string) => {
      output += chunk;
    });

    stream.on('end', () => {
      expect(() => JSON.parse(output)).to.not.throw();
      const expectedOutput = JSON.stringify(resultsWithTests);
      expect(output).to.equal(expectedOutput);
      done();
    });

    stream._read();
  });
  it('should transform TestResult into a JSON string with tests and coverage both present', (done) => {
    let output = '';
    const testsWithCoverage = structuredClone(tests);
    testsWithCoverage[0].perClassCoverage = [perClassCoverageData[0]];
    testsWithCoverage[1].perClassCoverage = perClassCoverageData;
    const resultsWithTests = {
      ...testResult,
      tests: testsWithCoverage,
      codecoverage: coverageData
    };
    // Initialize the stream with the testResult
    stream = new TestResultStringifyStream(resultsWithTests);

    stream.on('data', (chunk: string) => {
      output += chunk;
    });

    stream.on('end', () => {
      expect(() => JSON.parse(output)).to.not.throw();
      const expectedOutput = JSON.stringify(resultsWithTests);
      expect(output).to.equal(expectedOutput);
      done();
    });

    stream._read();
  });
});
