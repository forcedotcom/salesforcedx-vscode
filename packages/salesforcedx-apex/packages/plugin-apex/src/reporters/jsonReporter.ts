/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ApexTestResultData,
  ApexTestResultOutcome,
  TestResult
} from '@salesforce/apex-node';

export type CliJsonFormat = {
  summary: object;
  tests: CliTestResult[];
  coverage?: CliCoverageResult;
};

type CliTestResult = {
  Id: string;
  QueueItemId: string;
  StackTrace: string;
  Message: string;
  AsyncApexJobId: string;
  MethodName: string;
  Outcome: ApexTestResultOutcome;
  ApexClass: { Id: string; Name: string; NamespacePrefix: string };
  RunTime: number;
  FullName: string;
};

type ClassCoverage = {
  id: string;
  name: string;
  totalLines: number;
  lines: {};
  totalCovered: number;
  coveredPercent: number;
};

type PerTestCoverage = {
  ApexTestClass: {
    Id: string;
    Name: string;
  };
  Coverage?: { coveredLines: number[]; uncoveredLines: number[] };
  TestMethodName: string;
  NumLinesCovered: number;
  ApexClassOrTrigger: {
    Id: string;
    Name: string;
  };
  NumLinesUncovered: number;
};

type CliCoverageResult = {
  coverage: ClassCoverage[];
  records: PerTestCoverage[];
  summary: {
    totalLines: number;
    coveredLines: number;
    testRunCoverage: string;
    orgWideCoverage: string;
  };
};

const skippedProperties = ['skipRate', 'coveredLines', 'totalLines'];
const timeProperties = [
  'testExecutionTimeInMs',
  'testTotalTimeInMs',
  'commandTimeInMs'
];

export class JsonReporter {
  public format(
    result: TestResult
  ): {
    summary: object;
    tests: CliTestResult[];
    coverage?: CliCoverageResult;
  } {
    return {
      summary: this.formatSummary(result),
      tests: this.formatTestResults(result.tests),
      ...(result.codecoverage
        ? {
            coverage: this.formatCoverage(result)
          }
        : {})
    };
  }

  private formatSummary(testResult: TestResult): object {
    const summary = {};

    Object.entries(testResult.summary).forEach(([key, value]) => {
      if (skippedProperties.includes(key)) {
        return;
      }

      if (timeProperties.includes(key)) {
        key = key.replace('InMs', '');
        value = `${value} ms`;
      }

      Object.assign(summary, { [key]: value });
    });

    return summary;
  }

  private formatTestResults(
    testResults: ApexTestResultData[]
  ): CliTestResult[] {
    return testResults.map(test => {
      return {
        Id: test.id,
        QueueItemId: test.queueItemId,
        StackTrace: test.stackTrace,
        Message: test.message,
        AsyncApexJobId: test.asyncApexJobId,
        MethodName: test.methodName,
        Outcome: test.outcome,
        ApexClass: {
          Id: test.apexClass.id,
          Name: test.apexClass.name,
          NamespacePrefix: test.apexClass.namespacePrefix
        },
        RunTime: test.runTime,
        FullName: test.fullName
      };
    }) as CliTestResult[];
  }

  private formatCoverage(testResult: TestResult): CliCoverageResult {
    const formattedCov = {
      coverage: [],
      records: [],
      summary: {
        totalLines: testResult.summary.totalLines,
        coveredLines: testResult.summary.coveredLines,
        orgWideCoverage: testResult.summary.orgWideCoverage,
        testRunCoverage: testResult.summary.testRunCoverage
      }
    } as CliCoverageResult;

    if (testResult.codecoverage) {
      formattedCov.coverage = testResult.codecoverage.map(cov => {
        return {
          id: cov.apexId,
          name: cov.name,
          totalLines: cov.numLinesCovered + cov.numLinesUncovered,
          lines: { ...cov.coveredLines },
          totalCovered: cov.numLinesCovered,
          coveredPercent: parseInt(cov.percentage)
        } as ClassCoverage;
      });

      testResult.tests.forEach(test => {
        if (test.perTestCoverage) {
          formattedCov.records.push({
            ApexTestClass: { Id: test.id, Name: test.apexClass.name },
            ...(test.perTestCoverage.coverage
              ? { Coverage: test.perTestCoverage.coverage }
              : {}),
            TestMethodName: test.methodName,
            NumLinesCovered: test.perTestCoverage.numLinesCovered,
            ApexClassOrTrigger: {
              Id: test.perTestCoverage.apexClassOrTriggerId,
              Name: test.perTestCoverage.apexClassOrTriggerName
            },
            NumLinesUncovered: test.perTestCoverage.numLinesUncovered
          } as PerTestCoverage);
        }
      });
    }

    return formattedCov;
  }
}
