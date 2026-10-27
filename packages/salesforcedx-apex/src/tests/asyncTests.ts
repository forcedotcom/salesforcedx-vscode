/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Logger, LoggerLevel } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import * as EffectDuration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isNotNull, isNull } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { JsonStreamStringify } from 'json-stream-stringify';
import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as util from 'node:util';
import { ApexOperationError, causeMessage } from '../effect/errors';
import { nls } from '../i18n';
import { TestRunId } from '../schemas/salesforceId';
import { type AsyncTestRun } from '../streaming';
import { elapsedTime, formatStartTime, getCurrentTime, HeapMonitor } from '../utils';
import { type CancellationToken } from './cancellation';
import { CodeCoverage } from './codeCoverage';
import { QUERY_RECORD_LIMIT } from './constants';
import { formatTestErrors, getDiagnostic } from './diagnosticUtil';
import {
  type ApexTestProgressReporter,
  type ApexTestQueueItem,
  type ApexTestQueueItemRecord,
  type ApexTestResult,
  type ApexTestResultDataRaw,
  type ApexTestRunResult,
  type ApexTestRunResultStatus,
  type AsyncTestArrayConfiguration,
  type AsyncTestConfiguration,
  type TestResult,
  type TestResultRaw,
  type TestRunIdResult,
  type FlowTestResult,
  type ApexTestResultRecord
} from './types';
import { calculatePercentage, transformTestResult, queryAll, calculateCodeCoverage } from './utils';

/**
 * Standalone function for writing async test results to file - easier to test
 */
export const writeAsyncResultsToFile = async (formattedResults: TestResult, runId: string): Promise<void> => {
  const rawResultsPath = path.join(os.tmpdir(), runId, 'rawResults.json');
  await fs.mkdir(path.dirname(rawResultsPath), { recursive: true });
  const writeStream = createWriteStream(path.join(os.tmpdir(), runId, 'rawResults.json'));
  const stringifyStream = new JsonStreamStringify(formattedResults);
  return await pipeline(stringifyStream, writeStream);
};

const finishedStatuses = new Set<ApexTestRunResultStatus>(['Aborted', 'Failed', 'Completed', 'Passed', 'Skipped']);

const MIN_VERSION_TO_SUPPORT_TEST_SETUP_METHODS = 61.0;
const POLLING_FREQUENCY = Duration.seconds(1);
const POLLING_TIMEOUT = Duration.hours(4);

type PollingResult<A> = {
  completed: boolean;
  payload: A;
};

