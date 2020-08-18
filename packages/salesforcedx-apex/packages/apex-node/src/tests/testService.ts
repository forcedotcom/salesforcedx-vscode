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
  SyncTestErrorResult,
  AsyncTestConfiguration,
  AsyncTestArrayConfiguration,
  ApexTestRunResult,
  ApexTestResult,
  ApexTestQueueItem,
  AsyncTestResult,
  ApexCodeCoverageAggregate,
  ApexTestResultData,
  CodeCoverageResult,
  ApexOrgWideCoverage,
  ApexTestResultOutcome
} from './types';
import * as util from 'util';
import { nls } from '../i18n';
import { StreamingClient } from '../streaming';

export class TestService {
  public readonly connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public async runTestSynchronous(
    options: SyncTestConfiguration
  ): Promise<SyncTestResult | SyncTestErrorResult[]> {
    const url = `${this.connection.tooling._baseUrl()}/runTestsSynchronous`;
    const request = {
      method: 'POST',
      url,
      body: JSON.stringify(options),
      headers: { 'content-type': 'application/json' }
    };

    const testRun = await this.connection.tooling.request(request);
    return testRun as SyncTestResult | SyncTestErrorResult[];
  }

  public async runTestAsynchronous(
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration,
    codeCoverage = false
  ): Promise<AsyncTestResult> {
    const sClient = new StreamingClient(this.connection);
    await sClient.init();
    const url = `${this.connection.tooling._baseUrl()}/runTestsAsynchronous`;
    const request = {
      method: 'POST',
      url,
      body: JSON.stringify(options),
      headers: { 'content-type': 'application/json' }
    };

    const testRunId = (await this.connection.tooling.request(
      request
    )) as string;

    const testQueueResult = await sClient.subscribe(testRunId);

    return await this.getTestResultData(
      testQueueResult,
      testRunId,
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
  ): Promise<AsyncTestResult> {
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
      'ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix, ApexClass.FullName ';
    apexTestResultQuery += 'FROM ApexTestResult WHERE QueueItemId IN (%s)';

    // TODO: this needs to iterate and create a comma separated string of ids
    // and check for query length
    const apexResultId = testQueueResult.records[0].Id;
    const apexTestResults = (await this.connection.tooling.query(
      util.format(apexTestResultQuery, `'${apexResultId}'`)
    )) as ApexTestResult;

    let globalTestPassed = 0;
    let globalTestFailed = 0;
    let globalTestSkipped = 0;
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

    const result: AsyncTestResult = {
      summary: {
        failRate: this.calculatePercentage(
          globalTestFailed,
          testResults.length
        ),
        numTestsRan: testResults.length,
        orgId: this.connection.getAuthInfoFields().orgId,
        outcome: summaryRecord.Status,
        passRate: this.calculatePercentage(
          globalTestPassed,
          testResults.length
        ),
        skipRate: this.calculatePercentage(
          globalTestSkipped,
          testResults.length
        ),
        testStartTime: summaryRecord.StartTime,
        testExecutionTime: summaryRecord.TestTime,
        testRunId,
        userId: summaryRecord.UserId,
        username: this.connection.getUsername()
      },
      tests: testResults
    };

    if (codeCoverage) {
      result.codecoverage = await this.getTestCodeCoverage();
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

  public async getTestCodeCoverage(): Promise<CodeCoverageResult[]> {
    const codeCoverageQuery =
      'SELECT ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate';
    const codeCoverageResuls = (await this.connection.tooling.query(
      codeCoverageQuery
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
}
