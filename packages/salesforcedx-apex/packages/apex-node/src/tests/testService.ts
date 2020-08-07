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
  AsyncTestResult
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
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration
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
    return await this.getTestResultData(testQueueResult, testRunId);
  }

  public async getTestResultData(
    testQueueResult: ApexTestQueueItem,
    testRunId: string
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

    // Iterate over test results, format and add them as results.tests
    const testResults = apexTestResults.records.map(item => {
      return {
        Id: item.Id,
        QueueItemId: item.QueueItemId,
        StackTrace: item.StackTrace,
        Message: item.Message,
        AsyncApexJobId: item.AsyncApexJobId,
        MethodName: item.MethodName,
        Outcome: item.Outcome,
        ApexLogId: item.ApexLogId,
        ApexClass: {
          Id: item.ApexClass.Id,
          Name: item.ApexClass.Name,
          NamespacePrefix: item.ApexClass.NamespacePrefix,
          FullName: item.ApexClass.FullName
        },
        RunTime: item.RunTime,
        TestTimestamp: item.TestTimestamp, // TODO: convert timestamp
        FullName: `${item.ApexClass.FullName}.${item.MethodName}`
      };
    });

    // TODO: add code coverage
    const result: AsyncTestResult = {
      summary: {
        outcome: summaryRecord.Status,
        testStartTime: summaryRecord.StartTime,
        testExecutionTime: summaryRecord.TestTime,
        testRunId,
        userId: summaryRecord.UserId
      },
      tests: testResults
    };
    return result;
  }
}
