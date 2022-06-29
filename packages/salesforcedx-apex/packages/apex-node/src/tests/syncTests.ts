/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { CancellationToken } from '../common';
import { formatStartTime, getCurrentTime } from '../utils';
import { CodeCoverage } from './codeCoverage';
import { formatTestErrors, getSyncDiagnostic } from './diagnosticUtil';
import {
  ApexTestResultData,
  ApexTestResultOutcome,
  ApexTestRunResultStatus,
  SyncTestConfiguration,
  SyncTestResult,
  TestResult
} from './types';
import { calculatePercentage } from './utils';
import { HttpRequest } from 'jsforce';

export class SyncTests {
  public readonly connection: Connection;
  private readonly codecoverage: CodeCoverage;

  constructor(connection: Connection) {
    this.connection = connection;
    this.codecoverage = new CodeCoverage(this.connection);
  }

  /**
   * Synchronous Test Runs
   * @param options Synchronous Test Runs configuration
   * @param codeCoverage should report code coverage
   * @param token cancellation token
   */
  public async runTests(
    options: SyncTestConfiguration,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult> {
    try {
      const url = `${this.connection.tooling._baseUrl()}/runTestsSynchronous`;
      const request: HttpRequest = {
        method: 'POST',
        url,
        body: JSON.stringify(options),
        headers: { 'content-type': 'application/json' }
      };

      const testRun = (await this.connection.tooling.request(
        request
      )) as SyncTestResult;

      if (token && token.isCancellationRequested) {
        return null;
      }

      return await this.formatSyncResults(
        testRun,
        getCurrentTime(),
        codeCoverage
      );
    } catch (e) {
      throw formatTestErrors(e);
    }
  }

  public async formatSyncResults(
    apiTestResult: SyncTestResult,
    startTime: number,
    codeCoverage = false
  ): Promise<TestResult> {
    const coveredApexClassIdSet = new Set<string>();
    const { apexTestClassIdSet, testResults } = this.buildSyncTestResults(
      apiTestResult
    );

    const globalTestFailed = apiTestResult.failures.length;
    const globalTestPassed = apiTestResult.successes.length;
    const result: TestResult = {
      summary: {
        outcome:
          globalTestFailed === 0
            ? ApexTestRunResultStatus.Passed
            : ApexTestRunResultStatus.Failed,
        testsRan: apiTestResult.numTestsRun,
        passing: globalTestPassed,
        failing: globalTestFailed,
        skipped: 0,
        passRate: calculatePercentage(
          globalTestPassed,
          apiTestResult.numTestsRun
        ),
        failRate: calculatePercentage(
          globalTestFailed,
          apiTestResult.numTestsRun
        ),
        skipRate: calculatePercentage(0, apiTestResult.numTestsRun),
        testStartTime: formatStartTime(startTime),
        testExecutionTimeInMs: apiTestResult.totalTime ?? 0,
        testTotalTimeInMs: apiTestResult.totalTime ?? 0,
        commandTimeInMs: getCurrentTime() - startTime,
        hostname: this.connection.instanceUrl,
        orgId: this.connection.getAuthInfoFields().orgId,
        username: this.connection.getUsername(),
        testRunId: '',
        userId: this.connection.getConnectionOptions().userId
      },
      tests: testResults
    };

    if (codeCoverage) {
      const perClassCovMap = await this.codecoverage.getPerClassCodeCoverage(
        apexTestClassIdSet
      );

      if (perClassCovMap.size > 0) {
        result.tests.forEach(item => {
          const keyCodeCov = `${item.apexClass.id}-${item.methodName}`;
          const perClassCov = perClassCovMap.get(keyCodeCov);
          if (perClassCov) {
            perClassCov.forEach(classCov =>
              coveredApexClassIdSet.add(classCov.apexClassOrTriggerId)
            );
            item.perClassCoverage = perClassCov;
          }
        });
      }

      const {
        codeCoverageResults,
        totalLines,
        coveredLines
      } = await this.codecoverage.getAggregateCodeCoverage(
        coveredApexClassIdSet
      );
      result.codecoverage = codeCoverageResults;
      result.summary.totalLines = totalLines;
      result.summary.coveredLines = coveredLines;
      result.summary.testRunCoverage = calculatePercentage(
        coveredLines,
        totalLines
      );
      result.summary.orgWideCoverage = await this.codecoverage.getOrgWideCoverage();
    }
    return result;
  }

  private buildSyncTestResults(
    apiTestResult: SyncTestResult
  ): {
    apexTestClassIdSet: Set<string>;
    testResults: ApexTestResultData[];
  } {
    const testResults: ApexTestResultData[] = [];
    const apexTestClassIdSet = new Set<string>();

    apiTestResult.successes.forEach(item => {
      const nms = item.namespace ? `${item.namespace}__` : '';
      apexTestClassIdSet.add(item.id);
      testResults.push({
        id: '',
        queueItemId: '',
        stackTrace: '',
        message: '',
        asyncApexJobId: '',
        methodName: item.methodName,
        outcome: ApexTestResultOutcome.Pass,
        apexLogId: apiTestResult.apexLogId,
        apexClass: {
          id: item.id,
          name: item.name,
          namespacePrefix: item.namespace,
          fullName: `${nms}${item.name}`
        },
        runTime: item.time ?? 0,
        testTimestamp: '',
        fullName: `${nms}${item.name}.${item.methodName}`
      });
    });

    apiTestResult.failures.forEach(item => {
      const nms = item.namespace ? `${item.namespace}__` : '';
      apexTestClassIdSet.add(item.id);
      const diagnostic =
        item.message || item.stackTrace ? getSyncDiagnostic(item) : null;

      testResults.push({
        id: '',
        queueItemId: '',
        stackTrace: item.stackTrace,
        message: item.message,
        asyncApexJobId: '',
        methodName: item.methodName,
        outcome: ApexTestResultOutcome.Fail,
        apexLogId: apiTestResult.apexLogId,
        apexClass: {
          id: item.id,
          name: item.name,
          namespacePrefix: item.namespace,
          fullName: `${nms}${item.name}`
        },
        runTime: item.time ?? 0,
        testTimestamp: '',
        fullName: `${nms}${item.name}.${item.methodName}`,
        ...(diagnostic ? { diagnostic } : {})
      });
    });

    return { apexTestClassIdSet, testResults };
  }
}
