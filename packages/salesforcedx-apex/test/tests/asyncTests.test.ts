/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection, Logger } from '@salesforce/core';
import { elapsedTime } from '../../src/utils';
import * as dateUtil from '../../src/utils/dateUtil';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import * as sinon from 'sinon';
import {
  TestService,
  OutputDirConfig,
  ApexTestProgressValue,
  Progress,
  JUnitFormatTransformer,
  TapFormatTransformer,
  CancellationTokenSource
} from '../../src';
import {
  AsyncTestConfiguration,
  TestLevel,
  ApexTestQueueItemStatus,
  ApexTestResultOutcome,
  ApexTestQueueItem,
  ApexTestRunResultStatus,
  ApexTestResult,
  ApexTestQueueItemRecord,
  ResultFormat,
  TestRunIdResult,
  TestCategory
} from '../../src/tests/types';
import { StreamingClient } from '../../src/streaming';
import { fail } from 'node:assert';
import { nls } from '../../src/i18n';
import {
  codeCoverageQueryResult,
  mixedPerClassCodeCoverage,
  mixedTestResults,
  missingTimeTestData,
  testResultData,
  testRunId,
  testStartTime,
  diagnosticFailure,
  diagnosticResult,
  skippedTestData,
  flowTestResultData
} from '../testData';
import { join } from 'node:path';
import * as fs from 'node:fs/promises';
import * as diagnosticUtil from '../../src/tests/diagnosticUtil';
import * as utils from '../../src/tests/utils';
import { AsyncTests } from '../../src/tests/asyncTests';
import { QUERY_RECORD_LIMIT } from '../../src/tests/constants';
import { Writable } from 'node:stream';
import { Duration } from '@salesforce/kit';

let mockConnection: Connection;
let toolingRequestStub: sinon.SinonStub;
let retrieveMaxApiVersionStub: sinon.SinonStub;
let formatSpy: sinon.SinonSpy;
const testData = new MockTestOrgData();
let timeStub: sinon.SinonStub;
const pollResponse: ApexTestQueueItem = {
  done: true,
  totalSize: 1,
  records: [
    {
      Id: '7092M000000Vt94QAC',
      Status: ApexTestQueueItemStatus.Completed,
      ApexClassId: '01p2M00000O6tXZQAZ',
      TestRunResultId: '05m2M000000TgYuQAK'
    }
  ]
};

