/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { CancellationToken } from '../common';
import {
  elapsedTime,
  formatStartTime,
  getCurrentTime,
  HeapMonitor
} from '../utils';
import { CodeCoverage } from './codeCoverage';
import { formatTestErrors, getDiagnostic } from './diagnosticUtil';
import {
  ApexTestResultDataRaw,
  ApexTestResultOutcome,
  ApexTestRunResultStatus,
  SyncTestConfiguration,
  SyncTestFailure,
  SyncTestResult,
  TestResult,
  TestResultRaw
} from './types';
import {
  calculateCodeCoverage,
  calculatePercentage,
  transformTestResult
} from './utils';
import type { HttpRequest } from '@jsforce/jsforce-node';

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
  @elapsedTime()
  public async runTests(
    options: SyncTestConfiguration,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult> {
    HeapMonitor.getInstance().checkHeapSize('synctests.runTests');
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

      if (token?.isCancellationRequested) {
        return null;
      }

      return await this.formatSyncResults(
        testRun,
        getCurrentTime(),
        codeCoverage
      );
    } catch (e) {
      throw formatTestErrors(e);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('synctests.runTests');
    }
  }

  @elapsedTime()
  public async formatSyncResults(
    apiTestResult: SyncTestResult,
    startTime: number,
    codeCoverage = false
  ): Promise<TestResult> {
    HeapMonitor.getInstance().checkHeapSize('synctests.formatSyncResults');
    const { apexTestClassIdSet, testResults } =
      this.buildSyncTestResults(apiTestResult);
    try {
      const globalTestFailed = apiTestResult.failures.length;
      const globalTestPassed = apiTestResult.successes.length;
      const rawResult: TestResultRaw = {
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
          testStartTime: formatStartTime(startTime, 'ISO'),
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

      await calculateCodeCoverage(
        this.codecoverage,
        codeCoverage,
        apexTestClassIdSet,
        rawResult,
        false
      );
      return transformTestResult(rawResult);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('synctests.formatSyncResults');
    }
  }

  @elapsedTime()
  private buildSyncTestResults(apiTestResult: SyncTestResult): {
    apexTestClassIdSet: Set<string>;
    testResults: ApexTestResultDataRaw[];
  } {
    HeapMonitor.getInstance().checkHeapSize('syncTests.buildSyncTestResults');
    try {
      const apexTestClassIdSet = new Set<string>();
      const testResults: ApexTestResultDataRaw[] = [];

      apiTestResult.successes.forEach((item) => {
        testResults.push(
          this.processTestResult(
            item,
            apiTestResult,
            apexTestClassIdSet,
            ApexTestResultOutcome.Pass
          )
        );
      });

      apiTestResult.failures.forEach((item) => {
        testResults.push(
          this.processTestResult(
            item,
            apiTestResult,
            apexTestClassIdSet,
            ApexTestResultOutcome.Fail
          )
        );
      });

      return { apexTestClassIdSet, testResults };
    } finally {
      HeapMonitor.getInstance().checkHeapSize('syncTests.buildSyncTestResults');
    }
  }

  private processTestResult(
    item: {
      id: string;
      methodName: string;
      name: string;
      namespace: string;
      stackTrace?: string;
      message?: string;
      time?: number;
    },
    apiTestResult: SyncTestResult,
    apexTestClassIdSet: Set<string>,
    outcome: ApexTestResultOutcome
  ): ApexTestResultDataRaw {
    const nms = item.namespace
      ? outcome === 'Fail'
        ? `${item.namespace}__`
        : `${item.namespace}.`
      : '';
    apexTestClassIdSet.add(item.id);

    const testResult: ApexTestResultDataRaw = {
      id: '',
      queueItemId: '',
      stackTrace: item.stackTrace || '',
      message: item.message || '',
      asyncApexJobId: '',
      methodName: item.methodName,
      outcome: outcome,
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
    };

    if (outcome === ApexTestResultOutcome.Fail) {
      const diagnostic =
        item.message || item.stackTrace
          ? getDiagnostic(item as SyncTestFailure)
          : null;
      if (diagnostic) {
        testResult.diagnostic = diagnostic;
      }
    }
    return testResult;
  }
}
