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
  ApexCodeCoverage
} from '../../src/tests/types';
import { StreamingClient } from '../../src/streaming';
import { fail } from 'assert';
import { nls } from '../../src/i18n';
import {
  codeCoverageQueryResult,
  mixedPerClassCodeCoverage,
  mixedTestResults,
  perClassCodeCoverage,
  syncTestResultSimple,
  syncTestResultWithFailures,
  testResultData,
  testRunId
} from './testData';

const $$ = testSetup();
let mockConnection: Connection;
let sandboxStub: SinonSandbox;
let toolingRequestStub: SinonStub;
let toolingQueryStub: SinonStub;
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
    toolingQueryStub = sandboxStub.stub(mockConnection.tooling, 'query');
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
    toolingRequestStub.withArgs(testRequest).returns(syncTestResultSimple);
    const testSrv = new TestService(mockConnection);
    const testResult = await testSrv.runTestSynchronous(requestOptions);
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult.summary).to.be.a('object');
    expect(testResult.summary.failRate).to.equal('0%');
    expect(testResult.summary.numTestsRan).to.equal(1);
    expect(testResult.summary.orgId).to.equal(
      mockConnection.getAuthInfoFields().orgId
    );
    expect(testResult.summary.outcome).to.equal('Completed');
    expect(testResult.summary.passRate).to.equal('100%');
    expect(testResult.summary.skipRate).to.equal('0%');
    expect(testResult.summary.testExecutionTime).to.equal(270);
    expect(testResult.summary.username).to.equal(mockConnection.getUsername());

    expect(testResult.tests).to.be.a('array');
    expect(testResult.tests.length).to.equal(1);
    expect(testResult.tests[0].queueItemId).to.equal('');
    expect(testResult.tests[0].stackTrace).to.equal('');
    expect(testResult.tests[0].message).to.equal('');
    expect(testResult.tests[0].asyncApexJobId).to.equal('');
    expect(testResult.tests[0].methodName).to.equal('testOne');
    expect(testResult.tests[0].outcome).to.equal('Pass');
    expect(testResult.tests[0].apexLogId).to.equal('07Lxx00000cxy6YUAQ');
    expect(testResult.tests[0].apexClass).to.be.a('object');
    expect(testResult.tests[0].apexClass.id).to.equal('01pxx00000NWwb3AAD');
    expect(testResult.tests[0].apexClass.name).to.equal('TestSample');
    expect(testResult.tests[0].apexClass.namespacePrefix).to.equal(null);
    expect(testResult.tests[0].apexClass.fullName).to.equal('TestSample');
    expect(testResult.tests[0].runTime).to.equal(107);
    expect(testResult.tests[0].testTimestamp).to.equal('');
    expect(testResult.tests[0].fullName).to.equal('TestSample.testOne');
  });

  it('should run a test with failures', async () => {
    toolingRequestStub
      .withArgs(testRequest)
      .returns(syncTestResultWithFailures);
    const testSrv = new TestService(mockConnection);
    const testResult = await testSrv.runTestSynchronous(requestOptions);
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult.summary).to.be.a('object');
    expect(testResult.summary.failRate).to.equal('100%');
    expect(testResult.summary.numTestsRan).to.equal(1);
    expect(testResult.summary.orgId).to.equal(
      mockConnection.getAuthInfoFields().orgId
    );
    expect(testResult.summary.outcome).to.equal('Failed');
    expect(testResult.summary.passRate).to.equal('0%');
    expect(testResult.summary.skipRate).to.equal('0%');
    expect(testResult.summary.testExecutionTime).to.equal(87);
    expect(testResult.summary.username).to.equal(mockConnection.getUsername());

    expect(testResult.tests).to.be.a('array');
    expect(testResult.tests.length).to.equal(1);
    expect(testResult.tests[0].queueItemId).to.equal('');
    expect(testResult.tests[0].stackTrace).to.equal(
      'Class.TestSample.testOne: line 27, column 1'
    );
    expect(testResult.tests[0].message).to.equal(
      'System.AssertException: Assertion Failed: Expected: false, Actual: true'
    );
    expect(testResult.tests[0].asyncApexJobId).to.equal('');
    expect(testResult.tests[0].methodName).to.equal('testOne');
    expect(testResult.tests[0].outcome).to.equal('Fail');
    expect(testResult.tests[0].apexLogId).to.equal('07Lxx00000cxy6YUAQ');
    expect(testResult.tests[0].apexClass).to.be.a('object');
    expect(testResult.tests[0].apexClass.id).to.equal('01pxx00000NWwb3AAD');
    expect(testResult.tests[0].apexClass.name).to.equal('TestSample');
    expect(testResult.tests[0].apexClass.namespacePrefix).to.equal('tr');
    expect(testResult.tests[0].apexClass.fullName).to.equal('tr__TestSample');
    expect(testResult.tests[0].runTime).to.equal(68);
    expect(testResult.tests[0].testTimestamp).to.equal('');
    expect(testResult.tests[0].fullName).to.equal('tr__TestSample.testOne');
  });

  it('should run a test with code coverage', async () => {
    toolingRequestStub.withArgs(testRequest).returns(syncTestResultSimple);
    toolingQueryStub.onCall(0).resolves({
      done: true,
      totalSize: 3,
      records: perClassCodeCoverage
    } as ApexCodeCoverage);
    toolingQueryStub.onCall(1).resolves({
      done: true,
      totalSize: 3,
      records: codeCoverageQueryResult
    } as ApexCodeCoverageAggregate);
    toolingQueryStub.onCall(2).resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          PercentCovered: '35'
        }
      ]
    } as ApexOrgWideCoverage);

    const testSrv = new TestService(mockConnection);
    const testResult = await testSrv.runTestSynchronous(requestOptions, true);
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult.summary).to.be.a('object');
    expect(testResult.summary.orgWideCoverage).to.equal('35%');
    expect(testResult.tests).to.be.a('array');
    expect(testResult.tests.length).to.equal(1);
    expect(testResult.codecoverage).to.be.a('array');
    expect(testResult.codecoverage.length).to.equal(3);
  });
  /*
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
  }); */
});

describe('Run Apex tests asynchronously', () => {
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
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    testResultData.summary.orgId = mockConnection.getAuthInfoFields().orgId;
    testResultData.summary.username = mockConnection.getUsername();
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
          TestTimestamp: '3'
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
      'ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix ';
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

    const getTestResultData = await testSrv.getTestResultData(
      pollResponse,
      testRunId,
      true
    );

    // verify summary data
    expect(getTestResultData.summary.failRate).to.equal('33%');
    expect(getTestResultData.summary.numTestsRan).to.equal(6);
    expect(getTestResultData.summary.orgId).to.equal(
      mockConnection.getAuthInfoFields().orgId
    );
    expect(getTestResultData.summary.outcome).to.equal('Completed');
    expect(getTestResultData.summary.passRate).to.equal('50%');
    expect(getTestResultData.summary.skipRate).to.equal('17%');
    expect(getTestResultData.summary.username).to.equal(
      mockConnection.getUsername()
    );
    expect(getTestResultData.summary.orgWideCoverage).to.equal('57%');
    expect(getTestResultData.tests.length).to.equal(6);
    expect(getTestResultData.codecoverage.length).to.equal(3);
  });
});
