/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { assert, expect } from 'chai';
import {
  assert as sinonAssert,
  createSandbox,
  SinonSandbox,
  SinonSpy,
  SinonStub
} from 'sinon';
import { TestService, OutputDirConfig } from '../../src/tests';
import {
  AsyncTestConfiguration,
  TestLevel,
  ApexTestQueueItemStatus,
  ApexTestResultOutcome,
  ApexTestQueueItem,
  ApexTestRunResultStatus,
  ApexTestRunResult,
  ApexTestResult,
  ApexOrgWideCoverage,
  ApexCodeCoverageAggregate,
  ApexCodeCoverage,
  ApexTestQueueItemRecord,
  ResultFormat
} from '../../src/tests/types';
import { AsyncTestRun, StreamingClient } from '../../src/streaming';
import { fail } from 'assert';
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
  skippedTestData
} from './testData';
import { join } from 'path';
import * as stream from 'stream';
import * as fs from 'fs';
import {
  JUnitReporter,
  TapReporter,
  Progress,
  ApexTestProgressValue
} from '../../src';

const $$ = testSetup();
let mockConnection: Connection;
let sandboxStub: SinonSandbox;
let toolingRequestStub: SinonStub;
const testData = new MockTestOrgData();

describe('Run Apex tests asynchronously', () => {
  let timeStub: SinonStub;
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

  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    sandboxStub
      .stub(Connection.prototype, 'retrieveMaxApiVersion')
      .resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sandboxStub.stub(mockConnection, 'instanceUrl').get(() => {
      return 'https://na139.salesforce.com';
    });
    timeStub = sandboxStub
      .stub(Date.prototype, 'getTime')
      .onFirstCall()
      .returns(6000);
    timeStub.onSecondCall().returns(8000);
    testResultData.summary.orgId = mockConnection.getAuthInfoFields().orgId;
    testResultData.summary.username = mockConnection.getUsername();
    toolingRequestStub = sandboxStub.stub(mockConnection.tooling, 'request');
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should run a successful test', async () => {
    const asyncResult = {
      runId: testRunId,
      queueItem: pollResponse
    } as AsyncTestRun;
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
    sandboxStub
      .stub(StreamingClient.prototype, 'subscribe')
      .resolves(asyncResult);
    const testSrv = new TestService(mockConnection);
    const mockTestResultData = sandboxStub
      .stub(testSrv, 'formatAsyncResults')
      .resolves(testResultData);
    sandboxStub.stub(StreamingClient.prototype, 'handshake').resolves();
    const testResult = await testSrv.runTestAsynchronous(requestOptions);
    expect(testResult).to.be.a('object');
    expect(mockTestResultData.calledOnce).to.equal(true);
    expect(mockTestResultData.getCall(0).args[0]).to.equal(
      asyncResult.queueItem
    );
    expect(mockTestResultData.getCall(0).args[1]).to.equal(asyncResult.runId);
    expect(testResult).to.equal(testResultData);
  });

  it('should throw an error on refresh token issue', async () => {
    const requestOptions: AsyncTestConfiguration = {
      classNames: 'TestSample',
      testLevel: TestLevel.RunSpecifiedTests
    };

    sandboxStub
      .stub(StreamingClient.prototype, 'init')
      .throwsException('No access token');
    const testSrv = new TestService(mockConnection);
    try {
      await testSrv.runTestAsynchronous(requestOptions);
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.name).to.equal('No access token');
    }
  });

  it('should return formatted test results', async () => {
    missingTimeTestData.summary.orgId = mockConnection.getAuthInfoFields().orgId;
    missingTimeTestData.summary.username = mockConnection.getUsername();
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
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
    } as ApexTestRunResult);

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
    } as ApexTestResult);

    const getTestResultData = await testSrv.formatAsyncResults(
      pollResponse,
      testRunId,
      new Date().getTime()
    );

    let summaryQuery =
      'SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, ';
    summaryQuery += 'MethodsEnqueued, StartTime, EndTime, TestTime, UserId ';
    summaryQuery += `FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;
    expect(mockToolingQuery.getCall(0).args[0]).to.equal(summaryQuery);

    let testResultQuery = 'SELECT Id, QueueItemId, StackTrace, Message, ';
    testResultQuery +=
      'RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, ';
    testResultQuery +=
      'ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix ';
    testResultQuery += `FROM ApexTestResult WHERE QueueItemId IN ('${pollResponse.records[0].Id}')`;
    expect(mockToolingQuery.getCall(1).args[0]).to.equal(testResultQuery);
    expect(getTestResultData).to.deep.equals(missingTimeTestData);
  });

  it('should report progress for formatting async results', async () => {
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
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
    } as ApexTestRunResult);
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
    } as ApexTestResult);
    const reportStub = sandboxStub.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };

    await testSrv.formatAsyncResults(
      pollResponse,
      testRunId,
      new Date().getTime(),
      false,
      progressReporter
    );

    sinonAssert.calledOnce(reportStub);
    sinonAssert.calledWith(reportStub, {
      type: 'FormatTestResultProgress',
      value: 'retrievingTestRunSummary',
      message: nls.localize('retrievingTestRunSummary')
    });
  });

  it('should return correct summary outcome for single skipped test', async () => {
    skippedTestData.summary.orgId = mockConnection.getAuthInfoFields().orgId;
    skippedTestData.summary.username = mockConnection.getUsername();
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
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
    } as ApexTestRunResult);

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
          Outcome: ApexTestResultOutcome.Skip,
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
    } as ApexTestResult);

    const getTestResultData = await testSrv.formatAsyncResults(
      pollResponse,
      testRunId,
      new Date().getTime()
    );

    let summaryQuery =
      'SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, ';
    summaryQuery += 'MethodsEnqueued, StartTime, EndTime, TestTime, UserId ';
    summaryQuery += `FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;
    expect(mockToolingQuery.getCall(0).args[0]).to.equal(summaryQuery);

    let testResultQuery = 'SELECT Id, QueueItemId, StackTrace, Message, ';
    testResultQuery +=
      'RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, ';
    testResultQuery +=
      'ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix ';
    testResultQuery += `FROM ApexTestResult WHERE QueueItemId IN ('${pollResponse.records[0].Id}')`;
    expect(mockToolingQuery.getCall(1).args[0]).to.equal(testResultQuery);
    expect(getTestResultData).to.deep.equals(skippedTestData);
  });

  it('should return formatted test results with diagnostics', async () => {
    diagnosticResult.summary.orgId = mockConnection.getAuthInfoFields().orgId;
    diagnosticResult.summary.username = mockConnection.getUsername();
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
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
    } as ApexTestRunResult);

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
    } as ApexTestResult);

    const getTestResultData = await testSrv.formatAsyncResults(
      pollResponse,
      testRunId,
      new Date().getTime()
    );

    expect(getTestResultData).to.deep.equals(diagnosticResult);
  });

  it('should return failed test results with missing error info', async () => {
    diagnosticFailure.summary.orgId = mockConnection.getAuthInfoFields().orgId;
    diagnosticFailure.summary.username = mockConnection.getUsername();
    diagnosticFailure.tests[0].diagnostic.className = undefined;
    diagnosticFailure.tests[0].diagnostic.exceptionStackTrace = undefined;
    diagnosticFailure.tests[0].stackTrace = undefined;
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
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
    } as ApexTestRunResult);

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
    } as ApexTestResult);

    const getTestResultData = await testSrv.formatAsyncResults(
      pollResponse,
      testRunId,
      new Date().getTime()
    );

    expect(getTestResultData).to.deep.equals(diagnosticFailure);
  });

  it('should return an error if no test results are found', async () => {
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    } as ApexTestRunResult);

    try {
      await testSrv.formatAsyncResults(
        pollResponse,
        testRunId,
        new Date().getTime()
      );
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('noTestResultSummary', testRunId)
      );
    }
  });

  it('should return an error if invalid test run id was provided', async () => {
    const invalidId = '000000xxxxx';
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    } as ApexTestRunResult);

    try {
      await testSrv.formatAsyncResults(
        pollResponse,
        invalidId,
        new Date().getTime()
      );
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('invalidTestRunIdErr', invalidId)
      );
    }
  });

  it('should return an error if invalid test run id prefix was provided', async () => {
    const invalidId = '708000000xxxxxx';
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    } as ApexTestRunResult);

    try {
      await testSrv.formatAsyncResults(
        pollResponse,
        invalidId,
        new Date().getTime()
      );
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('invalidTestRunIdErr', invalidId)
      );
    }
  });

  it('should return formatted test results with code coverage', async () => {
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onCall(0).resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          AsyncApexJobId: testRunId,
          Status: ApexTestRunResultStatus.Completed,
          StartTime: '2020-07-12T02:54:47.000+0000',
          TestTime: 1765,
          UserId: '005xx000000abcDAAU'
        }
      ]
    } as ApexTestRunResult);

    mockToolingQuery.onCall(1).resolves({
      done: true,
      totalSize: 6,
      records: mixedTestResults
    } as ApexTestResult);

    mockToolingQuery.onCall(2).resolves({
      done: true,
      totalSize: 3,
      records: mixedPerClassCodeCoverage
    } as ApexCodeCoverage);

    mockToolingQuery.onCall(3).resolves({
      done: true,
      totalSize: 3,
      records: codeCoverageQueryResult
    } as ApexCodeCoverageAggregate);

    mockToolingQuery.onCall(4).resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          PercentCovered: '57'
        }
      ]
    } as ApexOrgWideCoverage);

    const getTestResultData = await testSrv.formatAsyncResults(
      pollResponse,
      testRunId,
      new Date().getTime(),
      true
    );

    // verify summary data
    expect(getTestResultData.summary.failRate).to.equal('33%');
    expect(getTestResultData.summary.testsRan).to.equal(6);
    expect(getTestResultData.summary.orgId).to.equal(
      mockConnection.getAuthInfoFields().orgId
    );
    expect(getTestResultData.summary.outcome).to.equal('Failed');
    expect(getTestResultData.summary.passRate).to.equal('50%');
    expect(getTestResultData.summary.skipRate).to.equal('17%');
    expect(getTestResultData.summary.username).to.equal(
      mockConnection.getUsername()
    );
    expect(getTestResultData.summary.orgWideCoverage).to.equal('57%');
    expect(getTestResultData.summary.testRunCoverage).to.equal('66%');
    expect(getTestResultData.tests.length).to.equal(6);
    expect(getTestResultData.codecoverage.length).to.equal(3);
  });

  it('should report progress for aggregating code coverage', () => {
    it('should return formatted test results with code coverage', async () => {
      const testSrv = new TestService(mockConnection);
      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      mockToolingQuery.onCall(0).resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            AsyncApexJobId: testRunId,
            Status: ApexTestRunResultStatus.Completed,
            StartTime: '2020-07-12T02:54:47.000+0000',
            TestTime: 1765,
            UserId: '005xx000000abcDAAU'
          }
        ]
      } as ApexTestRunResult);

      mockToolingQuery.onCall(1).resolves({
        done: true,
        totalSize: 6,
        records: mixedTestResults
      } as ApexTestResult);

      mockToolingQuery.onCall(2).resolves({
        done: true,
        totalSize: 3,
        records: mixedPerClassCodeCoverage
      } as ApexCodeCoverage);

      mockToolingQuery.onCall(3).resolves({
        done: true,
        totalSize: 3,
        records: codeCoverageQueryResult
      } as ApexCodeCoverageAggregate);

      mockToolingQuery.onCall(4).resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            PercentCovered: '57'
          }
        ]
      } as ApexOrgWideCoverage);

      const reportStub = sandboxStub.stub();
      const progressReporter: Progress<ApexTestProgressValue> = {
        report: reportStub
      };

      await testSrv.formatAsyncResults(
        pollResponse,
        testRunId,
        new Date().getTime(),
        true,
        progressReporter
      );

      sinonAssert.calledTwice(reportStub);
      sinonAssert.calledWith(reportStub, {
        type: 'FormatTestResultProgress',
        value: 'retrievingTestRunSummary',
        message: nls.localize('retrievingTestRunSummary')
      });
      sinonAssert.calledWith(reportStub, {
        type: 'FormatTestResultProgress',
        value: 'queryingForAggregateCodeCoverage',
        message: nls.localize('queryingForAggregateCodeCoverage')
      });
    });
  });

  describe('Check Query Limits', async () => {
    const queryStart =
      'SELECT Id, QueueItemId, StackTrace, Message, RunTime, TestTimestamp, AsyncApexJobId, MethodName, Outcome, ApexLogId, ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix FROM ApexTestResult WHERE QueueItemId IN ';

    const record = {
      Id: '7092M000000Vt94QAC',
      Status: ApexTestQueueItemStatus.Completed,
      ApexClassId: '01p2M00000O6tXZQAZ',
      TestRunResultId: '05m2M000000TgYuQAK'
    };
    const records: ApexTestQueueItemRecord[] = [];
    const queryIds: string[] = [];
    let count = 700;
    while (count > 0) {
      records.push(record);
      queryIds.push(record.Id);
      count--;
    }

    const testQueueItems: ApexTestQueueItem = {
      done: true,
      totalSize: 700,
      records
    };

    it('should split into multiple queries if query is longer than char limit', async () => {
      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 600,
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
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);
      mockToolingQuery.onSecondCall().resolves({
        done: true,
        totalSize: 100,
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
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.getAsyncTestResults(testQueueItems);

      expect(mockToolingQuery.calledTwice).to.be.true;
      expect(result.length).to.eql(2);
    });

    it('should make a single api call if query is under char limit', async () => {
      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      mockToolingQuery.onFirstCall().resolves({
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
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.getAsyncTestResults(pollResponse);

      expect(mockToolingQuery.calledOnce).to.be.true;
      expect(result.length).to.eql(1);
    });

    it('should format multiple queries correctly', async () => {
      const queryOneIds = queryIds.slice(0, 120).join("','");
      const queryOne = `${queryStart}('${queryOneIds}')`;
      const queryTwoIds = queryIds.slice(120).join("','");
      const queryTwo = `${queryStart}('${queryTwoIds}')`;

      const testQueueItems: ApexTestQueueItem = {
        done: true,
        totalSize: 700,
        records
      };

      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 600,
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
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);
      mockToolingQuery.onSecondCall().resolves({
        done: true,
        totalSize: 100,
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
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.getAsyncTestResults(testQueueItems);

      expect(mockToolingQuery.calledTwice).to.be.true;
      expect(result.length).to.eql(2);
      expect(mockToolingQuery.calledWith(queryOne)).to.be.true;
      expect(mockToolingQuery.calledWith(queryTwo)).to.be.true;
    });

    it('should format query at query limit correctly', async () => {
      const record = {
        Id: '7092M000000Vt94QAC',
        Status: ApexTestQueueItemStatus.Completed,
        ApexClassId: '01p2M00000O6tXZQAZ',
        TestRunResultId: '05m2M000000TgYuQAK'
      };

      const queryOneIds = queryIds.slice(0, 120).join("','");
      const queryOne = `${queryStart}('${queryOneIds}')`;

      const testQueueItems: ApexTestQueueItem = {
        done: true,
        totalSize: 700,
        records
      };

      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      mockToolingQuery.onFirstCall().resolves({
        done: true,
        totalSize: 600,
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
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);
      mockToolingQuery.onSecondCall().resolves({
        done: true,
        totalSize: 100,
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
            RunTime: 8,
            TestTimestamp: '3'
          }
        ]
      } as ApexTestResult);

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.getAsyncTestResults(testQueueItems);

      expect(mockToolingQuery.calledTwice).to.be.true;
      expect(result.length).to.eql(2);
      expect(mockToolingQuery.calledWith(queryOne)).to.be.true;
      expect(mockToolingQuery.calledWith(`${queryStart}('${record.Id}')`));
    });

    it('should format single query correctly', async () => {
      const mockToolingQuery = sandboxStub.stub(
        mockConnection.tooling,
        'query'
      );
      const id = '7092M000000Vt94QAC';
      mockToolingQuery.onFirstCall().resolves({
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
      } as ApexTestResult);
      const singleQuery = `${queryStart}('${id}')`;

      const testSrv = new TestService(mockConnection);
      const result = await testSrv.getAsyncTestResults(pollResponse);

      expect(mockToolingQuery.calledOnce).to.be.true;
      expect(mockToolingQuery.calledWith(singleQuery)).to.be.true;
      expect(result.length).to.eql(1);
    });
  });

  describe('Create Result Files', () => {
    let createStreamStub: SinonStub;
    let stringifySpy: SinonSpy;
    let junitSpy: SinonSpy;
    let tapSpy: SinonSpy;
    let sandboxStub1: SinonSandbox;

    beforeEach(async () => {
      sandboxStub1 = createSandbox();
      sandboxStub1.stub(fs, 'existsSync').returns(true);
      sandboxStub1.stub(fs, 'mkdirSync');
      createStreamStub = sandboxStub1.stub(fs, 'createWriteStream');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createStreamStub.returns(new stream.PassThrough() as any);
      sandboxStub1.stub(fs, 'closeSync');
      sandboxStub1.stub(fs, 'openSync');
      stringifySpy = sandboxStub1.spy(TestService.prototype, 'stringify');
      junitSpy = sandboxStub1.spy(JUnitReporter.prototype, 'format');
      tapSpy = sandboxStub1.spy(TapReporter.prototype, 'format');
    });

    afterEach(() => {
      timeStub.restore();
      sandboxStub1.restore();
    });

    it('should only create test-run-id.txt if no result format nor fileInfos are specified', async () => {
      const config = {
        dirPath: 'path/to/directory'
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config);

      expect(
        createStreamStub.calledWith(join(config.dirPath, 'test-run-id.txt'))
      ).to.be.true;
      expect(createStreamStub.callCount).to.eql(1);
    });

    it('should create the json files if json result format is specified', async () => {
      const config = {
        dirPath: 'path/to/directory',
        resultFormats: [ResultFormat.json]
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config);

      expect(
        createStreamStub.calledWith(
          join(config.dirPath, `test-result-${testRunId}.json`)
        )
      ).to.be.true;
      expect(stringifySpy.calledOnce).to.be.true;
      expect(createStreamStub.callCount).to.eql(2);
    });

    it('should create the junit result files if junit result format is specified', async () => {
      const config = {
        dirPath: 'path/to/directory',
        resultFormats: [ResultFormat.junit]
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config);

      expect(
        createStreamStub.calledWith(
          join(config.dirPath, `test-result-${testRunId}-junit.xml`)
        )
      ).to.be.true;
      expect(junitSpy.calledOnce).to.be.true;
      expect(createStreamStub.callCount).to.eql(2);
    });

    it('should create the tap result files if result format is specified', async () => {
      const config = {
        dirPath: 'path/to/directory',
        resultFormats: [ResultFormat.tap]
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config);

      expect(
        createStreamStub.calledWith(
          join(config.dirPath, `test-result-${testRunId}-tap.txt`)
        )
      ).to.be.true;
      expect(tapSpy.calledOnce).to.be.true;
      expect(createStreamStub.callCount).to.eql(2);
    });

    it('should create any files provided in fileInfos', async () => {
      const config = {
        dirPath: 'path/to/directory',
        fileInfos: [
          { filename: `test-result-myFile.json`, content: { summary: {} } }
        ]
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config);

      expect(
        createStreamStub.calledWith(
          join(config.dirPath, `test-result-myFile.json`)
        )
      ).to.be.true;
      expect(stringifySpy.callCount).to.eql(1);
      expect(createStreamStub.callCount).to.eql(2);
    });

    it('should create code coverage files if set to true', async () => {
      const config = {
        dirPath: 'path/to/directory'
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(testResultData, config, true);

      expect(
        createStreamStub.calledWith(
          join(config.dirPath, `test-result-${testRunId}-codecoverage.json`)
        )
      ).to.be.true;
      expect(stringifySpy.callCount).to.eql(1);
      expect(createStreamStub.callCount).to.eql(2);
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
        assert.fail();
      } catch (e) {
        expect(e.message).to.equal(
          'Specified result formats must be of type json, junit, or tap'
        );
      }
    });
  });

  describe('Build async payload', async () => {
    it('should build async payload for tests without namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myClass.myTest'
      );

      expect(payload).to.deep.equal({
        tests: [{ className: 'myClass', testMethods: ['myTest'] }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.calledOnce).to.be.true;
    });

    it('should build async payload for test with namespace when org returns 0 namespaces', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set([]));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myNamespace.myClass'
      );

      expect(payload).to.deep.equal({
        tests: [{ className: 'myNamespace', testMethods: ['myClass'] }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.calledOnce).to.be.true;
    });

    it('should build async payload for tests with namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myNamespace.myClass'
      );

      expect(payload).to.deep.equal({
        tests: [
          {
            namespace: 'myNamespace',
            className: 'myClass'
          }
        ],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.calledOnce).to.be.true;
    });

    it('should only query for namespaces once when multiple tests are specified', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myNamespace.myClass,myNamespace.mySecondClass'
      );

      expect(payload).to.deep.equal({
        tests: [
          {
            namespace: 'myNamespace',
            className: 'myClass'
          },
          {
            namespace: 'myNamespace',
            className: 'mySecondClass'
          }
        ],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.calledOnce).to.be.true;
    });

    it('should build async payload for tests with 3 parts', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myNamespace.myClass.myTest'
      );

      expect(payload).to.deep.equal({
        tests: [
          {
            namespace: 'myNamespace',
            className: 'myClass',
            testMethods: ['myTest']
          }
        ],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build async payload for tests with only classname', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        'myClass'
      );
      expect(payload).to.deep.equal({
        tests: [{ className: 'myClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build async payload for class with only classname', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        'myClass'
      );
      expect(payload).to.deep.equal({
        tests: [{ className: 'myClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build async payload for class specified by id', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        '01p4x00000KWt3TAAT'
      );
      expect(payload).to.deep.equal({
        tests: [{ classId: '01p4x00000KWt3TAAT' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build async payload for class specified by id with incorrect number of digits', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        '01p4x00000KWt3TAATP'
      );
      expect(payload).to.deep.equal({
        tests: [{ className: '01p4x00000KWt3TAATP' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build async payload for class with namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        'myNamespace.myClass'
      );
      expect(payload).to.deep.equal({
        tests: [{ namespace: 'myNamespace', className: 'myClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should build async payload for suite', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        undefined,
        'mySuite'
      );
      expect(payload).to.deep.equal({
        suiteNames: 'mySuite',
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });
  });

  describe('Query Namespaces', async () => {
    it('should query for installed packages and namespaced orgs', async () => {
      const queryStub = sandboxStub
        .stub(mockConnection, 'query')
        //@ts-ignore
        .resolves({ records: [{ NamespacePrefix: 'myNamespace' }] });
      const testSrv = new TestService(mockConnection);
      await testSrv.queryNamespaces();
      expect(queryStub.calledTwice).to.be.true;
    });

    it('should output set of namespaces from both queries', async () => {
      const queryStub = sandboxStub.stub(mockConnection, 'query');
      queryStub
        .onFirstCall()
        //@ts-ignore
        .resolves({
          records: [
            { NamespacePrefix: 'myNamespace' },
            { NamespacePrefix: 'otherNamespace' }
          ]
        });
      //@ts-ignore
      queryStub.onSecondCall().resolves({
        records: [{ NamespacePrefix: 'otherNamespace' }]
      });

      const testSrv = new TestService(mockConnection);
      const namespaces = await testSrv.queryNamespaces();
      expect(queryStub.calledTwice).to.be.true;
      expect(namespaces).to.deep.equal(
        new Set(['myNamespace', 'otherNamespace'])
      );
    });
  });
});
