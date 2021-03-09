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
  ApexCodeCoverageAggregate,
  ApexTestResultData,
  CodeCoverageResult,
  ApexOrgWideCoverage,
  ApexTestResultOutcome,
  ApexTestRunResultStatus,
  TestResult,
  ApexCodeCoverage,
  PerClassCoverage,
  OutputDirConfig,
  ApexTestResultRecord,
  SyncTestFailure,
  TestItem,
  TestLevel,
  NamespaceQueryResult,
  ResultFormat
} from './types';
import * as util from 'util';
import { CancellationToken, Progress } from '../common';
import { nls } from '../i18n';
import { StreamingClient } from '../streaming';
import { formatStartTime, getCurrentTime } from '../utils';
import { join } from 'path';
import { JUnitReporter, TapReporter } from '../reporters';
import { createFiles } from '../utils/fileSystemHandler';
import { ApexDiagnostic } from '../utils/types';

// Tooling API query char limit is 100,000 after v48; REST API limit for uri + headers is 16,348 bytes
// local testing shows query char limit to be closer to ~12,400
const QUERY_CHAR_LIMIT = 12400;
const CLASS_ID_PREFIX = '01p';
export class TestService {
  public readonly connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // utils to build test run payloads that may contain namespaces
  public async buildSyncPayload(
    testLevel: TestLevel,
    tests?: string,
    classnames?: string
  ): Promise<SyncTestConfiguration> {
    let payload: SyncTestConfiguration;
    if (tests) {
      payload = await this.buildTestPayload(tests);
      const classes = payload.tests?.map(testItem => {
        if (testItem.className) {
          return testItem.className;
        }
      });
      if (new Set(classes).size !== 1) {
        return Promise.reject(new Error(nls.localize('syncClassErr')));
      }
    } else {
      const prop = classnames.toLowerCase().startsWith(CLASS_ID_PREFIX)
        ? 'classId'
        : 'className';
      payload = {
        tests: [{ [prop]: classnames }],
        testLevel
      };
    }
    return payload;
  }

  public async buildAsyncPayload(
    testLevel: TestLevel,
    tests?: string,
    classNames?: string,
    suiteNames?: string
  ): Promise<AsyncTestConfiguration | AsyncTestArrayConfiguration> {
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
  }