const pollUntilComplete = Effect.fn('AsyncTests.pollUntilComplete')(function* <A>(
  poll: () => Promise<PollingResult<A>>,
  interval: Duration,
  timeout: Duration,
  operation: string
) {
  const pollResult = Effect.tryPromise({
    try: poll,
    catch: cause =>
      new ApexOperationError({
        operation,
        message: causeMessage(cause),
        cause: causeMessage(cause)
      })
  });

  return yield* Stream.repeatEffectWithSchedule(
    pollResult,
    Schedule.spaced(EffectDuration.millis(interval.milliseconds))
  ).pipe(
    Stream.takeUntil(result => result.completed),
    Stream.runLast,
    Effect.timeoutOption(EffectDuration.millis(timeout.milliseconds)),
    Effect.map(result => Option.map(Option.flatten(result), ({ payload }) => payload))
  );
});

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
   * @param timeout Duration to wait before returning a TestRunIdResult. If polling times out,
   * the method will return the test run ID so you can retrieve results later.
   */
  @elapsedTime()
  public async runTests(
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration,
    codeCoverage = false,
    exitOnTestRunId = false,
    progress?: ApexTestProgressReporter,
    token?: CancellationToken,
    timeout?: Duration,
    interval: Duration = POLLING_FREQUENCY
  ): Promise<TestResult | TestRunIdResult> {
    HeapMonitor.getInstance().checkHeapSize('asyncTests.runTests');
    let testRunId = '';

    try {
      testRunId = await this.getTestRunRequestAction(options)();

      if (exitOnTestRunId) {
        return { testRunId };
      }

      if (token?.isCancellationRequested) {
        throw new Error(nls.localize('testRunCancelled'));
      }

      const queueItem = await Effect.runPromise(
        pollUntilComplete(
          async (): Promise<PollingResult<ApexTestQueueItem>> => {
            if (token?.isCancellationRequested) {
              await this.abortTestRun(testRunId, progress);
              return {
                completed: true,
                payload: {
                  done: true,
                  totalSize: 0,
                  records: []
                }
              };
            }

            const hasTestSetupTimeField = await this.supportsTestSetupFeature();
            const testRunSummaryQuery = `SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, MethodsEnqueued, StartTime, EndTime, TestTime${hasTestSetupTimeField ? ', TestSetupTime' : ''}, UserId FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;

            // Query for test run summary first to check overall status
            const testRunSummary = await this.connection.tooling.query<ApexTestRunResult>(testRunSummaryQuery);

            if (!testRunSummary?.records || testRunSummary.records.length === 0) {
              throw new Error(`No test run summary found for test run ID: ${testRunId}`);
            }

            const summary = testRunSummary.records[0];
            const isCompleted = finishedStatuses.has(summary.Status);

            progress?.report({
              type: 'PollingClientProgress',
              value: 'pollingProcessingTestRun',
              message: nls.localize('pollingProcessingTestRun', testRunId),
              testRunId,
              classesCompleted: summary.ClassesCompleted,
              classesEnqueued: summary.ClassesEnqueued
            });

            // Query queue items to get detailed status (use queryAll to fetch all pages)
            const queryResult = await queryAll<ApexTestQueueItemRecord>(
              this.connection,
              `SELECT Id, Status, ApexClassId, TestRunResultId, ParentJobId FROM ApexTestQueueItem WHERE ParentJobId = '${testRunId}'`,
              true
            );

            if (!queryResult.records || queryResult.records.length === 0) {
              throw new Error(`No test queue items found for test run ID: ${testRunId}`);
            }

            const queueItem: ApexTestQueueItem = {
              done: isCompleted,
              totalSize: queryResult.records.length,
              records: queryResult.records.map(record => ({
                Id: record.Id,
                Status: record.Status,
                ApexClassId: record.ApexClassId,
                TestRunResultId: record.TestRunResultId
              }))
            };

            return {
              completed: isCompleted,
              payload: queueItem
            };
          },
          interval,
          timeout ?? POLLING_TIMEOUT,
          'AsyncTests.runTests'
        )
      );

      return await Option.match(queueItem, {
        onNone: async () => {
          this.logger.debug(
            `Polling timed out for test run ${testRunId}. Returning test run ID for later result retrieval.`
          );

          const username = this.connection.getUsername() ?? '';
          this.logger.info(nls.localize('runTestReportCommand', [testRunId, username]));

          return { testRunId };
        },
        onSome: async queueItem => {
          const runResult = await this.checkRunStatus(testRunId, progress);
          const formattedResults = await this.formatAsyncResults(
            { runId: testRunId, queueItem },
            getCurrentTime(),
            codeCoverage,
            runResult.testRunSummary,
            progress
          );

          await this.writeResultsToFile(formattedResults, testRunId);
          return formattedResults;
        }
      });
    } catch (e) {
      throw formatTestErrors(e);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('asyncTests.runTests');
    }
  }

  private async writeResultsToFile(formattedResults: TestResult, runId: string): Promise<void> {
    HeapMonitor.getInstance().checkHeapSize('asyncTests.writeResultsToFile');
    try {
      if (this.logger.shouldLog(LoggerLevel.DEBUG)) {
        await writeAsyncResultsToFile(formattedResults, runId);
        this.logger.debug(`Raw results written to: ${path.join(os.tmpdir(), runId, 'rawResults.json')}`);
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
      const runResult = await Option.match(
        await Effect.runPromise(
          pollUntilComplete(
            async () => {
              const runResult = await this.checkRunStatus(testRunId);
              return {
                completed: runResult.testsComplete || Boolean(token?.isCancellationRequested),
                payload: runResult
              };
            },
            POLLING_FREQUENCY,
            POLLING_TIMEOUT,
            'AsyncTests.reportAsyncResults'
          )
        ),
        {
          onNone: () => {
            throw new ApexOperationError({
              operation: 'AsyncTests.reportAsyncResults',
              message: 'Timed out while waiting for the asynchronous test run to complete'
            });
          },
          onSome: runResult => runResult
        }
      );

      if (token?.isCancellationRequested) {
        throw new Error(nls.localize('testRunCancelled'));
      }

      const queryResult = await queryAll<ApexTestQueueItemRecord>(
        this.connection,
        `SELECT Id, Status, ApexClassId, TestRunResultId FROM ApexTestQueueItem WHERE ParentJobId = '${testRunId}'`,
        true
      );
      if (queryResult.records.length === 0) {
        throw new Error(`No test queue items found for test run ID: ${testRunId}`);
      }
      const queueItem: ApexTestQueueItem = {
        done: true,
        totalSize: queryResult.records.length,
        records: queryResult.records.map(({ Id, Status, ApexClassId, TestRunResultId }) => ({
          Id,
          Status,
          ApexClassId,
          TestRunResultId
        }))
      };

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
    progress?: ApexTestProgressReporter
  ): Promise<{
    testsComplete: boolean;
    testRunSummary: ApexTestRunResult;
  }> {
    const isValidTestRunId = Schema.is(TestRunId)(testRunId);
    if (!isValidTestRunId) {
      throw new Error(nls.localize('invalidTestRunIdErr', testRunId));
    }
    const hasTestSetupTimeField = await this.supportsTestSetupFeature();

    const fields = [
      'AsyncApexJobId',
      'Status',
      'ClassesCompleted',
      'ClassesEnqueued',
      'MethodsEnqueued',
      'StartTime',
      'EndTime',
      'TestTime',
      ...(hasTestSetupTimeField ? ['TestSetupTime'] : []),
      'UserId'
    ];
    const testRunSummaryQuery = `SELECT ${fields.join(', ')} FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;

    progress?.report({
      type: 'FormatTestResultProgress',
      value: 'retrievingTestRunSummary',
      message: nls.localize('retrievingTestRunSummary')
    });

    try {
      const connection = await this.defineApiVersion();
      const testRunSummaryResults = await connection.tooling.query<ApexTestRunResult>(testRunSummaryQuery);

      if (!testRunSummaryResults?.records) {
        // If test run was aborted, return a dummy summary
        if (progress?.report) {
          return {
            testsComplete: true,
            testRunSummary: {
              AsyncApexJobId: testRunId as string,
              Status: 'Aborted',
              StartTime: new Date().toISOString(),
              TestTime: 0,
              UserId: ''
            } as ApexTestRunResult
          };
        }
        throw new Error(
          `No test run summary found for test run ID: ${testRunId}. The test run may have been deleted or expired.`
        );
      }

      if (testRunSummaryResults.records.length > 1) {
        throw new Error(
          `Multiple test run summaries found for test run ID: ${testRunId}. This is unexpected and may indicate a data integrity issue.`
        );
      }

      return {
        testsComplete: finishedStatuses.has(testRunSummaryResults.records[0].Status),
        testRunSummary: testRunSummaryResults.records[0]
      };
    } catch (e) {
      if (e.message.includes('The requested resource does not exist')) {
        throw new Error(
          `Test run with ID ${testRunId} does not exist. The test run may have been deleted, expired, or never created successfully.`
        );
      }
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
    progress?: ApexTestProgressReporter
  ): Promise<TestResult> {
    HeapMonitor.getInstance().checkHeapSize('asyncTests.formatAsyncResults');
    try {
      const apexTestResults = await this.getAsyncTestResults(asyncRunResult.queueItem);
      const { apexTestClassIdSet, testResults, globalTests } = await this.buildAsyncTestResults(apexTestResults);

      let outcome = testRunSummary.Status;
      if (globalTests.failed > 0) {
        outcome = 'Failed';
      } else if (globalTests.passed === 0) {
        outcome = 'Skipped';
      } else if (testRunSummary.Status === 'Completed') {
        outcome = 'Passed';
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
          skipRate: calculatePercentage(globalTests.skipped, testResults.length),
          testStartTime: formatStartTime(testRunSummary.StartTime, 'ISO'),
          testSetupTimeInMs: testRunSummary.TestSetupTime,
          testExecutionTimeInMs: testRunSummary.TestTime ?? 0,
          testTotalTimeInMs: testRunSummary.TestTime ?? 0,
          commandTimeInMs: getCurrentTime() - commandStartTime,
          hostname: this.connection.instanceUrl,
          orgId: this.connection.getAuthInfoFields().orgId ?? '',
          username: this.connection.getUsername() ?? '',
          testRunId: asyncRunResult.runId,
          userId: testRunSummary.UserId
        },
        tests: testResults
      };

      await calculateCodeCoverage(this.codecoverage, codeCoverage, apexTestClassIdSet, rawResult, true, progress);
      return transformTestResult(rawResult);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('asyncTests.formatAsyncResults');
    }
  }

  @elapsedTime()
  public async getAsyncTestResults(testQueueResult: ApexTestQueueItem): Promise<ApexTestResult[]> {
    HeapMonitor.getInstance().checkHeapSize('asyncTests.getAsyncTestResults');
    const hasIsTestSetupField = await this.supportsTestSetupFeature();
    try {
      const { apexTestIds, flowTestIds } = this.mapTestResultsByCategory(testQueueResult.records);

      const allTestResults: ApexTestResult[] = [];
      if (apexTestIds.length > 0) {
        allTestResults.push(...(await this.getApexTestResults(apexTestIds, hasIsTestSetupField)));
      }
      if (flowTestIds.length > 0) {
        allTestResults.push(...(await this.getFlowTestResults(flowTestIds)));
      }

      return allTestResults as ApexTestResult[];
    } finally {
      HeapMonitor.getInstance().checkHeapSize('asyncTests.getAsyncTestResults');
    }
  }
  /**
   * @returns Convert FlowTest result to ApexTestResult type
   */

  private convertFlowTestResult(flowtestResults: FlowTestResult[]): ApexTestResult[] {
    return flowtestResults.map(flowtestResult => {
      const tmpRecords: ApexTestResultRecord[] = flowtestResult.records.map(record => ({
        Id: record.Id,
        QueueItemId: record.ApexTestQueueItemId,
        StackTrace: '', // Default value
        Message: '', // Default value
        AsyncApexJobId: record.ApexTestQueueItemId, // Assuming this maps from ApexTestQueueItem
        MethodName: record.FlowTest.DeveloperName,
        Outcome: record.Result,
        ApexLogId: '', // Default value
        IsTestSetup: false,
        ApexClass: {
          Id: record.ApexTestQueueItemId,
          Name: record.FlowDefinition.DeveloperName,
          NamespacePrefix: record.FlowDefinition.NamespacePrefix,
          FullName: record.FlowDefinition.NamespacePrefix
            ? `${record.FlowDefinition.NamespacePrefix}.${record.FlowTest.DeveloperName}`
            : record.FlowTest.DeveloperName
        },
        RunTime: Number.isNaN(Number(record.TestEndDateTime))
          ? 0
          : Number(record.TestEndDateTime) - Number(record.TestStartDateTime)
            ? 0
            : Number(record.TestStartDateTime), // Default value, replace with actual runtime if available
        TestTimestamp: record.TestStartDateTime
      }));

      return {
        done: flowtestResult.done,
        totalSize: tmpRecords.length,
        records: tmpRecords,
        category: 'Flow'
      };
    });
  }

  @elapsedTime()
  private async buildAsyncTestResults(apexTestResults: ApexTestResult[]): Promise<{
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
        result.records.forEach(item => {
          switch (item.Outcome) {
            case 'Pass':
              passed++;
              break;
            case 'Fail':
            case 'CompileFail':
              failed++;
              break;
            case 'Skip':
              skipped++;
              break;
          }

          apexTestClassIdSet.add(item.ApexClass.Id);
          // Can only query the FullName field if a single record is returned, so manually build the field
          item.ApexClass.FullName = item.ApexClass.NamespacePrefix
            ? `${item.ApexClass.NamespacePrefix}.${item.ApexClass.Name}`
            : item.ApexClass.Name;

          const diagnostic = item.Message || item.StackTrace ? getDiagnostic(item) : null;

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
            ...(diagnostic ? { diagnostic } : {}),
            category: result.category
          });
        });
      }

      return {
        apexTestClassIdSet,
        testResults,
        globalTests: { passed, failed, skipped }
      };
    } finally {
      HeapMonitor.getInstance().checkHeapSize('asyncTests.buildAsyncTestResults');
    }
  }

  /**
   * Abort test run with test run id
   * @param testRunId
   * @param progress
   */
  public async abortTestRun(testRunId: string, progress?: ApexTestProgressReporter): Promise<void> {
    progress?.report({
      type: 'AbortTestRunProgress',
      value: 'abortingTestRun',
      message: nls.localize('abortingTestRun', testRunId),
      testRunId
    });

    const testQueueItems = await this.connection.tooling.query<ApexTestQueueItemRecord>(
      `SELECT Id, Status FROM ApexTestQueueItem WHERE ParentJobId = '${testRunId}'`
    );

    for (const record of testQueueItems.records) {
      record.Status = 'Aborted';
    }
    await this.connection.tooling.update('ApexTestQueueItem', testQueueItems.records);

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

      return this.connection.tooling.request<string>({
        method: 'POST',
        url,
        body: JSON.stringify(options),
        headers: { 'content-type': 'application/json' }
      });
    };
  }

  /**
   * @returns A boolean indicating if the org's api version supports the test setup feature.
   */
  public async supportsTestSetupFeature(): Promise<boolean> {
    try {
      return parseFloat(await this.connection.retrieveMaxApiVersion()) >= MIN_VERSION_TO_SUPPORT_TEST_SETUP_METHODS;
    } catch {
      throw new Error('Error retrieving max api version');
    }
  }

  /**
   * @returns A boolean indicating if this is running FlowTest.
   */
  public async isJobIdForFlowTestRun(testRunId: string): Promise<boolean> {
    try {
      const testRunApexIdResults = await this.connection.tooling.query<ApexTestQueueItemRecord>(
        `SELECT ApexClassId FROM ApexTestQueueItem WHERE Id = '${testRunId}'`
      );
      return testRunApexIdResults.records.some(record => isNull(record.ApexClassId));
    } catch {
      return false;
    }
  }

  /**
   * @returns A connection based on the current api version and the max api version.
   */
  public async defineApiVersion(): Promise<Connection> {
    const maxApiVersion = await this.connection.retrieveMaxApiVersion();

    if (
      parseFloat(this.connection.getApiVersion()) < MIN_VERSION_TO_SUPPORT_TEST_SETUP_METHODS &&
      (await this.supportsTestSetupFeature())
    ) {
      return await this.cloneConnectionWithNewVersion(maxApiVersion);
    }
    return this.connection;
  }

  /**
   * @returns A new connection similar to the current one but with a new api version.
   */
  public async cloneConnectionWithNewVersion(newVersion: string): Promise<Connection> {
    try {
      const authInfo = await AuthInfo.create({
        username: this.connection.getUsername()
      });
      const newConn = await Connection.create({
        authInfo,
        connectionOptions: {
          ...this.connection.getConnectionOptions(),
          version: newVersion
        }
      });
      return newConn;
    } catch (e) {
      throw new Error(`Error creating new connection with API version ${newVersion}: ${e.message}`);
    }
  }

  /**
   * Maps test results by category (Apex vs Flow tests)
   */
  public mapTestResultsByCategory(records: ApexTestQueueItemRecord[]): {
    apexTestIds: string[];
    flowTestIds: string[];
  } {
    if (!records?.length) {
      return { apexTestIds: [], flowTestIds: [] };
    }
    return {
      apexTestIds: records.filter(r => isNotNull(r.ApexClassId)).map(r => r.Id),
      flowTestIds: records.filter(r => isNull(r.ApexClassId)).map(r => r.Id)
    };
  }

  public async getFlowTestResults(recordIds: string[]): Promise<ApexTestResult[]> {
    const queryTemplate =
      'SELECT Id, ApexTestQueueItemId, Result, TestStartDateTime,TestEndDateTime, FlowTest.DeveloperName, FlowDefinition.DeveloperName, FlowDefinition.NamespacePrefix FROM FlowTestResult WHERE ApexTestQueueItemId IN (%s)';
    const queries = this.buildChunkedQueries(queryTemplate, recordIds);

    const connection = await this.defineApiVersion();
    const queryPromises = queries.map(async query => queryAll(connection, query, true));

    const testResults = await Promise.all(queryPromises);
    return this.convertFlowTestResult(testResults as FlowTestResult[]);
  }

  public async getApexTestResults(recordIds: string[], isTestSetup: boolean): Promise<ApexTestResult[]> {
    const queryTemplate = isTestSetup
      ? 'SELECT Id, QueueItemId, StackTrace, Message, RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, IsTestSetup, ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix FROM ApexTestResult WHERE QueueItemId IN (%s)'
      : 'SELECT Id, QueueItemId, StackTrace, Message, RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix FROM ApexTestResult WHERE QueueItemId IN (%s)';
    const queries = this.buildChunkedQueries(queryTemplate, recordIds);

    const connection = await this.defineApiVersion();
    const queryPromises = queries.map(async query => queryAll(connection, query, true));

    const testResults = await Promise.all(queryPromises);
    return testResults.map(
      result =>
        ({
          ...result,
          category: 'Apex'
        }) as ApexTestResult
    );
  }

  /**
   * Splits record IDs into multiple queries to respect Salesforce query limits
   * @param queryTemplate SOQL query template with %s placeholder for IDs
   * @param recordIds Array of record IDs to include in queries
   * @returns Array of complete SOQL queries ready to execute
   */
  public buildChunkedQueries(queryTemplate: string, recordIds: string[]): string[] {
    if (!queryTemplate?.includes('%s')) {
      throw new Error('Query template must contain %s placeholder for record IDs');
    }

    if (!recordIds?.length) {
      return [];
    }

    const queries: string[] = [];

    for (let i = 0; i < recordIds.length; i += QUERY_RECORD_LIMIT) {
      const chunk = recordIds.slice(i, i + QUERY_RECORD_LIMIT);
      const quotedIds = chunk.map(id => `'${id}'`).join(',');
      const query = util.format(queryTemplate, quotedIds);
      queries.push(query);
    }

    return queries;
  }
}
