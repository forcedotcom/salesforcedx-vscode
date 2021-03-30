/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import {
  SyncTestConfiguration,
  SyncTestResult,
  AsyncTestConfiguration,
  AsyncTestArrayConfiguration,
  ApexTestProgressValue,
  ApexTestRunResult,
  ApexTestResult,
  ApexTestQueueItem,
  ApexTestQueueItemRecord,
  ApexTestQueueItemStatus,
  ApexTestResultData,
  ApexTestResultOutcome,
  ApexTestRunResultStatus,
  TestResult,
  OutputDirConfig,
  TestItem,
  TestLevel,
  ResultFormat,
  NamespaceInfo
} from './types';
import * as util from 'util';
import { join } from 'path';
import { CancellationToken, Progress } from '../common';
import { nls } from '../i18n';
import { StreamingClient } from '../streaming';
import { JUnitReporter, TapReporter } from '../reporters';
import {
  formatTestErrors,
  getAsyncDiagnostic,
  getSyncDiagnostic
} from './diagnosticUtil';
import {
  addIdToQuery,
  calculatePercentage,
  isValidApexClassID,
  isValidTestRunID,
  queryNamespaces,
  stringify
} from './utils';
import { formatStartTime, getCurrentTime } from '../utils';
import { createFiles } from '../utils/fileSystemHandler';
import { CodeCoverage } from './codeCoverage';
import { QUERY_CHAR_LIMIT } from './constants';

export class TestService {
  public readonly connection: Connection;
  private readonly codecoverage: CodeCoverage;

  constructor(connection: Connection) {
    this.connection = connection;
    this.codecoverage = new CodeCoverage(this.connection);
  }

  // utils to build test run payloads that may contain namespaces
  public async buildSyncPayload(
    testLevel: TestLevel,
    tests?: string,
    classnames?: string
  ): Promise<SyncTestConfiguration> {
    try {
      if (tests) {
        const payload = await this.buildTestPayload(tests);
        const classes = payload.tests?.map(testItem => {
          if (testItem.className) {
            return testItem.className;
          }
        });
        if (new Set(classes).size !== 1) {
          throw new Error(nls.localize('syncClassErr'));
        }
        return payload;
      } else if (classnames) {
        const prop = isValidApexClassID(classnames) ? 'classId' : 'className';
        return {
          tests: [{ [prop]: classnames }],
          testLevel
        };
      }
      throw new Error(nls.localize('payloadErr'));
    } catch (e) {
      throw formatTestErrors(e);
    }
  }

  public async buildAsyncPayload(
    testLevel: TestLevel,
    tests?: string,
    classNames?: string,
    suiteNames?: string
  ): Promise<AsyncTestConfiguration | AsyncTestArrayConfiguration> {
    try {
      if (tests) {
        return (await this.buildTestPayload(
          tests
        )) as AsyncTestArrayConfiguration;
      } else if (classNames) {
        return await this.buildAsyncClassPayload(classNames);
      } else {
        return {
          suiteNames,
          testLevel
        };
      }
    } catch (e) {
      throw formatTestErrors(e);
    }
  }

  private async buildTestPayload(
    testNames: string
  ): Promise<AsyncTestArrayConfiguration | SyncTestConfiguration> {
    const testNameArray = testNames.split(',');
    const testItems: TestItem[] = [];
    let namespaceInfos: NamespaceInfo[];

    for (const test of testNameArray) {
      if (test.indexOf('.') > 0) {
        const testParts = test.split('.');
        if (testParts.length === 3) {
          testItems.push({
            namespace: `${testParts[0]}`,
            className: `${testParts[1]}`,
            testMethods: [testParts[2]]
          });
        } else {
          if (typeof namespaceInfos === 'undefined') {
            namespaceInfos = await queryNamespaces(this.connection);
          }
          const currentNamespace = namespaceInfos.find(
            namespaceInfo => namespaceInfo.namespace === testParts[0]
          );

          // NOTE: Installed packages require the namespace to be specified as part of the className field
          // The namespace field should not be used with subscriber orgs
          if (currentNamespace) {
            if (currentNamespace.installedNs) {
              testItems.push({
                className: `${testParts[0]}.${testParts[1]}`
              });
            } else {
              testItems.push({
                namespace: `${testParts[0]}`,
                className: `${testParts[1]}`
              });
            }
          } else {
            testItems.push({
              className: testParts[0],
              testMethods: [testParts[1]]
            });
          }
        }
      } else {
        const prop = isValidApexClassID(test) ? 'classId' : 'className';
        testItems.push({ [prop]: test });
      }
    }

    return {
      tests: testItems,
      testLevel: TestLevel.RunSpecifiedTests
    };
  }

  private async buildAsyncClassPayload(
    classNames: string
  ): Promise<AsyncTestArrayConfiguration> {
    const classNameArray = classNames.split(',') as string[];
    const classItems = classNameArray.map(item => {
      const classParts = item.split('.');
      if (classParts.length > 1) {
        return {
          className: `${classParts[0]}.${classParts[1]}`
        };
      }
      const prop = isValidApexClassID(item) ? 'classId' : 'className';
      return { [prop]: item } as TestItem;
    });
    return { tests: classItems, testLevel: TestLevel.RunSpecifiedTests };
  }

