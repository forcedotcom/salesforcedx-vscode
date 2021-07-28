/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { CancellationToken, Progress } from '../common';
import { nls } from '../i18n';
import { AsyncTestRun, StreamingClient } from '../streaming';
import { formatStartTime, getCurrentTime } from '../utils';
import { formatTestErrors, getAsyncDiagnostic } from './diagnosticUtil';
import {
  ApexTestProgressValue,
  ApexTestQueueItem,
  ApexTestQueueItemRecord,
  ApexTestQueueItemStatus,
  ApexTestResult,
  ApexTestResultData,
  ApexTestResultOutcome,
  ApexTestRunResult,
  ApexTestRunResultRecord,
  ApexTestRunResultStatus,
  AsyncTestArrayConfiguration,
  AsyncTestConfiguration,
  TestResult,
  TestRunIdResult
} from './types';
import { addIdToQuery, calculatePercentage, isValidTestRunID } from './utils';
import * as util from 'util';
import { QUERY_CHAR_LIMIT } from './constants';
import { CodeCoverage } from './codeCoverage';

export class AsyncTests {
  public readonly connection: Connection;
  private readonly codecoverage: CodeCoverage;

  constructor(connection: Connection) {
    this.connection = connection;
    this.codecoverage = new CodeCoverage(this.connection);
  }

  /**
   * Asynchronous Test Runs
   * @param options test options
   * @param codeCoverage should report code coverage
   * @param exitOnTestRunId should not wait for test run to complete, return test run id immediately
   * @param progress progress reporter
   * @param token cancellation token
   */
  public async runTests(
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration,
    codeCoverage = false,
    exitOnTestRunId = false,
    progress?: Progress<ApexTestProgressValue>,
    token?: CancellationToken
  ): Promise<TestResult | TestRunIdResult> {
    try {
      const sClient = new StreamingClient(this.connection, progress);
      await sClient.init();
      await sClient.handshake();

      token &&
        token.onCancellationRequested(async () => {
          const testRunId = await sClient.subscribedTestRunIdPromise;
          await this.abortTestRun(testRunId, progress);
          sClient.disconnect();
        });

      const testRunId = await this.getTestRunRequestAction(options)();

      if (exitOnTestRunId) {
        return { testRunId };
      }

      if (token && token.isCancellationRequested) {
        return null;
      }

      const asyncRunResult = await sClient.subscribe(undefined, testRunId);
      const testRunSummary = await this.checkRunStatus(asyncRunResult.runId);
      return await this.formatAsyncResults(
        asyncRunResult,
        getCurrentTime(),
        codeCoverage,
        testRunSummary,
        progress
      );
    } catch (e) {
      throw formatTestErrors(e);
    }
  }