describe('Run Apex tests asynchronously', () => {
  const $$ = new TestContext();

  beforeEach(async () => {
    await $$.stubAuths(testData);
    mockConnection = await testData.getConnection();
    retrieveMaxApiVersionStub = $$.SANDBOX.stub(mockConnection, 'retrieveMaxApiVersion').resolves('61.0');
    $$.SANDBOX.stub(mockConnection, 'instanceUrl').get(() => 'https://na139.salesforce.com');
    $$.SANDBOX.stub(mockConnection, 'getApiVersion').resolves('50.0');
    // Stub getCurrentTime (not Date.prototype.getTime) so incidental Date usage in
    // jest/TestContext setup does not consume the sequenced return values.
    timeStub = $$.SANDBOX.stub(dateUtil, 'getCurrentTime').onFirstCall().returns(6000);
    timeStub.onSecondCall().returns(8000);
    testResultData.summary.orgId = mockConnection.getAuthInfoFields().orgId ?? '';
    testResultData.summary.username = mockConnection.getUsername() ?? '';
    toolingRequestStub = $$.SANDBOX.stub(mockConnection.tooling, 'request');
    formatSpy = $$.SANDBOX.spy(diagnosticUtil, 'formatTestErrors');
  });

  it('should run a successful test', async () => {
    const requestOptions: AsyncTestConfiguration = {
      classNames: 'TestSample',
      testLevel: TestLevel.RunSpecifiedTests
    };

    const testAsyncRequest = {
      method: 'POST',
      url: `${mockConnection.tooling._baseUrl()}/runTestsAsynchronous`,
      body: JSON.stringify(requestOptions),
      headers: { 'content-type': 'application/json' }
    };

    toolingRequestStub.withArgs(testAsyncRequest).returns(testRunId);

    $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '07Mxx00000F2Xx6UAF',
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: 1000,
          UserId: '005xx000000abcDAAU',
          ClassesCompleted: 1,
          ClassesEnqueued: 1,
          MethodsEnqueued: 1,
          QueueItemId: '7092M000000Vt94QAC',
          StackTrace: null,
          Message: null,
          MethodName: 'testLoggerLog',
          Outcome: ApexTestResultOutcome.Pass,
          ApexLogId: null,
          ApexClass: {
            Id: '01pxx00000O6tXZQAZ',
            Name: 'TestLogger',
            NamespacePrefix: 't3st',
            FullName: 't3st__TestLogger'
          },
          RunTime: 8,
          TestTimestamp: '3'
        }
      ]
    });

    const testSrv = new TestService(mockConnection);
    const mockTestResultData = $$.SANDBOX.stub(AsyncTests.prototype, 'formatAsyncResults').resolves(testResultData);

    const testResult = await testSrv.runTestAsynchronous(
      requestOptions,
      false,
      false,
      undefined,
      undefined,
      Duration.minutes(2)
    );
    expect(typeof testResult).toBe('object');
    expect(mockTestResultData.calledOnce).toBe(true);
    expect(testResult).toBe(testResultData);
  });

  it('should throw an error on refresh token issue', async () => {
    const requestOptions: AsyncTestConfiguration = {
      classNames: 'TestSample',
      testLevel: TestLevel.RunSpecifiedTests
    };
    const testAsyncRequest = {
      method: 'POST',
      url: `${mockConnection.tooling._baseUrl()}/runTestsAsynchronous`,
      body: JSON.stringify(requestOptions),
      headers: {
        'content-type': 'application/json'
      }
    };
    toolingRequestStub.withArgs(testAsyncRequest).returns(testRunId);

    $$.SANDBOX.stub(mockConnection.tooling, 'query').rejects(new Error('No access token'));

    const testSrv = new TestService(mockConnection);
    try {
      await testSrv.runTestAsynchronous(requestOptions, false, false, undefined, undefined, Duration.minutes(2));
      fail('Expected an error to be thrown');
    } catch (error) {
      expect(error.message).toBe('No access token');
    }
  });

  it('should return flow test formatted test results', async () => {
    flowTestResultData.summary.orgId = mockConnection.getAuthInfoFields().orgId ?? '';
    flowTestResultData.summary.username = mockConnection.getUsername() ?? '';
    const asyncTestSrv = new AsyncTests(mockConnection);
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');

    // First call - test run summary
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU'
        }
      ]
    });

    // Second call - flow test results
    mockToolingQuery.onSecondCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '07Mxx00000F2Xx6UAF',
          ApexTestQueueItemId: '7092M000000Vt94QAC',
          Result: ApexTestResultOutcome.Pass,
          TestStartDateTime: '3',
          TestEndDateTime: '5',
          FlowTest: {
            DeveloperName: 'FlowName_FlowTestName'
          },
          FlowDefinition: {
            DeveloperName: 'FlowName',
            NamespacePrefix: ''
          }
        }
      ]
    });

    const runResult = await asyncTestSrv.checkRunStatus(testRunId);
    const pollResponseForFlowTest: ApexTestQueueItem = {
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '7092M000000Vt94QAC',
          Status: ApexTestQueueItemStatus.Completed,
          ApexClassId: null,
          TestRunResultId: '05m2M000000TgYuQAK'
        }
      ]
    };
    const getTestResultData = await asyncTestSrv.formatAsyncResults(
      { queueItem: pollResponseForFlowTest, runId: testRunId },
      dateUtil.getCurrentTime(),
      undefined,
      runResult.testRunSummary
    );

    let summaryQuery = 'SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, ';
    summaryQuery += 'MethodsEnqueued, StartTime, EndTime, TestTime, TestSetupTime, UserId ';
    summaryQuery += `FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;
    expect(mockToolingQuery.getCall(0).args[0]).toBe(summaryQuery);

    let testResultQuery =
      'SELECT Id, ApexTestQueueItemId, Result, TestStartDateTime,TestEndDateTime, FlowTest.DeveloperName, ';
    testResultQuery += 'FlowDefinition.DeveloperName, FlowDefinition.NamespacePrefix ';
    testResultQuery += `FROM FlowTestResult WHERE ApexTestQueueItemId IN ('${pollResponseForFlowTest.records[0].Id}')`;
    expect(mockToolingQuery.getCall(1).args[0]).toBe(testResultQuery);
    expect(getTestResultData).toEqual(flowTestResultData);
  });

  it('should return correct summary outcome for single skipped test', async () => {
    skippedTestData.summary.orgId = mockConnection.getAuthInfoFields().orgId ?? '';
    skippedTestData.summary.username = mockConnection.getUsername() ?? '';
    const asyncTestSrv = new AsyncTests(mockConnection);
    $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '07Mxx00000F2Xx6UAF',
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU',
          QueueItemId: '7092M000000Vt94QAC',
          StackTrace: null,
          Message: null,
          MethodName: 'testLoggerLog',
          Outcome: ApexTestResultOutcome.Skip,
          ApexLogId: null,
          ApexClass: {
            Id: '7092M000000Vt94QAC',
            Name: 'TestLogger',
            NamespacePrefix: 't3st',
            FullName: 't3st__TestLogger'
          },
          RunTime: null,
          TestTimestamp: '3'
        }
      ]
    });

    const runResult = await asyncTestSrv.checkRunStatus(testRunId);
    const testResultData = await asyncTestSrv.formatAsyncResults(
      { queueItem: pollResponse, runId: testRunId },
      dateUtil.getCurrentTime(),
      false,
      runResult.testRunSummary
    );

    expect(testResultData).toEqual(skippedTestData);
  });

  it('should return formatted test results', async () => {
    missingTimeTestData.summary.orgId = mockConnection.getAuthInfoFields().orgId ?? '';
    missingTimeTestData.summary.username = mockConnection.getUsername() ?? '';
    const asyncTestSrv = new AsyncTests(mockConnection);
    $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '07Mxx00000F2Xx6UAF',
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU',
          QueueItemId: '7092M000000Vt94QAC',
          StackTrace: null,
          Message: null,
          MethodName: 'testLoggerLog',
          Outcome: ApexTestResultOutcome.Pass,
          ApexLogId: null,
          ApexClass: {
            Id: '01pxx00000O6tXZQAZ',
            Name: 'TestLogger',
            NamespacePrefix: 't3st',
            FullName: 't3st__TestLogger'
          },
          RunTime: null,
          TestTimestamp: '3'
        }
      ]
    });

    const runResult = await asyncTestSrv.checkRunStatus(testRunId);
    const getTestResultData = await asyncTestSrv.formatAsyncResults(
      { queueItem: pollResponse, runId: testRunId },
      dateUtil.getCurrentTime(),
      undefined,
      runResult.testRunSummary
    );

    expect(getTestResultData).toEqual(missingTimeTestData);
  });

  it('should report progress when checking test summary for run', async () => {
    const asyncTestSrv = new AsyncTests(mockConnection);
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU'
        }
      ]
    });
    mockToolingQuery.onSecondCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '07Mxx00000F2Xx6UAF',
          QueueItemId: '7092M000000Vt94QAC',
          StackTrace: null,
          Message: null,
          AsyncApexJobId: testRunId,
          MethodName: 'testLoggerLog',
          Outcome: ApexTestResultOutcome.Pass,
          ApexLogId: null,
          ApexClass: {
            Id: '01pxx00000O6tXZQAZ',
            Name: 'TestLogger',
            NamespacePrefix: 't3st',
            FullName: 't3st__TestLogger'
          },
          RunTime: null,
          TestTimestamp: '3'
        }
      ]
    } as unknown as ApexTestResult);
    const reportStub = $$.SANDBOX.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };

    await asyncTestSrv.checkRunStatus(testRunId, progressReporter);

    sinon.assert.calledOnce(reportStub);
    sinon.assert.calledWith(reportStub, {
      type: 'FormatTestResultProgress',
      value: 'retrievingTestRunSummary',
      message: nls.localize('retrievingTestRunSummary')
    });
  });

  it('should return formatted test results with diagnostics', async () => {
    diagnosticResult.summary.orgId = mockConnection.getAuthInfoFields().orgId ?? '';
    diagnosticResult.summary.username = mockConnection.getUsername() ?? '';
    const asyncTestSrv = new AsyncTests(mockConnection);
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU'
        }
      ]
    });
    mockToolingQuery.onSecondCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '07Mxx00000F2Xx6UAF',
          QueueItemId: '7092M000000Vt94QAC',
          StackTrace: 'Class.LIFXControllerTest.makeData: line 6, column 1',
          Message: 'System.AssertException: Assertion Failed',
          AsyncApexJobId: testRunId,
          MethodName: 'testLoggerLog',
          Outcome: ApexTestResultOutcome.Fail,
          ApexLogId: null,
          ApexClass: {
            Id: '01pxx00000O6tXZQAZ',
            Name: 'TestLogger',
            NamespacePrefix: 't3st',
            FullName: 't3st__TestLogger'
          },
          RunTime: null,
          TestTimestamp: '3'
        }
      ]
    } as unknown as ApexTestResult);

    const runResult = await asyncTestSrv.checkRunStatus(testRunId);
    const getTestResultData = await asyncTestSrv.formatAsyncResults(
      { queueItem: pollResponse, runId: testRunId },
      dateUtil.getCurrentTime(),
      false,
      runResult.testRunSummary
    );

    expect(getTestResultData).toEqual(diagnosticResult);
  });

  it('should return failed test results with missing error info', async () => {
    diagnosticFailure.summary.orgId = mockConnection.getAuthInfoFields().orgId ?? '';
    diagnosticFailure.summary.username = mockConnection.getUsername() ?? '';
    diagnosticFailure.tests[0].diagnostic!.className = undefined;
    diagnosticFailure.tests[0].diagnostic!.exceptionStackTrace = '';
    diagnosticFailure.tests[0].stackTrace = undefined as unknown as string;
    const asyncTestSrv = new AsyncTests(mockConnection);
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU'
        }
      ]
    });

    mockToolingQuery.onSecondCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '07Mxx00000F2Xx6UAF',
          QueueItemId: '7092M000000Vt94QAC',
          StackTrace: undefined,
          Message: 'System.AssertException: Assertion Failed',
          AsyncApexJobId: testRunId,
          MethodName: 'testLoggerLog',
          Outcome: ApexTestResultOutcome.Fail,
          ApexLogId: null,
          ApexClass: {
            Id: '01pxx00000O6tXZQAZ',
            Name: 'TestLogger',
            NamespacePrefix: 't3st',
            FullName: 't3st__TestLogger'
          },
          RunTime: null,
          TestTimestamp: '3'
        }
      ]
    } as unknown as ApexTestResult);

    const runResult = await asyncTestSrv.checkRunStatus(testRunId);
    const getTestResultData = await asyncTestSrv.formatAsyncResults(
      { queueItem: pollResponse, runId: testRunId },
      dateUtil.getCurrentTime(),
      false,
      runResult.testRunSummary
    );

    expect(getTestResultData).toEqual(diagnosticFailure);
  });

  it('should return an error if no test results are found', async () => {
    const asyncTestSrv = new AsyncTests(mockConnection);
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    });

    try {
      const runResult = await asyncTestSrv.checkRunStatus(testRunId);
      await asyncTestSrv.formatAsyncResults(
        { queueItem: pollResponse, runId: testRunId },
        dateUtil.getCurrentTime(),
        false,
        runResult.testRunSummary
      );
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).toBe(nls.localize('noTestResultSummary', testRunId));
    }
  });

  it('should return an error if invalid test run id was provided', async () => {
    const invalidId = '000000xxxxx';
    const asyncTestSrv = new AsyncTests(mockConnection);
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    });

    try {
      await asyncTestSrv.checkRunStatus(invalidId);
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).toBe(nls.localize('invalidTestRunIdErr', invalidId));
      expect(mockToolingQuery.notCalled).toBe(true);
    }
  });

  it('should return an error if invalid test run id prefix was provided', async () => {
    const invalidId = '708000000xxxxxx';
    const asyncTestSrv = new AsyncTests(mockConnection);
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    });

    try {
      await asyncTestSrv.checkRunStatus(invalidId);
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).toBe(nls.localize('invalidTestRunIdErr', invalidId));
      expect(mockToolingQuery.notCalled).toBe(true);
    }
  });

  it('should return formatted test results with code coverage', async () => {
    const asyncTestSrv = new AsyncTests(mockConnection);
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');

    // First call - test run summary
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU'
        }
      ]
    });

    // Second call - test results
    mockToolingQuery.onSecondCall().resolves({
      done: true,
      totalSize: 6,
      records: mixedTestResults.map(result => ({
        ...result,
        ApexClass: {
          Id: result.ApexClass?.Id || '01pxx00000O6tXZQAZ',
          Name: result.ApexClass?.Name || 'TestLogger',
          FullName: result.ApexClass?.FullName || 't3st__TestLogger'
        }
      }))
    });

    // Third call - per-class code coverage
    mockToolingQuery.onCall(2).resolves({
      done: true,
      totalSize: 3,
      records: mixedPerClassCodeCoverage.map(coverage => ({
        ...coverage,
        ApexClassOrTrigger: {
          Id: coverage.ApexClassOrTrigger?.Id || '01pxx00000O6tXZQAZ',
          Name: coverage.ApexClassOrTrigger?.Name || 'TestLogger'
        }
      }))
    });

    // Fourth call - code coverage aggregate
    mockToolingQuery.onCall(3).resolves({
      done: true,
      totalSize: 3,
      records: codeCoverageQueryResult.map(result => ({
        ...result,
        ApexClassOrTrigger: {
          Id: result.ApexClassOrTrigger?.Id || '01pxx00000O6tXZQAZ',
          Name: result.ApexClassOrTrigger?.Name || 'TestLogger'
        }
      }))
    });

    // Fifth call - org-wide coverage
    mockToolingQuery.onCall(4).resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          PercentCovered: '57'
        }
      ]
    });

    const runResult = await asyncTestSrv.checkRunStatus(testRunId);
    const getTestResultData = await asyncTestSrv.formatAsyncResults(
      { queueItem: pollResponse, runId: testRunId },
      dateUtil.getCurrentTime(),
      true,
      runResult.testRunSummary
    );

    // verify summary data
    expect(getTestResultData.summary.failRate).toBe('33%');
    expect(getTestResultData.summary.testsRan).toBe(6);
    expect(getTestResultData.summary.orgId).toBe(mockConnection.getAuthInfoFields().orgId);
    expect(getTestResultData.summary.outcome).toBe('Failed');
    expect(getTestResultData.summary.passRate).toBe('50%');
    expect(getTestResultData.summary.skipRate).toBe('17%');
    expect(getTestResultData.summary.username).toBe(mockConnection.getUsername());
    expect(getTestResultData.summary.orgWideCoverage).toBe('57%');
    expect(getTestResultData.summary.testRunCoverage).toBe('66%');
    expect(getTestResultData.tests).toHaveLength(6);
    expect(getTestResultData.codecoverage!).toHaveLength(3);
  });

  it('should report progress for aggregating code coverage', async () => {
    const asyncTestSrv = new AsyncTests(mockConnection);
    $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '7092M000000Vt94QAC',
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: testStartTime,
          TestTime: null,
          UserId: '005xx000000abcDAAU',
          QueueItemId: '7092M000000Vt94QAC',
          StackTrace: null,
          Message: null,
          MethodName: 'testLoggerLog',
          Outcome: ApexTestResultOutcome.Pass,
          ApexLogId: null,
          ApexClass: {
            Id: '01pxx00000O6tXZQAZ',
            Name: 'TestLogger',
            NamespacePrefix: 't3st',
            FullName: 't3st__TestLogger'
          },
          ApexClassOrTrigger: {
            Id: '01pxx00000O6tXZQAZ',
            Name: 'TestLogger'
          },
          NumLinesCovered: 10,
          NumLinesUncovered: 5,
          PercentCovered: '57',
          RunTime: 8,
          TestTimestamp: '3',
          Coverage: {
            coveredLines: [1, 2, 3],
            uncoveredLines: [4, 5]
          }
        }
      ]
    });

    const reportStub = $$.SANDBOX.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };

    const runResult = await asyncTestSrv.checkRunStatus(testRunId, progressReporter);
    await asyncTestSrv.formatAsyncResults(
      { queueItem: pollResponse, runId: testRunId },
      dateUtil.getCurrentTime(),
      true,
      runResult.testRunSummary,
      progressReporter
    );

    sinon.assert.calledTwice(reportStub);
    sinon.assert.calledWith(reportStub, {
      type: 'FormatTestResultProgress',
      value: 'retrievingTestRunSummary',
      message: nls.localize('retrievingTestRunSummary')
    });
    sinon.assert.calledWith(reportStub, {
      type: 'FormatTestResultProgress',
      value: 'queryingForAggregateCodeCoverage',
      message: nls.localize('queryingForAggregateCodeCoverage')
    });
  });

  describe('Check Query Limits', () => {
    const queryStart =
      'SELECT Id, QueueItemId, StackTrace, Message, RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, IsTestSetup, ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix FROM ApexTestResult WHERE QueueItemId IN ';

    const queueItemRecords: ApexTestQueueItemRecord[] = [];
    const queryIds: string[] = [];
    const maxRecordCount = 700;

    for (let i = 0; i < maxRecordCount; i++) {
      const record = {
        Id: `7092M000000Vt94QAC-${i}`,
        Status: ApexTestQueueItemStatus.Completed,
        ApexClassId: '01p2M00000O6tXZQAZ',
        TestRunResultId: '05m2M000000TgYuQAK'
      };
      queueItemRecords.push(record);
      queryIds.push(record.Id);
    }

    const testQueueItems: ApexTestQueueItem = {
      done: true,
      totalSize: maxRecordCount,
      records: queueItemRecords
    };

    it('should split into multiple queries if query is longer than char limit', async () => {
      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves({
        done: true,
        totalSize: 1,
        records: []
      });

      const asyncTestSrv = new AsyncTests(mockConnection);
      const result = await asyncTestSrv.getAsyncTestResults(testQueueItems);

      expect(mockToolingQuery.calledTwice).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should make a single api call if query is under char limit', async () => {
      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves({
        done: true,
        totalSize: 1,
        records: []
      });

      const asyncTestSrv = new AsyncTests(mockConnection);
      const result = await asyncTestSrv.getAsyncTestResults(pollResponse);

      expect(mockToolingQuery.calledOnce).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('should format multiple queries correctly', async () => {
      const queryOneIds = queryIds.slice(0, QUERY_RECORD_LIMIT).join("','");
      const queryOne = `${queryStart}('${queryOneIds}')`;
      const queryTwoIds = queryIds.slice(QUERY_RECORD_LIMIT).join("','");
      const queryTwo = `${queryStart}('${queryTwoIds}')`;

      const testQueueItems: ApexTestQueueItem = {
        done: true,
        totalSize: maxRecordCount,
        records: queueItemRecords
      };

      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves({
        done: true,
        totalSize: 1,
        records: []
      });

      const asyncTestSrv = new AsyncTests(mockConnection);
      const result = await asyncTestSrv.getAsyncTestResults(testQueueItems);

      expect(mockToolingQuery.calledTwice).toBe(true);
      expect(result).toHaveLength(2);
      expect(mockToolingQuery.calledWith(queryOne)).toBe(true);
      expect(mockToolingQuery.calledWith(queryTwo)).toBe(true);
    });

    it('should format query at query limit correctly', async () => {
      const queryOneIds = queryIds.slice(0, QUERY_RECORD_LIMIT).join("','");
      const queryOne = `${queryStart}('${queryOneIds}')`;

      const testQueueItems: ApexTestQueueItem = {
        done: true,
        totalSize: maxRecordCount,
        records: queueItemRecords
      };

      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves({
        done: true,
        totalSize: 1,
        records: []
      });

      const asyncTestSrv = new AsyncTests(mockConnection);
      const result = await asyncTestSrv.getAsyncTestResults(testQueueItems);

      expect(mockToolingQuery.calledTwice).toBe(true);
      expect(result).toHaveLength(2);
      expect(mockToolingQuery.calledWith(queryOne)).toBe(true);
      expect(mockToolingQuery.calledWith(`${queryStart}('7092M000000Vt94QAC-0')`));
    });

    it('should split the queue into chunks of 500 records', async () => {
      const queryStart =
        'SELECT Id, QueueItemId, StackTrace, Message, RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, IsTestSetup, ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix FROM ApexTestResult WHERE QueueItemId IN ';
      const queryStartSeparatorCount = queryStart.split(',').length - 1;

      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query').resolves({
        done: true,
        totalSize: 1,
        records: []
      });

      const queueItemRecord: ApexTestQueueItemRecord[] = [];

      let count = 0;
      while (count < 1800) {
        const record = {
          Id: `7092M000000Vt94QAC-${count}`,
          Status: ApexTestQueueItemStatus.Completed,
          ApexClassId: '01p2M00000O6tXZQAZ',
          TestRunResultId: '05m2M000000TgYuQAK'
        };
        queueItemRecord.push(record);
        count++;
      }

      const testQueueItems: ApexTestQueueItem = {
        done: true,
        totalSize: 1800,
        records: queueItemRecord
      };

      const asyncTestSrv = new AsyncTests(mockConnection);
      await asyncTestSrv.getAsyncTestResults(testQueueItems);

      expect(mockToolingQuery.args).toHaveLength(4);

      const callOneIdCount = mockToolingQuery.getCall(0).args[0].split(',').length - queryStartSeparatorCount;
      expect(callOneIdCount).toBe(QUERY_RECORD_LIMIT);

      const callTwoIdCount = mockToolingQuery.getCall(1).args[0].split(',').length - queryStartSeparatorCount;
      expect(callTwoIdCount).toBe(QUERY_RECORD_LIMIT);

      const callThreeIdCount = mockToolingQuery.getCall(2).args[0].split(',').length - queryStartSeparatorCount;
      expect(callThreeIdCount).toBe(QUERY_RECORD_LIMIT);

      const callFourIdCount = mockToolingQuery.getCall(3).args[0].split(',').length - queryStartSeparatorCount;
      expect(callFourIdCount).toBe(300);

      expect(callOneIdCount + callTwoIdCount + callThreeIdCount + callFourIdCount).toBe(1800);
    });

    it('should format single query correctly', async () => {
      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
      const id = '7092M000000Vt94QAC';
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            ApexClassId: 'xxxx'
          }
        ]
      });
      mockToolingQuery.onSecondCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: '07Mxx00000F2Xx6UAF',
            QueueItemId: id,
            StackTrace: null,
            Message: null,
            AsyncApexJobId: testRunId,
            MethodName: 'testLoggerLog',
            Outcome: ApexTestResultOutcome.Pass,
            ApexLogId: null,
            ApexClass: {
              Id: '01pxx00000O6tXZQAZ',
              Name: 'TestLogger',
              NamespacePrefix: 't3st',
              FullName: 't3st__TestLogger'
            },
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as unknown as ApexTestResult);
      const singleQuery = `${queryStart}('${id}')`;

      const asyncTestSrv = new AsyncTests(mockConnection);
      const result = await asyncTestSrv.getAsyncTestResults(pollResponse);

      expect(mockToolingQuery.calledOnce).toBe(true);
      expect(mockToolingQuery.calledWith(singleQuery)).toBe(true);
      expect(result).toHaveLength(1);
    });
  });

  describe('Abort Test Runs', () => {
    it('should send requests to abort test run', async () => {
      const mockTestQueueItemRecord: ApexTestQueueItem = {
        size: 2,
        totalSize: 2,
        done: true,
        queryLocator: null,
        entityTypeName: 'ApexTestQueueItem',
        records: [
          {
            attributes: {
              type: 'ApexTestQueueItem',
              url: '/services/data/v51.0/tooling/sobjects/ApexTestQueueItem/7095w000000JR5mAAG'
            },
            Id: testRunId,
            Status: ApexTestQueueItemStatus.Processing
          },
          {
            attributes: {
              type: 'ApexTestQueueItem',
              url: '/services/data/v51.0/tooling/sobjects/ApexTestQueueItem/7095w000000JR5nAAG'
            },
            Id: testRunId,
            Status: ApexTestQueueItemStatus.Processing
          }
        ]
      } as unknown as ApexTestQueueItem;
      $$.SANDBOX.stub(mockConnection.tooling, 'query')
        //@ts-ignore
        .resolves<ApexTestQueueItemRecord>(mockTestQueueItemRecord);
      const toolingUpdateStub = $$.SANDBOX.stub(mockConnection.tooling, 'update');

      const asyncTestSrv = new AsyncTests(mockConnection);
      await asyncTestSrv.abortTestRun(testRunId);

      sinon.assert.calledOnce(toolingUpdateStub);
      sinon.assert.calledWith(toolingUpdateStub, 'ApexTestQueueItem', [
        {
          attributes: {
            type: 'ApexTestQueueItem',
            url: '/services/data/v51.0/tooling/sobjects/ApexTestQueueItem/7095w000000JR5mAAG'
          },
          Id: testRunId,
          Status: ApexTestQueueItemStatus.Aborted
        },
        {
          attributes: {
            type: 'ApexTestQueueItem',
            url: '/services/data/v51.0/tooling/sobjects/ApexTestQueueItem/7095w000000JR5nAAG'
          },
          Id: testRunId,
          Status: ApexTestQueueItemStatus.Aborted
        }
      ] as unknown as ApexTestQueueItemRecord[]);
    });

    it('should abort test run on cancellation requested', async () => {
      const requestOptions: AsyncTestConfiguration = {
        classNames: 'TestSample',
        testLevel: TestLevel.RunSpecifiedTests
      };
      const testAsyncRequest = {
        method: 'POST',
        url: `${mockConnection.tooling._baseUrl()}/runTestsAsynchronous`,
        body: JSON.stringify(requestOptions),
        headers: {
          'content-type': 'application/json'
        }
      };
      toolingRequestStub.withArgs(testAsyncRequest).returns(testRunId);

      // Mock the tooling query responses for polling
      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');

      // First call - initial test run status
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            AsyncApexJobId: testRunId,
            Status: ApexTestRunResultStatus.Queued,
            StartTime: testStartTime,
            TestTime: null,
            UserId: '005xx000000abcDAAU'
          }
        ]
      });

      // Second call - test queue items
      mockToolingQuery.onSecondCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: '7092M000000Vt94QAC',
            Status: ApexTestQueueItemStatus.Processing,
            ApexClassId: '01p2M00000O6tXZQAZ',
            TestRunResultId: '05m2M000000TgYuQAK'
          }
        ]
      });

      // Third call - test run summary after abort
      mockToolingQuery.onThirdCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            AsyncApexJobId: testRunId,
            Status: ApexTestRunResultStatus.Aborted,
            StartTime: testStartTime,
            TestTime: null,
            UserId: '005xx000000abcDAAU'
          }
        ]
      });

      const abortTestRunStub = $$.SANDBOX.stub(AsyncTests.prototype, 'abortTestRun').resolves();

      const cancellationTokenSource = new CancellationTokenSource();
      const testSrv = new TestService(mockConnection);
      const testPromise = testSrv.runTestAsynchronous(
        requestOptions,
        false,
        undefined,
        undefined,
        cancellationTokenSource.token,
        Duration.minutes(2)
      );

      // Wait for the test to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cancel the test
      await cancellationTokenSource.asyncCancel();

      // Wait for the test to complete
      await testPromise;

      sinon.assert.calledOnce(abortTestRunStub);
    });
  });

  describe('Format Test Errors', () => {
    it('should format test error when running asynchronous tests', async () => {
      const requestOptions: AsyncTestConfiguration = {
        classNames: 'TestSample',
        testLevel: TestLevel.RunSpecifiedTests
      };
      const testAsyncRequest = {
        method: 'POST',
        url: `${mockConnection.tooling._baseUrl()}/runTestsAsynchronous`,
        body: JSON.stringify(requestOptions),
        headers: {
          'content-type': 'application/json'
        }
      };
      toolingRequestStub.withArgs(testAsyncRequest).returns(testRunId);

      // Mock the tooling query responses
      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            AsyncApexJobId: testRunId,
            Status: ApexTestRunResultStatus.Queued,
            StartTime: testStartTime,
            TestTime: null,
            UserId: '005xx000000abcDAAU'
          }
        ]
      });
      mockToolingQuery.onSecondCall().rejects(new Error("sObject type 'ApexClass' is not supported."));

      const testSrv = new TestService(mockConnection);
      const errMsg = "sObject type 'ApexClass' is not supported.";
      $$.SANDBOX.stub(StreamingClient.prototype, 'handshake').throws(new Error(errMsg));
      try {
        await testSrv.runTestAsynchronous(
          {
            testLevel: TestLevel.RunLocalTests
          },
          false,
          false,
          undefined,
          undefined,
          Duration.minutes(2)
        );
        fail('Should have failed');
      } catch (e) {
        expect(formatSpy.calledOnce).toBe(true);
        expect(e.message).toContain(nls.localize('invalidsObjectErr', ['ApexClass', errMsg]));
      }
    });

    it('should format test error when building asynchronous payload', async () => {
      const errMsg = "sObject type 'PackageLicense' is not supported.";
      $$.SANDBOX.stub(utils, 'queryNamespaces').throws(new Error(errMsg));
      const testSrv = new TestService(mockConnection);
      try {
        await testSrv.buildAsyncPayload(TestLevel.RunSpecifiedTests, 'MyApexClass.MyTest');
        fail('Should have failed');
      } catch (e) {
        expect(formatSpy.calledOnce).toBe(true);
        expect(e.message).toContain(nls.localize('invalidsObjectErr', ['PackageLicense', errMsg]));
      }
    });
  });

  describe('Report Test Run Status', () => {
    it('should subscribe to test run for run still in progress', async () => {
      const asyncTestSrv = new AsyncTests(mockConnection);
      const mockToolingQueryProgress = $$.SANDBOX.stub(mockConnection.tooling, 'query');
      mockToolingQueryProgress
        .onFirstCall()
        .resolves({
          done: true,
          totalSize: 1,
          records: [
            {
              AsyncApexJobId: testRunId,
              Status: ApexTestRunResultStatus.Queued,
              StartTime: testStartTime,
              TestTime: null,
              UserId: '005xx000000abcDAAU'
            }
          ]
        })
        .onSecondCall()
        .resolves({
          done: true,
          totalSize: 1,
          records: [
            {
              AsyncApexJobId: testRunId,
              Status: ApexTestRunResultStatus.Completed,
              StartTime: testStartTime,
              TestTime: null,
              UserId: '005xx000000abcDAAU'
            }
          ]
        });
      const formatResultsStub = $$.SANDBOX.stub(asyncTestSrv, 'formatAsyncResults');
      const subscribeStub = $$.SANDBOX.stub(StreamingClient.prototype, 'subscribe').resolves({
        queueItem: {
          done: true,
          totalSize: 1,
          records: [
            {
              Status: ApexTestQueueItemStatus.Completed,
              Id: 'xxx',
              ApexClassId: 'xxxx',
              TestRunResultId: 'xxx'
            }
          ]
        } as ApexTestQueueItem,
        runId: testRunId
      });
      const handlerStub = $$.SANDBOX.stub(StreamingClient.prototype, 'handler');
      $$.SANDBOX.stub(StreamingClient.prototype, 'init');
      $$.SANDBOX.stub(StreamingClient.prototype, 'handshake');

      await asyncTestSrv.reportAsyncResults(testRunId);

      expect(mockToolingQueryProgress.calledTwice).toBe(true);
      expect(formatResultsStub.calledOnce).toBe(true);
      expect(subscribeStub.calledOnce).toBe(true);
      expect(handlerStub.notCalled).toBe(true);
    });

    it('should query for test run results if run is complete', async () => {
      const asyncTestSrv = new AsyncTests(mockConnection);
      const mockToolingQueryComplete = $$.SANDBOX.stub(mockConnection.tooling, 'query');
      mockToolingQueryComplete.onFirstCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            AsyncApexJobId: testRunId,
            Status: ApexTestRunResultStatus.Completed,
            StartTime: testStartTime,
            TestTime: null,
            UserId: '005xx000000abcDAAU'
          }
        ]
      });
      const formatResultsStub = $$.SANDBOX.stub(asyncTestSrv, 'formatAsyncResults');
      const subscribeStub = $$.SANDBOX.stub(StreamingClient.prototype, 'subscribe').resolves({
        queueItem: {
          done: true,
          totalSize: 1,
          records: [
            {
              Status: ApexTestQueueItemStatus.Completed,
              Id: 'xxx',
              ApexClassId: 'xxxx',
              TestRunResultId: 'xxx'
            }
          ]
        } as ApexTestQueueItem,
        runId: testRunId
      });
      const handlerStub = $$.SANDBOX.stub(StreamingClient.prototype, 'handler');
      $$.SANDBOX.stub(StreamingClient.prototype, 'init');
      $$.SANDBOX.stub(StreamingClient.prototype, 'handshake');

      await asyncTestSrv.reportAsyncResults(testRunId);

      expect(mockToolingQueryComplete.calledOnce).toBe(true);
      expect(formatResultsStub.calledOnce).toBe(true);
      expect(subscribeStub.notCalled).toBe(true);
      expect(handlerStub.calledOnce).toBe(true);
    });

    it('should format results with retrieved test run summary', async () => {
      const asyncTestSrv = new AsyncTests(mockConnection);
      const mockToolingQueryFormat = $$.SANDBOX.stub(mockConnection.tooling, 'query');
      mockToolingQueryFormat.onFirstCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            AsyncApexJobId: testRunId,
            Status: ApexTestRunResultStatus.Completed,
            StartTime: testStartTime,
            TestTime: null,
            UserId: '005xx000000abcDAAU'
          }
        ]
      });
      const formatResultsStub = $$.SANDBOX.stub(asyncTestSrv, 'formatAsyncResults');
      $$.SANDBOX.stub(StreamingClient.prototype, 'subscribe').resolves({
        queueItem: {
          done: true,
          totalSize: 1,
          records: [
            {
              Status: ApexTestQueueItemStatus.Completed,
              Id: 'xxx',
              ApexClassId: 'xxxx',
              TestRunResultId: 'xxx'
            }
          ]
        } as ApexTestQueueItem,
        runId: testRunId
      });
      const handlerStub = $$.SANDBOX.stub(StreamingClient.prototype, 'handler');
      $$.SANDBOX.stub(StreamingClient.prototype, 'init');
      $$.SANDBOX.stub(StreamingClient.prototype, 'handshake');

      await asyncTestSrv.reportAsyncResults(testRunId);

      expect(formatResultsStub.calledOnce).toBe(true);
      expect(handlerStub.calledOnce).toBe(true);
    });
  });

  describe('Supports Test Setup Feature', () => {
    it("should verify org's api version supports test setup feature", async () => {
      const asyncTests = new AsyncTests(mockConnection);
      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');

      const fieldExists = await asyncTests.supportsTestSetupFeature();
      expect(fieldExists).toBe(true);
      expect(retrieveMaxApiVersionStub.calledOnce).toBe(true);

      const mockQueryResult = {
        done: true,
        totalSize: 1,
        records: [
          {
            Status: 'Completed',
            ClassesCompleted: 5,
            ClassesEnqueued: 5,
            MethodsEnqueued: 5,
            StartTime: '2021-01-01T00:00:00Z',
            EndTime: '2021-01-01T00:10:00Z',
            TestTime: 600_000,
            UserId: 'someUserId'
          }
        ]
      };

      mockToolingQuery.resolves(mockQueryResult);

      const runStatusResult = await asyncTests.checkRunStatus(testRunId);

      expect(runStatusResult.testsComplete).toBe(true);
      expect(runStatusResult.testRunSummary).toEqual(mockQueryResult.records[0]);
      expect(mockToolingQuery.calledOnce).toBe(true);

      const expectedQueryWithTestSetupTime = `SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, MethodsEnqueued, StartTime, EndTime, TestTime, TestSetupTime, UserId FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;
      expect(mockToolingQuery.getCall(0).args[0]).toBe(expectedQueryWithTestSetupTime);
    });
    it('should handle absence of TestSetupTime field and modify query accordingly', async () => {
      retrieveMaxApiVersionStub.resolves('60.0');
      const asyncTests = new AsyncTests(mockConnection);
      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');

      const fieldExists = await asyncTests.supportsTestSetupFeature();

      expect(fieldExists).toBe(false);
      expect(retrieveMaxApiVersionStub.calledOnce).toBe(true);

      const mockQueryResult = {
        done: true,
        totalSize: 1,
        records: [
          {
            Status: 'Completed',
            ClassesCompleted: 5,
            ClassesEnqueued: 5,
            MethodsEnqueued: 5,
            StartTime: '2021-01-01T00:00:00Z',
            EndTime: '2021-01-01T00:10:00Z',
            TestTime: 600_000,
            UserId: 'someUserId'
          }
        ]
      };

      mockToolingQuery.resolves(mockQueryResult);

      const runStatusResult = await asyncTests.checkRunStatus(testRunId);

      expect(runStatusResult.testsComplete).toBe(true);
      expect(runStatusResult.testRunSummary).toEqual(mockQueryResult.records[0]);
      expect(mockToolingQuery.calledOnce).toBe(true);

      const expectedQueryWithoutTestSetupTime = `SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, MethodsEnqueued, StartTime, EndTime, TestTime, UserId FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;
      expect(mockToolingQuery.getCall(0).args[0]).toBe(expectedQueryWithoutTestSetupTime);
    });
  });

  describe('Polling Client Timeout', () => {
    it('should return test run ID when polling client times out', async () => {
      const requestOptions: AsyncTestConfiguration = {
        classNames: 'TestSample',
        testLevel: TestLevel.RunSpecifiedTests
      };
      const testAsyncRequest = {
        method: 'POST',
        url: `${mockConnection.tooling._baseUrl()}/runTestsAsynchronous`,
        body: JSON.stringify(requestOptions),
        headers: {
          'content-type': 'application/json'
        }
      };
      toolingRequestStub.withArgs(testAsyncRequest).returns(testRunId);

      // Mock the tooling query to return a status that will keep polling
      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            AsyncApexJobId: testRunId,
            Status: ApexTestRunResultStatus.Queued,
            StartTime: testStartTime,
            TestTime: null,
            UserId: '005xx000000abcDAAU'
          }
        ]
      });
      mockToolingQuery.onSecondCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: '7092M000000Vt94QAC',
            Status: ApexTestQueueItemStatus.Processing,
            ApexClassId: '01p2M00000O6tXZQAZ',
            TestRunResultId: '05m2M000000TgYuQAK'
          }
        ]
      });

      // Mock the logger to capture the info message
      const loggerStub = $$.SANDBOX.stub(Logger.prototype, 'info');
      const debugStub = $$.SANDBOX.stub(Logger.prototype, 'debug');

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.runTestAsynchronous(
        requestOptions,
        false,
        false,
        undefined,
        undefined,
        Duration.milliseconds(10) // Very short timeout to trigger timeout quickly
      );

      // Verify that the result contains the test run ID
      expect(result).toHaveProperty('testRunId');
      expect((result as TestRunIdResult).testRunId).toBe(testRunId);

      // Verify that the debug message was logged
      sinon.assert.calledWith(debugStub, sinon.match.string.and(sinon.match(testRunId)));

      // Verify that the info message with the command was logged
      const username = mockConnection.getUsername();
      sinon.assert.calledWith(loggerStub, nls.localize('runTestReportCommand', [testRunId, username ?? '']));
    });

    it('should handle PollingClientTimeout error gracefully', async () => {
      const requestOptions: AsyncTestConfiguration = {
        classNames: 'TestSample',
        testLevel: TestLevel.RunSpecifiedTests
      };
      const testAsyncRequest = {
        method: 'POST',
        url: `${mockConnection.tooling._baseUrl()}/runTestsAsynchronous`,
        body: JSON.stringify(requestOptions),
        headers: {
          'content-type': 'application/json'
        }
      };
      toolingRequestStub.withArgs(testAsyncRequest).returns(testRunId);

      // Mock the tooling query to return a status that will keep polling
      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            AsyncApexJobId: testRunId,
            Status: ApexTestRunResultStatus.Queued,
            StartTime: testStartTime,
            TestTime: null,
            UserId: '005xx000000abcDAAU'
          }
        ]
      });
      mockToolingQuery.onSecondCall().resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: '7092M000000Vt94QAC',
            Status: ApexTestQueueItemStatus.Processing,
            ApexClassId: '01p2M00000O6tXZQAZ',
            TestRunResultId: '05m2M000000TgYuQAK'
          }
        ]
      });

      // Mock the logger to capture the info message
      const loggerStub = $$.SANDBOX.stub(Logger.prototype, 'info');
      const debugStub = $$.SANDBOX.stub(Logger.prototype, 'debug');

      const testSrv = new TestService(mockConnection);

      // This should not throw an error, even though the polling client times out
      const result = await testSrv.runTestAsynchronous(
        requestOptions,
        false,
        false,
        undefined,
        undefined,
        Duration.milliseconds(10) // Very short timeout to trigger timeout quickly
      );

      // Verify that the result is a TestRunIdResult
      expect(result).toHaveProperty('testRunId');
      expect((result as TestRunIdResult).testRunId).toBe(testRunId);

      // Verify that the appropriate messages were logged
      sinon.assert.calledWith(debugStub, sinon.match.string.and(sinon.match(testRunId)));

      const username = mockConnection.getUsername();
      sinon.assert.calledWith(loggerStub, nls.localize('runTestReportCommand', [testRunId, username ?? '']));
    });
  });

  describe('run Apex and Flow tests in the same test run', () => {
    let asyncTests: AsyncTests;

    beforeEach(() => {
      asyncTests = new AsyncTests(mockConnection);
    });
    it('should query the correct test results objects depending on the category', async () => {
      const testQueueResult = {
        done: true,
        totalSize: 3,
        records: [
          {
            Id: 'apex1',
            ApexClassId: '01p000000000001',
            Status: ApexTestQueueItemStatus.Completed,
            TestRunResultId: 'result1'
          } as ApexTestQueueItemRecord,
          {
            Id: 'flow1',
            ApexClassId: null,
            Status: ApexTestQueueItemStatus.Completed,
            TestRunResultId: 'result2'
          } as ApexTestQueueItemRecord,
          {
            Id: 'apex2',
            ApexClassId: '01p000000000002',
            Status: ApexTestQueueItemStatus.Completed,
            TestRunResultId: 'result3'
          } as ApexTestQueueItemRecord
        ]
      };

      // Mock responses for Apex tests
      const mockApexResults = {
        done: true,
        totalSize: 2,
        records: [
          {
            Id: 'apexResult1',
            QueueItemId: 'apex1',
            StackTrace: null as string | null,
            Message: null as string | null,
            RunTime: 100,
            TestTimestamp: '2023-01-01T10:00:00.000Z',
            AsyncApexJobId: 'job1',
            MethodName: 'testMethod1',
            Outcome: 'Pass',
            ApexLogId: null as string | null,
            ApexClass: {
              Id: '01p000000000001',
              Name: 'TestClass1',
              NamespacePrefix: null as string | null
            }
          },
          {
            Id: 'apexResult2',
            QueueItemId: 'apex2',
            StackTrace: null as string | null,
            Message: null as string | null,
            RunTime: 150,
            TestTimestamp: '2023-01-01T10:00:00.000Z',
            AsyncApexJobId: 'job1',
            MethodName: 'testMethod2',
            Outcome: 'Pass',
            ApexLogId: null as string | null,
            ApexClass: {
              Id: '01p000000000002',
              Name: 'TestClass2',
              NamespacePrefix: null as string | null
            }
          }
        ]
      };

      // Mock responses for Flow tests
      const mockFlowResults = {
        done: true,
        totalSize: 1,
        records: [
          {
            Id: 'flowResult1',
            ApexTestQueueItemId: 'flow1',
            Result: 'Pass',
            TestStartDateTime: '2023-01-01T10:00:00.000Z',
            TestEndDateTime: '2023-01-01T10:00:05.000Z',
            FlowTest: { DeveloperName: 'TestFlow' },
            FlowDefinition: {
              DeveloperName: 'MyFlow',
              NamespacePrefix: null as string | null
            }
          }
        ]
      };

      // Setup mock to return different results based on query type
      const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
      mockToolingQuery
        .withArgs(sinon.match(/ApexTestResult/))
        .resolves(mockApexResults)
        .withArgs(sinon.match(/FlowTestResult/))
        .resolves(mockFlowResults);

      // Execute the test
      const results = await asyncTests.getAsyncTestResults(testQueueResult);

      // Verify that both queries were executed
      expect(mockToolingQuery.calledTwice).toBe(true);

      // Verify ApexTestResult query was called correctly
      const apexQuery = mockToolingQuery.getCalls().find(call => call.args[0].includes('ApexTestResult'));
      expect(apexQuery).toBeDefined();
      expect(apexQuery!.args[0]).toContain('FROM ApexTestResult');
      expect(apexQuery!.args[0]).toContain('WHERE QueueItemId IN');
      expect(apexQuery!.args[0]).toContain("'apex1'");
      expect(apexQuery!.args[0]).toContain("'apex2'");
      expect(apexQuery!.args[0]).not.toContain("'flow1'"); // Flow test should not be in Apex query

      // Verify FlowTestResult query was called correctly
      const flowQuery = mockToolingQuery.getCalls().find(call => call.args[0].includes('FlowTestResult'));
      expect(flowQuery).toBeDefined();
      expect(flowQuery!.args[0]).toContain('FROM FlowTestResult');
      expect(flowQuery!.args[0]).toContain('WHERE ApexTestQueueItemId IN');
      expect(flowQuery!.args[0]).toContain("'flow1'");
      expect(flowQuery!.args[0]).not.toContain("'apex1'"); // Apex tests should not be in Flow query
      expect(flowQuery!.args[0]).not.toContain("'apex2'"); // Apex tests should not be in Flow query

      // Verify results structure and categories
      expect(results).toHaveLength(2);

      const apexResult = results.find((r: any) => r.category === TestCategory.Apex);
      expect(apexResult).toBeDefined();
      expect(apexResult!.records).toHaveLength(2);

      const flowResult = results.find((r: any) => r.category === TestCategory.Flow);
      expect(flowResult).toBeDefined();
      expect(flowResult!.records).toHaveLength(1);
    });
  });
});

describe('elapsedTime', () => {
  let sandbox: sinon.SinonSandbox;
  let loggerStub: sinon.SinonStubbedInstance<Logger>;
  let loggerChildStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    loggerStub = sandbox.stub(Logger.prototype);
    loggerChildStub = sandbox.stub(Logger, 'childFromRoot').returns(loggerStub);
    loggerStub.shouldLog.returns(true);
  });

  afterEach(() => {
    sandbox.restore();
    delete process.env.SF_LOG_LEVEL;
  });

  it('should log the entry and exit of the method', () => {
    class DummyClass {
      @elapsedTime()
      dummyMethod() {
        return 'dummyResult';
      }
    }

    const dummyInstance = new DummyClass();
    dummyInstance.dummyMethod();

    // loggerStub is a SinonStubbedInstance; .debug is a stub, not an unbound method
    // eslint-disable-next-line jest/unbound-method
    const debugStub = loggerStub.debug as sinon.SinonStub;
    sinon.assert.calledOnce(loggerChildStub);
    sinon.assert.calledWith(loggerChildStub, 'elapsedTime');
    sinon.assert.callOrder(debugStub, debugStub);
    sinon.assert.calledWith(debugStub, sinon.match.has('msg', 'DummyClass.dummyMethod - enter'));
    sinon.assert.calledWith(debugStub, sinon.match.has('msg', 'DummyClass.dummyMethod - exit'));
  });

  it('should throw the error if the method throws an error', () => {
    class DummyClass {
      @elapsedTime()
      dummyMethod() {
        throw new Error('dummyError');
      }
    }

    const dummyInstance = new DummyClass();

    expect(() => dummyInstance.dummyMethod()).toThrow('dummyError');
  });
});

describe('Create Result Files', () => {
  let testServiceSpy: sinon.SinonSpy;
  let junitSpy: sinon.SinonSpy;
  let tapSpy: sinon.SinonSpy;
  let writeFileSpy: sinon.SinonSpy;
  let sandboxStub1: sinon.SinonSandbox;

  beforeEach(async () => {
    sandboxStub1 = sinon.createSandbox();
    sandboxStub1.stub(fs, 'stat');
    sandboxStub1.stub(fs, 'mkdir');
    writeFileSpy = sandboxStub1.stub(fs, 'writeFile');
    // sandboxStub1.stub(fs, 'close');
    sandboxStub1.stub(fs, 'open');
    testServiceSpy = sandboxStub1.stub(TestService.prototype, 'createStream').returns(
      new Writable({
        write(chunk: unknown, encoding, callback) {
          callback();
        }
      })
    );
    junitSpy = sandboxStub1.spy(JUnitFormatTransformer.prototype, 'format');
    tapSpy = sandboxStub1.spy(TapFormatTransformer.prototype, 'format');
  });

  afterEach(() => {
    sandboxStub1.restore();
  });

  it('should create test-run-id.txt if no result format nor fileInfos are specified', async () => {
    const config = {
      dirPath: 'path/to/directory'
    } as OutputDirConfig;
    const testSrv = new TestService(mockConnection);
    await testSrv.writeResultFiles(testResultData, config);

    expect(writeFileSpy.calledWith(join(config.dirPath, 'test-run-id.txt'))).toBe(true);
    expect(testServiceSpy.callCount).toBe(0);
  });

  it('should still create test-run-id.txt if result format is specified with TestRunId result', async () => {
    const config = {
      dirPath: 'path/to/directory',
      resultFormats: [ResultFormat.tap]
    };

    const testSrv = new TestService(mockConnection);
    await testSrv.writeResultFiles({ testRunId } as TestRunIdResult, config, false);

    expect(writeFileSpy.calledWith(join(config.dirPath, 'test-run-id.txt'))).toBe(true);
    expect(testServiceSpy.callCount).toBe(0);
  });

  it('should still create test-run-id.txt if code coverage is specified with TestRunId result', async () => {
    const config = {
      dirPath: 'path/to/directory'
    };

    const testSrv = new TestService(mockConnection);

    await testSrv.writeResultFiles({ testRunId } as TestRunIdResult, config, true);

    expect(writeFileSpy.calledWith(join(config.dirPath, 'test-run-id.txt'))).toBe(true);
    expect(testServiceSpy.callCount).toBe(0);
  });

  it('should create the json files if json result format is specified', async () => {
    const config = {
      dirPath: 'path/to/directory',
      resultFormats: [ResultFormat.json]
    } as OutputDirConfig;
    const testSrv = new TestService(mockConnection);
    await testSrv.writeResultFiles(testResultData, config);

    expect(testServiceSpy.calledWith(join(config.dirPath, `test-result-${testRunId}.json`))).toBe(true);
    expect(testServiceSpy.callCount).toBe(1);
  });

  it('should create the junit result files if junit result format is specified', async () => {
    const config = {
      dirPath: 'path/to/directory',
      resultFormats: [ResultFormat.junit]
    } as OutputDirConfig;
    const testSrv = new TestService(mockConnection);
    await testSrv.writeResultFiles(testResultData, config);

    expect(testServiceSpy.calledWith(join(config.dirPath, `test-result-${testRunId}-junit.xml`))).toBe(true);
    expect(junitSpy.calledOnce).toBe(true);
    expect(testServiceSpy.callCount).toBe(1);
  });

  it('should create the tap result files if result format is specified', async () => {
    const config = {
      dirPath: 'path/to/directory',
      resultFormats: [ResultFormat.tap]
    } as OutputDirConfig;
    const testSrv = new TestService(mockConnection);
    await testSrv.writeResultFiles(testResultData, config);

    expect(testServiceSpy.calledWith(join(config.dirPath, `test-result-${testRunId}-tap.txt`))).toBe(true);
    expect(tapSpy.calledOnce).toBe(true);
    expect(testServiceSpy.callCount).toBe(1);
  });

  it('should throw an error if unexpected type is specified for result format', async () => {
    const config = {
      dirPath: 'path/to/directory',
      resultFormats: ['rando']
    };
    const testSrv = new TestService(mockConnection);
    try {
      // @ts-ignore
      await testSrv.writeResultFiles(testResultData, config, true);
      fail();
    } catch (e) {
      expect(e.message).toBe('Specified result formats must be of type json, junit, or tap');
    }
  });

  it('should create code coverage files if set to true', async () => {
    const config = {
      dirPath: 'path/to/directory'
    } as OutputDirConfig;
    const testSrv = new TestService(mockConnection);
    await testSrv.writeResultFiles(testResultData, config, true);

    expect(testServiceSpy.calledWith(join(config.dirPath, `test-result-${testRunId}-codecoverage.json`))).toBe(true);
    expect(testServiceSpy.callCount).toBe(1);
  });

  it('should create any files provided in fileInfos', async () => {
    const config = {
      dirPath: 'path/to/directory',
      fileInfos: [{ filename: 'test-result-myFile.json', content: { summary: {} } }]
    } as OutputDirConfig;
    const testSrv = new TestService(mockConnection);
    await testSrv.writeResultFiles(testResultData, config);

    expect(testServiceSpy.calledWith(join(config.dirPath, 'test-result-myFile.json'))).toBe(true);
    expect(testServiceSpy.callCount).toBe(1);
  });
});