  /**
   * Synchronous Test Runs
   * @param options Synchronous Test Runs configuration
   * @param codeCoverage should report code coverage
   * @param token cancellation token
   */
  public async runTestSynchronous(
    options: SyncTestConfiguration,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult> {
    try {
      const url = `${this.connection.tooling._baseUrl()}/runTestsSynchronous`;
      const request = {
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

      result.tests.forEach(item => {
        const keyCodeCov = `${item.apexClass.id}-${item.methodName}`;
        const perClassCov = perClassCovMap.get(keyCodeCov);
        perClassCov.forEach(classCov =>
          coveredApexClassIdSet.add(classCov.apexClassOrTriggerId)
        );
        item.perClassCoverage = perClassCov;
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

  /**
   * Asynchronous Test Runs
   * @param options test options
   * @param codeCoverage should report code coverage
   * @param progress progress reporter
   * @param token cancellation token
   */
  public async runTestAsynchronous(
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration,
    codeCoverage = false,
    progress?: Progress<ApexTestProgressValue>,
    token?: CancellationToken
  ): Promise<TestResult> {
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

      const asyncRunResult = await sClient.subscribe(
        this.getTestRunRequestAction(options)
      );

      if (token && token.isCancellationRequested) {
        return null;
      }

      return await this.formatAsyncResults(
        asyncRunResult.queueItem,
        asyncRunResult.runId,
        getCurrentTime(),
        codeCoverage,
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
    const sClient = new StreamingClient(this.connection);
    const queueResult = await sClient.handler(undefined, testRunId);

    token &&
      token.onCancellationRequested(async () => {
        sClient.disconnect();
      });

    if (token && token.isCancellationRequested) {
      return null;
    }

    return await this.formatAsyncResults(
      queueResult,
      testRunId,
      getCurrentTime(),
      codeCoverage
    );
  }

  public async formatAsyncResults(
    testQueueResult: ApexTestQueueItem,
    testRunId: string,
    commandStartTime: number,
    codeCoverage = false,
    progress?: Progress<ApexTestProgressValue>
  ): Promise<TestResult> {
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

    const testRunSummaryResults = (await this.connection.tooling.query(
      testRunSummaryQuery
    )) as ApexTestRunResult;

    if (testRunSummaryResults.records.length === 0) {
      throw new Error(nls.localize('noTestResultSummary', testRunId));
    }

    const summaryRecord = testRunSummaryResults.records[0];
    const coveredApexClassIdSet = new Set<string>();
    const apexTestResults = await this.getAsyncTestResults(testQueueResult);
    const {
      apexTestClassIdSet,
      testResults,
      globalTests
    } = await this.buildAsyncTestResults(apexTestResults);

    let outcome = summaryRecord.Status;
    if (globalTests.failed > 0) {
      outcome = ApexTestRunResultStatus.Failed;
    } else if (globalTests.passed === 0) {
      outcome = ApexTestRunResultStatus.Skipped;
    } else if (summaryRecord.Status === ApexTestRunResultStatus.Completed) {
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
        testStartTime: formatStartTime(summaryRecord.StartTime),
        testExecutionTimeInMs: summaryRecord.TestTime ?? 0,
        testTotalTimeInMs: summaryRecord.TestTime ?? 0,
        commandTimeInMs: getCurrentTime() - commandStartTime,
        hostname: this.connection.instanceUrl,
        orgId: this.connection.getAuthInfoFields().orgId,
        username: this.connection.getUsername(),
        testRunId,
        userId: summaryRecord.UserId
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
      return this.connection.tooling.query(query) as Promise<ApexTestResult>;
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

  public async writeResultFiles(
    result: TestResult,
    outputDirConfig: OutputDirConfig,
    codeCoverage = false
  ): Promise<string[]> {
    const { dirPath, resultFormats, fileInfos } = outputDirConfig;
    const fileMap: { path: string; content: string }[] = [];

    fileMap.push({
      path: join(dirPath, 'test-run-id.txt'),
      content: result.summary.testRunId
    });

    if (resultFormats) {
      for (const format of resultFormats) {
        if (!(format in ResultFormat)) {
          throw new Error(nls.localize('resultFormatErr'));
        }

        switch (format) {
          case ResultFormat.json:
            fileMap.push({
              path: join(
                dirPath,
                result.summary.testRunId
                  ? `test-result-${result.summary.testRunId}.json`
                  : `test-result.json`
              ),
              content: stringify(result)
            });
            break;
          case ResultFormat.tap:
            const tapResult = new TapReporter().format(result);
            fileMap.push({
              path: join(
                dirPath,
                `test-result-${result.summary.testRunId}-tap.txt`
              ),
              content: tapResult
            });
            break;
          case ResultFormat.junit:
            const junitResult = new JUnitReporter().format(result);
            fileMap.push({
              path: join(
                dirPath,
                result.summary.testRunId
                  ? `test-result-${result.summary.testRunId}-junit.xml`
                  : `test-result-junit.xml`
              ),
              content: junitResult
            });
            break;
        }
      }
    }

    if (codeCoverage) {
      const coverageRecords = result.tests.map(record => {
        return record.perClassCoverage;
      });
      fileMap.push({
        path: join(
          dirPath,
          `test-result-${result.summary.testRunId}-codecoverage.json`
        ),
        content: stringify(coverageRecords)
      });
    }

    fileInfos?.forEach(fileInfo => {
      fileMap.push({
        path: join(dirPath, fileInfo.filename),
        content:
          typeof fileInfo.content !== 'string'
            ? stringify(fileInfo.content)
            : fileInfo.content
      });
    });

    createFiles(fileMap);
    return fileMap.map(file => {
      return file.path;
    });
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

    const testQueueItems = await this.connection.tooling.query<
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