  /**
   * Report Asynchronous Test Run Results
   * @param testRunId test run id
   * @param codeCoverage should report code coverages
   * @param token cancellation token
   */
  public async reportAsyncResults(
    testRunId: string,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult> {
    try {
      const sClient = new StreamingClient(this.connection);
      await sClient.init();
      await sClient.handshake();
      let queueItem: ApexTestQueueItem;
      let testRunSummary = await this.checkRunStatus(testRunId);

      if (testRunSummary !== undefined) {
        queueItem = await sClient.handler(undefined, testRunId);
      } else {
        queueItem = (await sClient.subscribe(undefined, testRunId)).queueItem;
        testRunSummary = await this.checkRunStatus(testRunId);
      }

      token &&
        token.onCancellationRequested(async () => {
          sClient.disconnect();
        });

      if (token && token.isCancellationRequested) {
        return null;
      }

      return await this.formatAsyncResults(
        { queueItem, runId: testRunId },
        getCurrentTime(),
        codeCoverage,
        testRunSummary
      );
    } catch (e) {
      throw formatTestErrors(e);
    }
  }

  public async checkRunStatus(
    testRunId: string,
    progress?: Progress<ApexTestProgressValue>
  ): Promise<ApexTestRunResultRecord | undefined> {
    if (!isValidTestRunID(testRunId)) {
      throw new Error(nls.localize('invalidTestRunIdErr', testRunId));
    }

    let testRunSummaryQuery =
      'SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, ';
    testRunSummaryQuery +=
      'MethodsEnqueued, StartTime, EndTime, TestTime, UserId ';
    testRunSummaryQuery += `FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;

    progress?.report({
      type: 'FormatTestResultProgress',
      value: 'retrievingTestRunSummary',
      message: nls.localize('retrievingTestRunSummary')
    });

    const testRunSummaryResults = (await this.connection.tooling.autoFetchQuery(
      testRunSummaryQuery
    )) as ApexTestRunResult;

    if (testRunSummaryResults.records.length === 0) {
      throw new Error(nls.localize('noTestResultSummary', testRunId));
    }

    if (
      testRunSummaryResults.records[0].Status ===
        ApexTestRunResultStatus.Aborted ||
      testRunSummaryResults.records[0].Status ===
        ApexTestRunResultStatus.Failed ||
      testRunSummaryResults.records[0].Status ===
        ApexTestRunResultStatus.Completed ||
      testRunSummaryResults.records[0].Status ===
        ApexTestRunResultStatus.Passed ||
      testRunSummaryResults.records[0].Status ===
        ApexTestRunResultStatus.Skipped
    ) {
      return testRunSummaryResults.records[0];
    }

    return undefined;
  }

  /**
   * Format the results of a completed asynchronous test run
   * @param asyncRunResult TestQueueItem and RunId for an async run
   * @param commandStartTime start time for the async test run
   * @param codeCoverage should report code coverages
   * @param testRunSummary test run summary
   * @param progress progress reporter
   * @returns
   */
  public async formatAsyncResults(
    asyncRunResult: AsyncTestRun,
    commandStartTime: number,
    codeCoverage = false,
    testRunSummary: ApexTestRunResultRecord,
    progress?: Progress<ApexTestProgressValue>
  ): Promise<TestResult> {
    const coveredApexClassIdSet = new Set<string>();
    const apexTestResults = await this.getAsyncTestResults(
      asyncRunResult.queueItem
    );
    const {
      apexTestClassIdSet,
      testResults,
      globalTests
    } = await this.buildAsyncTestResults(apexTestResults);

    let outcome = testRunSummary.Status;
    if (globalTests.failed > 0) {
      outcome = ApexTestRunResultStatus.Failed;
    } else if (globalTests.passed === 0) {
      outcome = ApexTestRunResultStatus.Skipped;
    } else if (testRunSummary.Status === ApexTestRunResultStatus.Completed) {
      outcome = ApexTestRunResultStatus.Passed;
    }

    // TODO: deprecate testTotalTime
    const result: TestResult = {
      summary: {
        outcome,
        testsRan: testResults.length,
        passing: globalTests.passed,
        failing: globalTests.failed,
        skipped: globalTests.skipped,
        passRate: calculatePercentage(globalTests.passed, testResults.length),
        failRate: calculatePercentage(globalTests.failed, testResults.length),
        skipRate: calculatePercentage(globalTests.skipped, testResults.length),
        testStartTime: formatStartTime(testRunSummary.StartTime),
        testExecutionTimeInMs: testRunSummary.TestTime ?? 0,
        testTotalTimeInMs: testRunSummary.TestTime ?? 0,
        commandTimeInMs: getCurrentTime() - commandStartTime,
        hostname: this.connection.instanceUrl,
        orgId: this.connection.getAuthInfoFields().orgId,
        username: this.connection.getUsername(),
        testRunId: asyncRunResult.runId,
        userId: testRunSummary.UserId
      },
      tests: testResults
    };

    if (codeCoverage) {
      const perClassCovMap = await this.codecoverage.getPerClassCodeCoverage(
        apexTestClassIdSet
      );

      result.tests.forEach(item => {
        const keyCodeCov = `${item.apexClass.id}-${item.methodName}`;
        const perClassCov = perClassCovMap.get(keyCodeCov);
        // Skipped test is not in coverage map, check to see if perClassCov exists first
        if (perClassCov) {
          perClassCov.forEach(classCov =>
            coveredApexClassIdSet.add(classCov.apexClassOrTriggerId)
          );
          item.perClassCoverage = perClassCov;
        }
      });

      progress?.report({
        type: 'FormatTestResultProgress',
        value: 'queryingForAggregateCodeCoverage',
        message: nls.localize('queryingForAggregateCodeCoverage')
      });
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

  public async getAsyncTestResults(
    testQueueResult: ApexTestQueueItem
  ): Promise<ApexTestResult[]> {
    let apexTestResultQuery = 'SELECT Id, QueueItemId, StackTrace, Message, ';
    apexTestResultQuery +=
      'RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, ';
    apexTestResultQuery +=
      'ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix ';
    apexTestResultQuery += 'FROM ApexTestResult WHERE QueueItemId IN (%s)';

    const apexResultIds = testQueueResult.records.map(record => record.Id);
    let formattedIds = '';
    const queries = [];

    // iterate thru ids, create query with id, & compare query length to char limit
    for (const id of apexResultIds) {
      const newIds = addIdToQuery(formattedIds, id);
      const query = util.format(apexTestResultQuery, `'${newIds}'`);

      if (query.length > QUERY_CHAR_LIMIT) {
        queries.push(util.format(apexTestResultQuery, `'${formattedIds}'`));
        formattedIds = '';
      }
      formattedIds = addIdToQuery(formattedIds, id);
    }

    if (formattedIds.length > 0) {
      queries.push(util.format(apexTestResultQuery, `'${formattedIds}'`));
    }

    const queryPromises = queries.map(query => {
      return this.connection.tooling.autoFetchQuery(query) as Promise<
        ApexTestResult
      >;
    });
    const apexTestResults = await Promise.all(queryPromises);
    return apexTestResults;
  }

  private async buildAsyncTestResults(
    apexTestResults: ApexTestResult[]
  ): Promise<{
    apexTestClassIdSet: Set<string>;
    testResults: ApexTestResultData[];
    globalTests: {
      passed: number;
      skipped: number;
      failed: number;
    };
  }> {
    const apexTestClassIdSet = new Set<string>();
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Iterate over test results, format and add them as results.tests
    const testResults: ApexTestResultData[] = [];
    for (const result of apexTestResults) {
      result.records.forEach(item => {
        switch (item.Outcome) {
          case ApexTestResultOutcome.Pass:
            passed++;
            break;
          case ApexTestResultOutcome.Fail:
          case ApexTestResultOutcome.CompileFail:
            failed++;
            break;
          case ApexTestResultOutcome.Skip:
            skipped++;
            break;
        }

        apexTestClassIdSet.add(item.ApexClass.Id);
        // Can only query the FullName field if a single record is returned, so manually build the field
        item.ApexClass.FullName = item.ApexClass.NamespacePrefix
          ? `${item.ApexClass.NamespacePrefix}__${item.ApexClass.Name}`
          : item.ApexClass.Name;

        const diagnostic =
          item.Message || item.StackTrace ? getAsyncDiagnostic(item) : null;

        testResults.push({
          id: item.Id,
          queueItemId: item.QueueItemId,
          stackTrace: item.StackTrace,
          message: item.Message,
          asyncApexJobId: item.AsyncApexJobId,
          methodName: item.MethodName,
          outcome: item.Outcome,
          apexLogId: item.ApexLogId,
          apexClass: {
            id: item.ApexClass.Id,
            name: item.ApexClass.Name,
            namespacePrefix: item.ApexClass.NamespacePrefix,
            fullName: item.ApexClass.FullName
          },
          runTime: item.RunTime ?? 0,
          testTimestamp: item.TestTimestamp, // TODO: convert timestamp
          fullName: `${item.ApexClass.FullName}.${item.MethodName}`,
          ...(diagnostic ? { diagnostic } : {})
        });
      });
    }

    return {
      apexTestClassIdSet,
      testResults,
      globalTests: { passed, failed, skipped }
    };
  }

  /**
   * Abort test run with test run id
   * @param testRunId
   */
  public async abortTestRun(
    testRunId: string,
    progress?: Progress<ApexTestProgressValue>
  ): Promise<void> {
    progress?.report({
      type: 'AbortTestRunProgress',
      value: 'abortingTestRun',
      message: nls.localize('abortingTestRun', testRunId),
      testRunId
    });

    const testQueueItems = await this.connection.tooling.autoFetchQuery<
      ApexTestQueueItemRecord
    >(
      `SELECT Id, Status FROM ApexTestQueueItem WHERE ParentJobId = '${testRunId}'`
    );

    for (const record of testQueueItems.records) {
      record.Status = ApexTestQueueItemStatus.Aborted;
    }
    await this.connection.tooling.update(testQueueItems.records);

    progress?.report({
      type: 'AbortTestRunProgress',
      value: 'abortingTestRunRequested',
      message: nls.localize('abortingTestRunRequested', testRunId),
      testRunId
    });
  }

  private getTestRunRequestAction(
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration
  ): () => Promise<string> {
    const requestTestRun = async (): Promise<string> => {
      const url = `${this.connection.tooling._baseUrl()}/runTestsAsynchronous`;
      const request = {
        method: 'POST',
        url,
        body: JSON.stringify(options),
        headers: { 'content-type': 'application/json' }
      };

      try {
        const testRunId = (await this.connection.tooling.request(
          request
        )) as string;
        return Promise.resolve(testRunId);
      } catch (e) {
        return Promise.reject(e);
      }
    };
    return requestTestRun;
  }
}
