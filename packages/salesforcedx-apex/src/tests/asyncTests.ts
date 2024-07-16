/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Logger, LoggerLevel } from '@salesforce/core';
import { CancellationToken, Progress } from '../common';
import { nls } from '../i18n';
import { AsyncTestRun, StreamingClient } from '../streaming';
import {
  elapsedTime,
  formatStartTime,
  getCurrentTime,
  HeapMonitor
} from '../utils';
import { formatTestErrors, getAsyncDiagnostic } from './diagnosticUtil';
import {
  ApexTestProgressValue,
  ApexTestQueueItem,
  ApexTestQueueItemRecord,
  ApexTestQueueItemStatus,
  ApexTestResult,
  ApexTestResultDataRaw,
  ApexTestResultOutcome,
  ApexTestRunResult,
  ApexTestRunResultStatus,
  AsyncTestArrayConfiguration,
  AsyncTestConfiguration,
  TestResult,
  TestResultRaw,
  TestRunIdResult
} from './types';
import {
  calculatePercentage,
  getBufferSize,
  getJsonIndent,
  transformTestResult,
  queryAll,
  calculateCodeCoverage
} from './utils';
import * as util from 'util';
import { QUERY_RECORD_LIMIT } from './constants';
import { CodeCoverage } from './codeCoverage';
import { isValidTestRunID } from '../narrowing';
import { Duration } from '@salesforce/kit';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import * as os from 'node:os';
import path from 'path';
import fs from 'node:fs/promises';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bfj = require('bfj');

const finishedStatuses = [
  ApexTestRunResultStatus.Aborted,
  ApexTestRunResultStatus.Failed,
  ApexTestRunResultStatus.Completed,
  ApexTestRunResultStatus.Passed,
  ApexTestRunResultStatus.Skipped
];

const MIN_VERSION_TO_SUPPORT_TEST_SETUP_METHODS = 61.0;

export class AsyncTests {
  public readonly connection: Connection;
  private readonly codecoverage: CodeCoverage;
  private readonly logger: Logger;

  constructor(connection: Connection) {
    this.connection = connection;
    this.codecoverage = new CodeCoverage(this.connection);
    this.logger = Logger.childFromRoot('AsyncTests');
  }

  /**
   * Asynchronous Test Runs
   * @param options test options
   * @param codeCoverage should report code coverage
   * @param exitOnTestRunId should not wait for test run to complete, return test run id immediately
   * @param progress progress reporter
   * @param token cancellation token
   * @param timeout Duration to wait before returning a TestRunIdResult
   */
  @elapsedTime()
  public async runTests(
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration,
    codeCoverage = false,
    exitOnTestRunId = false,
    progress?: Progress<ApexTestProgressValue>,
    token?: CancellationToken,
    timeout?: Duration
  ): Promise<TestResult | TestRunIdResult> {
    HeapMonitor.getInstance().checkHeapSize('asyncTests.runTests');
    try {
      const sClient = new StreamingClient(this.connection, progress);
      await sClient.init();
      await sClient.handshake();

      token?.onCancellationRequested(async () => {
        const testRunId = await sClient.subscribedTestRunIdPromise;
        await this.abortTestRun(testRunId, progress);
        sClient.disconnect();
      });

      const testRunId = await this.getTestRunRequestAction(options)();

      if (exitOnTestRunId) {
        return { testRunId };
      }

      if (token?.isCancellationRequested) {
        return null;
      }
      const asyncRunResult = await sClient.subscribe(
        undefined,
        testRunId,
        timeout
      );

      if ('testRunId' in asyncRunResult) {
        // timeout, return the id
        return { testRunId };
      }

      const runResult = await this.checkRunStatus(asyncRunResult.runId);
      const formattedResults = await this.formatAsyncResults(
        asyncRunResult,
        getCurrentTime(),
        codeCoverage,
        runResult.testRunSummary,
        progress
      );
      await this.writeResultsToFile(formattedResults, asyncRunResult.runId);
      return formattedResults;
    } catch (e) {
      throw formatTestErrors(e);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('asyncTests.runTests');
    }
  }

  private async writeResultsToFile(
    formattedResults: TestResult,
    runId: string
  ): Promise<void> {
    HeapMonitor.getInstance().checkHeapSize('asyncTests.writeResultsToFile');
    try {
      if (this.logger.shouldLog(LoggerLevel.DEBUG)) {
        const rawResultsPath = path.join(os.tmpdir(), runId, 'rawResults.json');
        await fs.mkdir(path.dirname(rawResultsPath), { recursive: true });
        const writeStream = createWriteStream(
          path.join(os.tmpdir(), runId, 'rawResults.json')
        );
        this.logger.debug(`Raw results written to: ${writeStream.path}`);
        const stringifyStream = bfj.stringify(formattedResults, {
          bufferLength: getBufferSize(),
          iterables: 'ignore',
          space: getJsonIndent()
        });
        return await pipeline(stringifyStream, writeStream);
      }
    } finally {
      HeapMonitor.getInstance().checkHeapSize('asyncTests.writeResultsToFile');
    }
  }

