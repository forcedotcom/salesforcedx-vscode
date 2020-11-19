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
  PerClassCoverage
} from './types';
import * as util from 'util';
import { nls } from '../i18n';
import { StreamingClient } from '../streaming';

export class TestService {
  public readonly connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  private async formatSyncResults(
    apiTestResult: SyncTestResult,
    startTime: number,
    codeCoverage = false
  ): Promise<TestResult> {
    const testResults: ApexTestResultData[] = [];
    const apexTestClassIdSet = new Set<string>();
    const coveredApexClassIdSet = new Set<string>();
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
        runTime: item.time,
        testTimestamp: '',
        fullName: `${nms}${item.name}.${item.methodName}`
      });
    });

    apiTestResult.failures.forEach(item => {
      const nms = item.namespace ? `${item.namespace}__` : '';
      apexTestClassIdSet.add(item.id);
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
        runTime: item.time,
        testTimestamp: '',
        fullName: `${nms}${item.name}.${item.methodName}`
      });
    });

    if (codeCoverage) {
      const perClassCoverageMap = await this.getPerClassCodeCoverage(
        apexTestClassIdSet
      );

      testResults.forEach(item => {
        const keyCodeCov = `${item.apexClass.id}-${item.methodName}`;
        const perClassCov = perClassCoverageMap.get(keyCodeCov);
        coveredApexClassIdSet.add(perClassCov.apexClassorTriggerId);
        item.perClassCoverage = {
          apexClassOrTriggerName: perClassCov.apexClassOrTriggerName,
          percentage: perClassCov.percentage
        };
      });
    }

    const globalTestFailed = apiTestResult.failures.length;
    const globalTestPassed = apiTestResult.successes.length;
    const result: TestResult = {
      summary: {
        outcome:
          globalTestFailed === 0
            ? ApexTestRunResultStatus.Completed
            : ApexTestRunResultStatus.Failed,
        numTestsRan: apiTestResult.numTestsRun,
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
        testStartTime: `${startTime}`,
        testExecutionTime: apiTestResult.totalTime,
        hostname: this.connection.instanceUrl,
        orgId: this.connection.getAuthInfoFields().orgId,
        username: this.connection.getUsername(),
        testRunId: '',
        userId: this.connection.getConnectionOptions().userId
      },
      tests: testResults
    };

    if (codeCoverage) {
      result.codecoverage = await this.getTestCodeCoverage(
        coveredApexClassIdSet
      );
      result.summary.orgWideCoverage = await this.getOrgWideCoverage();
    }
    return result;
  }

  public async runTestSynchronous(
    options: SyncTestConfiguration,
    codeCoverage = false
  ): Promise<TestResult> {
    const url = `${this.connection.tooling._baseUrl()}/runTestsSynchronous`;
    const request = {
      method: 'POST',
      url,
      body: JSON.stringify(options),
      headers: { 'content-type': 'application/json' }
    };

    const startTime = Date.now();
    const testRun = (await this.connection.tooling.request(
      request
    )) as SyncTestResult;

    return this.formatSyncResults(testRun, startTime, codeCoverage);
  }

  public async runTestAsynchronous(
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration,
    codeCoverage = false
  ): Promise<TestResult> {
    const sClient = new StreamingClient(this.connection);
    await sClient.init();
    await sClient.handshake();

    const asyncRunResult = await sClient.subscribe(
      this.getTestRunRequestAction(options)
    );

    return await this.getTestResultData(
      asyncRunResult.queueItem,
      asyncRunResult.runId,
      codeCoverage
    );
  }

  private calculatePercentage(dividend: number, divisor: number): string {
    let percentage = '0%';
    if (dividend > 0) {
      const calcPct = ((dividend / divisor) * 100).toFixed();
      percentage = `${calcPct}%`;
    }
    return percentage;
  }

  public async getTestResultData(
    testQueueResult: ApexTestQueueItem,
    testRunId: string,
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
      throw new Error(nls.localize('no_test_result_summary', testRunId));
    }

    const summaryRecord = testRunSummaryResults.records[0];

    let apexTestResultQuery = 'SELECT Id, QueueItemId, StackTrace, Message, ';
    apexTestResultQuery +=
      'RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, ';
    apexTestResultQuery +=
      'ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix ';
    apexTestResultQuery += 'FROM ApexTestResult WHERE QueueItemId IN (%s)';

    // TODO: this needs to check for query length
    const apexResultIds = testQueueResult.records
      .map(record => record.Id)
      .join("','");
    const apexTestResults = (await this.connection.tooling.query(
      util.format(apexTestResultQuery, `'${apexResultIds}'`)
    )) as ApexTestResult;

    let globalTestPassed = 0;
    let globalTestFailed = 0;
    let globalTestSkipped = 0;
    const apexTestClassIdSet = new Set<string>();
    const coveredApexClassIdSet = new Set<string>();
    // Iterate over test results, format and add them as results.tests
    const testResults: ApexTestResultData[] = [];
    apexTestResults.records.forEach(item => {
      switch (item.Outcome) {
        case ApexTestResultOutcome.Pass:
          globalTestPassed++;
          break;
        case ApexTestResultOutcome.Fail:
        case ApexTestResultOutcome.CompileFail:
          globalTestFailed++;
          break;
        case ApexTestResultOutcome.Skip:
          globalTestSkipped++;
          break;
      }

      apexTestClassIdSet.add(item.ApexClass.Id);
      // Can only query the FullName field if a single record is returned, so manually build the field
      item.ApexClass.FullName = item.ApexClass.NamespacePrefix
        ? `${item.ApexClass.NamespacePrefix}__${item.ApexClass.Name}`
        : item.ApexClass.Name;

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
        runTime: item.RunTime,
        testTimestamp: item.TestTimestamp, // TODO: convert timestamp
        fullName: `${item.ApexClass.FullName}.${item.MethodName}`
      });
    });

    if (codeCoverage) {
      const perClassCoverageMap = await this.getPerClassCodeCoverage(
        apexTestClassIdSet
      );

      testResults.forEach(item => {
        const keyCodeCov = `${item.apexClass.id}-${item.methodName}`;
        const perClassCov = perClassCoverageMap.get(keyCodeCov);
        // Skipped test is not in coverage map, check to see if perClassCov exists first
        if (perClassCov) {
          coveredApexClassIdSet.add(perClassCov.apexClassorTriggerId);
          item.perClassCoverage = {
            apexClassOrTriggerName: perClassCov.apexClassOrTriggerName,
            percentage: perClassCov.percentage
          };
        }
      });
    }

    const result: TestResult = {
      summary: {
        outcome: summaryRecord.Status,
        numTestsRan: testResults.length,
        passing: globalTestPassed,
        failing: globalTestFailed,
        skipped: globalTestSkipped,
        passRate: this.calculatePercentage(
          globalTestPassed,
          testResults.length
        ),
        failRate: this.calculatePercentage(
          globalTestFailed,
          testResults.length
        ),
        skipRate: this.calculatePercentage(
          globalTestSkipped,
          testResults.length
        ),
        testStartTime: summaryRecord.StartTime,
        testExecutionTime: summaryRecord.TestTime,
        hostname: this.connection.instanceUrl,
        orgId: this.connection.getAuthInfoFields().orgId,
        username: this.connection.getUsername(),
        testRunId,
        userId: summaryRecord.UserId
      },
      tests: testResults
    };

    if (codeCoverage) {
      result.codecoverage = await this.getTestCodeCoverage(
        coveredApexClassIdSet
      );
      result.summary.orgWideCoverage = await this.getOrgWideCoverage();
    }

    return result;
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

  public async getPerClassCodeCoverage(
    apexTestClassSet: Set<string>
  ): Promise<Map<string, PerClassCoverage>> {
    let str = '';
    apexTestClassSet.forEach(elem => {
      str += `'${elem}',`;
    });
    str = str.slice(0, -1);

    const perClassCodeCovQuery =
      'SELECT ApexTestClassId, ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, TestMethodName, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverage WHERE ApexTestClassId IN (%s)';
    const perClassCodeCovResuls = (await this.connection.tooling.query(
      util.format(perClassCodeCovQuery, `${str}`)
    )) as ApexCodeCoverage;

    const perClassCodCovMap = new Map<string, PerClassCoverage>();
    perClassCodeCovResuls.records.forEach(item => {
      const totalLines = item.NumLinesCovered + item.NumLinesUncovered;
      const percentage = this.calculatePercentage(
        item.NumLinesCovered,
        totalLines
      );

      //NOTE: a test could cover more than one class, we should change this in order to handle that
      perClassCodCovMap.set(`${item.ApexTestClassId}-${item.TestMethodName}`, {
        apexClassOrTriggerName: item.ApexClassOrTrigger.Name,
        apexClassorTriggerId: item.ApexClassOrTrigger.Id,
        apexTestClassId: item.ApexTestClassId,
        apexTestMethodName: item.TestMethodName,
        percentage
      });
    });

    return perClassCodCovMap;
  }

  public async getTestCodeCoverage(
    apexClassIdSet: Set<string>
  ): Promise<CodeCoverageResult[]> {
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

    const coverageResults: CodeCoverageResult[] = codeCoverageResuls.records.map(
      item => {
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

    return coverageResults;
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