  private async buildTestPayload(
    testNames: string
  ): Promise<AsyncTestArrayConfiguration | SyncTestConfiguration> {
    const testNameArray = testNames.split(',');
    const testItems: TestItem[] = [];
    let namespaces: Set<string>;

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
          if (typeof namespaces === 'undefined') {
            namespaces = await this.queryNamespaces();
          }

          if (namespaces.has(testParts[0])) {
            testItems.push({
              namespace: `${testParts[0]}`,
              className: `${testParts[1]}`
            });
          } else {
            testItems.push({
              className: testParts[0],
              testMethods: [testParts[1]]
            });
          }
        }
      } else {
        testItems.push({ className: test });
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
          namespace: `${classParts[0]}`,
          className: `${classParts[1]}`
        };
      }
      return { className: item } as TestItem;
    });
    return { tests: classItems, testLevel: TestLevel.RunSpecifiedTests };
  }

  public async queryNamespaces(): Promise<Set<string>> {
    const installedNsQuery = 'SELECT NamespacePrefix FROM PackageLicense';
    const installedNsResult = (await this.connection.query(
      installedNsQuery
    )) as NamespaceQueryResult;
    const installedNamespaces = installedNsResult.records.map(record => {
      return record.NamespacePrefix;
    });

    const orgNsQuery = 'SELECT NamespacePrefix FROM Organization';
    const orgNsResult = (await this.connection.query(
      orgNsQuery
    )) as NamespaceQueryResult;
    const orgNamespaces = orgNsResult.records.map(record => {
      return record.NamespacePrefix;
    });

    return new Set([...orgNamespaces, ...installedNamespaces]);
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

    return this.formatSyncResults(testRun, getCurrentTime(), codeCoverage);
  }

  private async formatSyncResults(
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
        passRate: this.calculatePercentage(
          globalTestPassed,
          apiTestResult.numTestsRun
        ),
        failRate: this.calculatePercentage(
          globalTestFailed,
          apiTestResult.numTestsRun
        ),
        skipRate: this.calculatePercentage(0, apiTestResult.numTestsRun),
        testStartTime: formatStartTime(String(startTime)),
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
      const perClassCovMap = await this.getPerClassCodeCoverage(
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
      } = await this.getAggregateCodeCoverage(coveredApexClassIdSet);
      result.codecoverage = codeCoverageResults;
      result.summary.totalLines = totalLines;
      result.summary.coveredLines = coveredLines;
      result.summary.testRunCoverage = this.calculatePercentage(
        coveredLines,
        totalLines
      );
      result.summary.orgWideCoverage = await this.getOrgWideCoverage();
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
        item.message || item.stackTrace ? this.getSyncDiagnostic(item) : null;

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

  private getSyncDiagnostic(syncRecord: SyncTestFailure): ApexDiagnostic {
    const diagnostic: ApexDiagnostic = {
      exceptionMessage: syncRecord.message,
      exceptionStackTrace: syncRecord.stackTrace,
      className: syncRecord.stackTrace.split('.')[1],
      compileProblem: ''
    };

    const matches = syncRecord.stackTrace.match(/(line (\d+), column (\d+))/);
    if (matches) {
      if (matches[2]) {
        diagnostic.lineNumber = Number(matches[2]);
      }
      if (matches[3]) {
        diagnostic.columnNumber = Number(matches[3]);
      }
    }
    return diagnostic;
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
    const sClient = new StreamingClient(this.connection, progress);
    await sClient.init();
    await sClient.handshake();

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
      codeCoverage
    );
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
    codeCoverage = false
  ): Promise<TestResult> {
    let testRunSummaryQuery =
      'SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, ';
    testRunSummaryQuery +=
      'MethodsEnqueued, StartTime, EndTime, TestTime, UserId ';
    testRunSummaryQuery += `FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;
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
        passRate: this.calculatePercentage(
          globalTests.passed,
          testResults.length
        ),
        failRate: this.calculatePercentage(
          globalTests.failed,
          testResults.length
        ),
        skipRate: this.calculatePercentage(
          globalTests.skipped,
          testResults.length
        ),
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
      const perClassCovMap = await this.getPerClassCodeCoverage(
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

      const {
        codeCoverageResults,
        totalLines,
        coveredLines
      } = await this.getAggregateCodeCoverage(coveredApexClassIdSet);
      result.codecoverage = codeCoverageResults;
      result.summary.totalLines = totalLines;
      result.summary.coveredLines = coveredLines;
      result.summary.testRunCoverage = this.calculatePercentage(
        coveredLines,
        totalLines
      );
      result.summary.orgWideCoverage = await this.getOrgWideCoverage();
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
      const newIds = this.addIdToQuery(formattedIds, id);
      const query = util.format(apexTestResultQuery, `'${newIds}'`);

      if (query.length > QUERY_CHAR_LIMIT) {
        queries.push(util.format(apexTestResultQuery, `'${formattedIds}'`));
        formattedIds = '';
      }
      formattedIds = this.addIdToQuery(formattedIds, id);
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
          item.Message || item.StackTrace
            ? this.getAsyncDiagnostic(item)
            : null;

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

  public getAsyncDiagnostic(asyncRecord: ApexTestResultRecord): ApexDiagnostic {
    const diagnostic: ApexDiagnostic = {
      exceptionMessage: asyncRecord.Message,
      exceptionStackTrace: asyncRecord.StackTrace,
      className: asyncRecord.StackTrace.split('.')[1],
      compileProblem: ''
    };

    const matches = asyncRecord.StackTrace.match(/(line (\d+), column (\d+))/);
    if (matches) {
      if (matches[2]) {
        diagnostic.lineNumber = Number(matches[2]);
      }
      if (matches[3]) {
        diagnostic.columnNumber = Number(matches[3]);
      }
    }
    return diagnostic;
  }

  public async getOrgWideCoverage(): Promise<string> {
    const orgWideCoverageResult = (await this.connection.tooling.query(
      'SELECT PercentCovered FROM ApexOrgWideCoverage'
    )) as ApexOrgWideCoverage;

    if (orgWideCoverageResult.records.length === 0) {
      return '0%';
    }
    return `${orgWideCoverageResult.records[0].PercentCovered}%`;
  }

  //NOTE: a test could cover more than one class, map should contain a record for each covered class
  public async getPerClassCodeCoverage(
    apexTestClassSet: Set<string>
  ): Promise<Map<string, PerClassCoverage[]>> {
    if (apexTestClassSet.size === 0) {
      return new Map();
    }

    let str = '';
    apexTestClassSet.forEach(elem => {
      str += `'${elem}',`;
    });
    str = str.slice(0, -1);

    const perClassCodeCovQuery =
      'SELECT ApexTestClassId, ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, TestMethodName, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverage WHERE ApexTestClassId IN (%s)';
    const perClassCodeCovResuls = (await this.connection.tooling.query(
      util.format(perClassCodeCovQuery, `${str}`)
    )) as ApexCodeCoverage;

    const perClassCoverageMap = new Map<string, PerClassCoverage[]>();
    perClassCodeCovResuls.records.forEach(item => {
      const totalLines = item.NumLinesCovered + item.NumLinesUncovered;
      const percentage = this.calculatePercentage(
        item.NumLinesCovered,
        totalLines
      );

      const value = {
        apexClassOrTriggerName: item.ApexClassOrTrigger.Name,
        apexClassOrTriggerId: item.ApexClassOrTrigger.Id,
        apexTestClassId: item.ApexTestClassId,
        apexTestMethodName: item.TestMethodName,
        numLinesCovered: item.NumLinesCovered,
        numLinesUncovered: item.NumLinesUncovered,
        percentage,
        ...(item.Coverage ? { coverage: item.Coverage } : {})
      };
      const key = `${item.ApexTestClassId}-${item.TestMethodName}`;
      if (perClassCoverageMap.get(key)) {
        perClassCoverageMap.get(key).push(value);
      } else {
        perClassCoverageMap.set(
          `${item.ApexTestClassId}-${item.TestMethodName}`,
          [value]
        );
      }
    });

    return perClassCoverageMap;
  }

  public async getAggregateCodeCoverage(
    apexClassIdSet: Set<string>
  ): Promise<{
    codeCoverageResults: CodeCoverageResult[];
    totalLines: number;
    coveredLines: number;
  }> {
    if (apexClassIdSet.size === 0) {
      return { codeCoverageResults: [], totalLines: 0, coveredLines: 0 };
    }

    let str = '';
    apexClassIdSet.forEach(elem => {
      str += `'${elem}',`;
    });
    str = str.slice(0, -1);

    const codeCoverageQuery =
      'SELECT ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate WHERE ApexClassorTriggerId IN (%s)';
    const codeCoverageResuls = (await this.connection.tooling.query(
      util.format(codeCoverageQuery, `${str}`)
    )) as ApexCodeCoverageAggregate;

    let totalLinesCovered = 0;
    let totalLinesUncovered = 0;
    const codeCoverageResults: CodeCoverageResult[] = codeCoverageResuls.records.map(
      item => {
        totalLinesCovered += item.NumLinesCovered;
        totalLinesUncovered += item.NumLinesUncovered;
        const totalLines = item.NumLinesCovered + item.NumLinesUncovered;
        const percentage = this.calculatePercentage(
          item.NumLinesCovered,
          totalLines
        );

        return {
          apexId: item.ApexClassOrTrigger.Id,
          name: item.ApexClassOrTrigger.Name,
          type: item.ApexClassOrTrigger.Id.startsWith('01p')
            ? 'ApexClass'
            : 'ApexTrigger',
          numLinesCovered: item.NumLinesCovered,
          numLinesUncovered: item.NumLinesUncovered,
          percentage,
          coveredLines: item.Coverage.coveredLines,
          uncoveredLines: item.Coverage.uncoveredLines
        };
      }
    );

    return {
      codeCoverageResults,
      totalLines: totalLinesCovered + totalLinesUncovered,
      coveredLines: totalLinesCovered
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
                `test-result-${result.summary.testRunId}.json`
              ),
              content: this.stringify(result)
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
                `test-result-${result.summary.testRunId}-junit.xml`
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
        content: this.stringify(coverageRecords)
      });
    }

    fileInfos?.forEach(fileInfo => {
      fileMap.push({
        path: join(dirPath, fileInfo.filename),
        content:
          typeof fileInfo.content !== 'string'
            ? this.stringify(fileInfo.content)
            : fileInfo.content
      });
    });

    createFiles(fileMap);
    return fileMap.map(file => {
      return file.path;
    });
  }

  private calculatePercentage(dividend: number, divisor: number): string {
    let percentage = '0%';
    if (dividend > 0) {
      const calcPct = ((dividend / divisor) * 100).toFixed();
      percentage = `${calcPct}%`;
    }
    return percentage;
  }

  private addIdToQuery(formattedIds: string, id: string): string {
    return formattedIds.length === 0 ? id : `${formattedIds}','${id}`;
  }

  public stringify(jsonObj: object): string {
    return JSON.stringify(jsonObj, null, 2);
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