  /**
   * Report Asynchronous Test Run Results
   * @param testRunId test run id
   * @param codeCoverage should report code coverages
   * @param token cancellation token
   */
  @elapsedTime()
  public async reportAsyncResults(
    testRunId: string,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult> {
    HeapMonitor.getInstance().checkHeapSize('asyncTests.reportAsyncResults');
    try {
      const sClient = new StreamingClient(this.connection);
      await sClient.init();
      await sClient.handshake();
      let queueItem: ApexTestQueueItem;
      let runResult = await this.checkRunStatus(testRunId);

      if (runResult.testsComplete) {
        queueItem = await sClient.handler(undefined, testRunId);
      } else {
        queueItem = (
          (await sClient.subscribe(undefined, testRunId)) as AsyncTestRun
        ).queueItem;
        runResult = await this.checkRunStatus(testRunId);
      }

      token?.onCancellationRequested(async () => {
        sClient.disconnect();
      });

      if (token?.isCancellationRequested) {
        return null;
      }

      const formattedResults = await this.formatAsyncResults(
        { queueItem, runId: testRunId },
        getCurrentTime(),
        codeCoverage,
        runResult.testRunSummary
      );

      await this.writeResultsToFile(formattedResults, testRunId);

      return formattedResults;
    } catch (e) {
      throw formatTestErrors(e);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('asyncTests.reportAsyncResults');
    }
  }

  @elapsedTime()
  public async checkRunStatus(
    testRunId: string,
    progress?: Progress<ApexTestProgressValue>
  ): Promise<{
    testsComplete: boolean;
    testRunSummary: ApexTestRunResult;
  }> {
    if (!isValidTestRunID(testRunId)) {
      throw new Error(nls.localize('invalidTestRunIdErr', testRunId));
    }
    const hasTestSetupTimeField = await this.supportsTestSetupFeature();

    const testRunSummaryQuery = hasTestSetupTimeField
      ? `SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, MethodsEnqueued, StartTime, EndTime, TestTime, TestSetupTime, UserId FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`
      : `SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, MethodsEnqueued, StartTime, EndTime, TestTime, UserId FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;

    progress?.report({
      type: 'FormatTestResultProgress',
      value: 'retrievingTestRunSummary',
      message: nls.localize('retrievingTestRunSummary')
    });

    try {
      const testRunSummaryResults = await (
        await this.defineApiVersion()
      ).singleRecordQuery<ApexTestRunResult>(testRunSummaryQuery, {
        tooling: true
      });
      return {
        testsComplete: finishedStatuses.includes(testRunSummaryResults.Status),
        testRunSummary: testRunSummaryResults
      };
    } catch (e) {
      throw new Error(nls.localize('noTestResultSummary', testRunId));
    }
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
  @elapsedTime()
  public async formatAsyncResults(
    asyncRunResult: AsyncTestRun,
    commandStartTime: number,
    codeCoverage = false,
    testRunSummary: ApexTestRunResult,
    progress?: Progress<ApexTestProgressValue>
  ): Promise<TestResult> {
    HeapMonitor.getInstance().checkHeapSize('asyncTests.formatAsyncResults');
    try {
      const apexTestResults = await this.getAsyncTestResults(
        asyncRunResult.queueItem
      );
      const { apexTestClassIdSet, testResults, globalTests } =
        await this.buildAsyncTestResults(apexTestResults);

      let outcome = testRunSummary.Status;
      if (globalTests.failed > 0) {
        outcome = ApexTestRunResultStatus.Failed;
      } else if (globalTests.passed === 0) {
        outcome = ApexTestRunResultStatus.Skipped;
      } else if (testRunSummary.Status === ApexTestRunResultStatus.Completed) {
        outcome = ApexTestRunResultStatus.Passed;
      }

      const rawResult: TestResultRaw = {
        summary: {
          outcome,
          testsRan: testResults.length,
          passing: globalTests.passed,
          failing: globalTests.failed,
          skipped: globalTests.skipped,
          passRate: calculatePercentage(globalTests.passed, testResults.length),
          failRate: calculatePercentage(globalTests.failed, testResults.length),
          skipRate: calculatePercentage(
            globalTests.skipped,
            testResults.length
          ),
          testStartTime: formatStartTime(testRunSummary.StartTime, 'ISO'),
          testSetupTimeInMs: testRunSummary.TestSetupTime,
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

      await calculateCodeCoverage(
        this.codecoverage,
        codeCoverage,
        apexTestClassIdSet,
        rawResult,
        true,
        progress
      );
      return transformTestResult(rawResult);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('asyncTests.formatAsyncResults');
    }
  }

  @elapsedTime()
  public async getAsyncTestResults(
    testQueueResult: ApexTestQueueItem
  ): Promise<ApexTestResult[]> {
    HeapMonitor.getInstance().checkHeapSize('asyncTests.getAsyncTestResults');
    const hasIsTestSetupField = await this.supportsTestSetupFeature();

    try {
      const apexTestResultQuery = hasIsTestSetupField
        ? `SELECT Id, QueueItemId, StackTrace, Message, RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, IsTestSetup, ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix FROM ApexTestResult WHERE QueueItemId IN (%s)`
        : `SELECT Id, QueueItemId, StackTrace, Message, RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix FROM ApexTestResult WHERE QueueItemId IN (%s)`;

      const apexResultIds = testQueueResult.records.map((record) => record.Id);

      // iterate thru ids, create query with id, & compare query length to char limit
      const queries: string[] = [];
      for (let i = 0; i < apexResultIds.length; i += QUERY_RECORD_LIMIT) {
        const recordSet: string[] = apexResultIds
          .slice(i, i + QUERY_RECORD_LIMIT)
          .map((id) => `'${id}'`);
        const query: string = util.format(
          apexTestResultQuery,
          recordSet.join(',')
        );
        queries.push(query);
      }
      const connection = await this.defineApiVersion();
      const queryPromises = queries.map(async (query) => {
        return queryAll(connection, query, true);
      });
      const apexTestResults = await Promise.all(queryPromises);
      return apexTestResults as ApexTestResult[];
    } finally {
      HeapMonitor.getInstance().checkHeapSize('asyncTests.getAsyncTestResults');
    }
  }

  @elapsedTime()
  private async buildAsyncTestResults(
    apexTestResults: ApexTestResult[]
  ): Promise<{
    apexTestClassIdSet: Set<string>;
    testResults: ApexTestResultDataRaw[];
    globalTests: {
      passed: number;
      skipped: number;
      failed: number;
    };
  }> {
    HeapMonitor.getInstance().checkHeapSize('asyncTests.buildAsyncTestResults');
    try {
      const apexTestClassIdSet = new Set<string>();
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      // Iterate over test results, format and add them as results.tests
      const testResults: ApexTestResultDataRaw[] = [];
      for (const result of apexTestResults) {
        result.records.forEach((item) => {
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
            ? `${item.ApexClass.NamespacePrefix}.${item.ApexClass.Name}`
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
            isTestSetup: item.IsTestSetup,
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
    } finally {
      HeapMonitor.getInstance().checkHeapSize(
        'asyncTests.buildAsyncTestResults'
      );
    }
  }

  /**
   * Abort test run with test run id
   * @param testRunId
   * @param progress
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

    const testQueueItems =
      await this.connection.tooling.query<ApexTestQueueItemRecord>(
        `SELECT Id, Status FROM ApexTestQueueItem WHERE ParentJobId = '${testRunId}'`
      );

    for (const record of testQueueItems.records) {
      record.Status = ApexTestQueueItemStatus.Aborted;
    }
    await this.connection.tooling.update(
      'ApexTestQueueItem',
      testQueueItems.records
    );

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
    return async (): Promise<string> => {
      const url = `${this.connection.tooling._baseUrl()}/runTestsAsynchronous`;

      try {
        const testRunId = await this.connection.tooling.request<string>({
          method: 'POST',
          url,
          body: JSON.stringify(options),
          headers: { 'content-type': 'application/json' }
        });
        return Promise.resolve(testRunId);
      } catch (e) {
        return Promise.reject(e);
      }
    };
  }

  /**
   * @returns A boolean indicating if the org's api version supports the test setup feature.
   */
  public async supportsTestSetupFeature(): Promise<boolean> {
    try {
      return (
        parseFloat(await this.connection.retrieveMaxApiVersion()) >=
        MIN_VERSION_TO_SUPPORT_TEST_SETUP_METHODS
      );
    } catch (e) {
      throw new Error(`Error retrieving max api version`);
    }
  }

  public async defineApiVersion(): Promise<Connection> {
    const maxApiVersion = await this.connection.retrieveMaxApiVersion();

    if (
      parseFloat(this.connection.getApiVersion()) <
        MIN_VERSION_TO_SUPPORT_TEST_SETUP_METHODS &&
      this.supportsTestSetupFeature()
    ) {
      return await this.cloneConnectionWithNewVersion(maxApiVersion);
    }
    return this.connection;
  }

  public async cloneConnectionWithNewVersion(
    newVersion: string
  ): Promise<Connection> {
    try {
      const authInfo = await AuthInfo.create({
        username: this.connection.getUsername()
      });
      const newConn = await Connection.create({
        authInfo: authInfo,
        connectionOptions: {
          ...this.connection.getConnectionOptions(),
          version: newVersion
        }
      });
      return newConn;
    } catch (e) {
      throw new Error(
        `Error creating new connection with API version ${newVersion}: ${e.message}`
      );
    }
  }
}
