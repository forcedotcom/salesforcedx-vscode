/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { SyncTestConfiguration, TestService } from '../../src/tests';
import {
  SyncTestResult,
  AsyncTestConfiguration,
  TestLevel,
  ApexTestQueueItemStatus,
  ApexTestResultOutcome,
  AsyncTestResult,
  ApexTestQueueItem,
  ApexTestRunResultStatus,
  ApexTestRunResult,
  ApexTestResult
} from '../../src/tests/types';
import { StreamingClient } from '../../src/streaming';
import { fail } from 'assert';
import { nls } from '../../src/i18n';

const $$ = testSetup();
let mockConnection: Connection;
let sandboxStub: SinonSandbox;
let toolingRequestStub: SinonStub;
const testData = new MockTestOrgData();

describe('Run Apex tests synchronously', () => {
  let testRequest = {};
  const requestOptions: SyncTestConfiguration = {
    tests: [{ className: 'TestSample' }],
    maxFailedTests: 2,
    testLevel: 'RunSpecifiedTests'
  };

  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    toolingRequestStub = sandboxStub.stub(mockConnection.tooling, 'request');
    testRequest = {
      method: 'POST',
      url: `${mockConnection.tooling._baseUrl()}/runTestsSynchronous`,
      body: JSON.stringify(requestOptions),
      headers: { 'content-type': 'application/json' }
    };
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should run a successful test', async () => {
    const requestResult: SyncTestResult = {
      apexLogId: '07Lxx00000cxy6YUAQ',
      failures: [],
      numFailures: 0,
      numTestsRun: 1,
      successes: [
        {
          id: '01pxx00000NWwb3AAD',
          methodName: 'testOne',
          name: 'TestSample',
          namespace: null,
          seeAllData: false,
          time: 107
        }
      ],
      totalTime: 270
    };

    toolingRequestStub.withArgs(testRequest).returns(requestResult);
    const testSrv = new TestService(mockConnection);
    const testResult = await testSrv.runTestSynchronous(requestOptions);
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult).to.deep.equals(requestResult);
  });

  it('should run a test with failures', async () => {
    const requestResult = [
      {
        message:
          "This class name's value is invalid: TestConfig. Provide the name of an Apex class that has test methods.",
        errorCode: 'INVALID_INPUT'
      }
    ];

    toolingRequestStub.withArgs(testRequest).returns(requestResult);
    const testSrv = new TestService(mockConnection);
    const testResult = await testSrv.runTestSynchronous(requestOptions);
    expect(testResult).to.be.a('array');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult).to.deep.equals(requestResult);
  });
});

describe('Run Apex tests asynchronously', () => {
  const testRunId = '707xx0000AGQ3jbQQD';
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
  const testResultData: AsyncTestResult = {
    summary: {
      outcome: 'Completed',
      testStartTime: '2020-07-12T02:54:47.000+0000',
      testExecutionTime: 1765,
      testRunId,
      userId: '005xx000000abcDAAU'
    },
    tests: [
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
        TestTimestamp: 3,
        FullName: 't3st__TestLogger.testLoggerLog'
      }
    ]
  };
  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    toolingRequestStub = sandboxStub.stub(mockConnection.tooling, 'request');
  });

  afterEach(() => {
    sandboxStub.restore();
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
    sandboxStub
      .stub(StreamingClient.prototype, 'subscribe')
      .resolves(pollResponse);
    const testSrv = new TestService(mockConnection);
    const mockTestResultData = sandboxStub
      .stub(testSrv, 'getTestResultData')
      .resolves(testResultData);
    const testResult = await testSrv.runTestAsynchronous(requestOptions);
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(mockTestResultData.calledOnce).to.equal(true);
    expect(mockTestResultData.getCall(0).args[0]).to.equal(pollResponse);
    expect(mockTestResultData.getCall(0).args[1]).to.equal(testRunId);
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
    const testSrv = new TestService(mockConnection);
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.onFirstCall().resolves({
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
          RunTime: 8,
          TestTimestamp: 3
        }
      ]
    } as ApexTestResult);

    const getTestResultData = await testSrv.getTestResultData(
      pollResponse,
      testRunId
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
      'ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix, ApexClass.FullName ';
    testResultQuery += `FROM ApexTestResult WHERE QueueItemId IN ('${pollResponse.records[0].Id}')`;
    expect(mockToolingQuery.getCall(1).args[0]).to.equal(testResultQuery);
    expect(getTestResultData).to.deep.equals(testResultData);
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
      await testSrv.getTestResultData(pollResponse, testRunId);
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal(
        nls.localize('no_test_result_summary', testRunId)
      );
    }
  });
});
