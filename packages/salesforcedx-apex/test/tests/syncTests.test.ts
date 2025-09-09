/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { join } from 'path';
import { SyncTestConfiguration, TestService } from '../../src';
import {
  TestLevel,
  ApexOrgWideCoverage,
  ApexCodeCoverageAggregate,
  ApexCodeCoverage,
  ResultFormat,
  OutputDirConfig,
  TestResult,
  TestCategory
} from '../../src/tests/types';
import { nls } from '../../src/i18n';
import {
  codeCoverageQueryResult,
  perClassCodeCoverage,
  syncResult,
  syncTestResultSimple,
  syncTestResultWithFailures
} from '../testData';
// eslint-disable-next-line no-duplicate-imports
import { JUnitFormatTransformer } from '../../src';
import * as diagnosticUtil from '../../src/tests/diagnosticUtil';
import { fail } from 'assert';
import { SyncTests } from '../../src/tests/syncTests';
import { Writable } from 'node:stream';

let mockConnection: Connection;
let sandboxStub: SinonSandbox;
let toolingRequestStub: SinonStub;
const testData = new MockTestOrgData();

describe('Run Apex tests synchronously', () => {
  const $$ = new TestContext();
  let testRequest = {};
  const requestOptions: SyncTestConfiguration = {
    tests: [{ className: 'TestSample' }],
    maxFailedTests: 2,
    testLevel: 'RunSpecifiedTests'
  };

  let testServiceSpy: SinonSpy;
  let junitSpy: SinonSpy;
  let formatSpy: SinonSpy;
  beforeEach(async () => {
    sandboxStub = createSandbox();
    await $$.stubAuths(testData);
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    sandboxStub
      .stub(Connection.prototype, 'retrieveMaxApiVersion')
      .resolves('50.0');
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

    testServiceSpy = sandboxStub
      .stub(TestService.prototype, 'createStream')
      .returns(
        new Writable({
          write(chunk: unknown, encoding, callback) {
            callback();
          }
        })
      );

    junitSpy = sandboxStub.spy(JUnitFormatTransformer.prototype, 'format');
    formatSpy = sandboxStub.spy(diagnosticUtil, 'formatTestErrors');
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should run a successful test', async () => {
    toolingRequestStub.withArgs(testRequest).returns(syncTestResultSimple);
    const testSrv = new TestService(mockConnection);
    const testResult = (await testSrv.runTestSynchronous(
      requestOptions
    )) as TestResult;
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult.summary).to.be.a('object');
    expect(testResult.summary.failRate).to.equal('0%');
    expect(testResult.summary.testsRan).to.equal(1);
    expect(testResult.summary.orgId).to.equal(
      mockConnection.getAuthInfoFields().orgId
    );
    expect(testResult.summary.outcome).to.equal('Passed');
    expect(testResult.summary.passRate).to.equal('100%');
    expect(testResult.summary.skipRate).to.equal('0%');
    expect(testResult.summary.testExecutionTimeInMs).to.equal(270);
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
    const testResult = (await testSrv.runTestSynchronous(
      requestOptions
    )) as TestResult;
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult.summary).to.be.a('object');
    expect(testResult.summary.failRate).to.equal('100%');
    expect(testResult.summary.testsRan).to.equal(4);
    expect(testResult.summary.orgId).to.equal(
      mockConnection.getAuthInfoFields().orgId
    );
    expect(testResult.summary.outcome).to.equal('Failed');
    expect(testResult.summary.passRate).to.equal('0%');
    expect(testResult.summary.skipRate).to.equal('0%');
    expect(testResult.summary.testExecutionTimeInMs).to.equal(87);
    expect(testResult.summary.username).to.equal(mockConnection.getUsername());

    expect(testResult.tests).to.be.a('array');
    expect(testResult.tests.length).to.equal(4);
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
    expect(testResult.tests[0].diagnostic.lineNumber).to.equal(27);
    expect(testResult.tests[0].diagnostic.columnNumber).to.equal(1);

    expect(testResult.tests[3].apexClass.fullName).to.equal('tr__TestSample4');
    expect(testResult.tests[3].stackTrace).to.equal('TestSample4: line 30');
    expect(testResult.tests[3].diagnostic.lineNumber).to.equal(undefined);
    expect(testResult.tests[3].diagnostic.columnNumber).to.equal(undefined);
  });

  it('should run a test with code coverage', async () => {
    toolingRequestStub.withArgs(testRequest).returns(syncTestResultSimple);
    const queryStub = sandboxStub.stub(mockConnection.tooling, 'query');

    queryStub.onCall(0).resolves({
      done: true,
      totalSize: 3,
      records: perClassCodeCoverage
    } as ApexCodeCoverage);
    queryStub.onCall(1).resolves({
      done: true,
      totalSize: 3,
      records: codeCoverageQueryResult
    } as ApexCodeCoverageAggregate);
    queryStub.onCall(2).resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          PercentCovered: '35'
        }
      ]
    } as ApexOrgWideCoverage);

    const testSrv = new TestService(mockConnection);
    const testResult = (await testSrv.runTestSynchronous(
      requestOptions,
      true
    )) as TestResult;
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult.summary).to.be.a('object');
    expect(testResult.summary.testRunCoverage).to.equal('66%');
    expect(testResult.summary.orgWideCoverage).to.equal('35%');
    expect(testResult.tests).to.be.a('array');
    expect(testResult.tests.length).to.equal(1);
    expect(testResult.codecoverage).to.be.a('array');
    expect(testResult.codecoverage.length).to.equal(3);
  });

  describe('Create Synchronous Result Files', async () => {
    it('should create json result file without testRunId for sync runs', async () => {
      const config = {
        dirPath: 'path/to/directory',
        resultFormats: [ResultFormat.json]
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(syncResult, config);

      expect(testServiceSpy.getCall(0).firstArg).to.be.equal(
        join(config.dirPath, 'test-result-default.json')
      );
      expect(testServiceSpy.callCount).to.eql(1);
    });

    it('should create junit result file without testRunId for sync runs', async () => {
      const config = {
        dirPath: 'path/to/directory',
        resultFormats: [ResultFormat.junit]
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(syncResult, config);

      expect(testServiceSpy.getCall(0).firstArg).to.be.equal(
        join(config.dirPath, `test-result-default-junit.xml`)
      );
      expect(junitSpy.calledOnce).to.be.true;
      expect(testServiceSpy.callCount).to.eql(1);
    });
  });

  describe('Format Test Errors', async () => {
    it('should format test error when running synchronous tests', async () => {
      const testSrv = new TestService(mockConnection);
      const errMsg = `sObject type 'ApexClass' is not supported.`;
      sandboxStub
        .stub(SyncTests.prototype, 'formatSyncResults')
        .throws(new Error(errMsg));
      try {
        await testSrv.runTestSynchronous({
          testLevel: TestLevel.RunLocalTests
        });
        fail('Should have failed');
      } catch (e) {
        expect(formatSpy.calledOnce).to.be.true;
        expect(e.message).to.contain(
          nls.localize('invalidsObjectErr', ['ApexClass', errMsg])
        );
      }
    });
  });

  describe('Test Category Support in Sync Tests', () => {
    let syncTests: SyncTests;

    beforeEach(() => {
      syncTests = new SyncTests(mockConnection);
    });

    it('should assign Apex category to regular Apex tests', async () => {
      const mockSyncResult = {
        numTestsRun: 1,
        numFailures: 0,
        totalTime: 100,
        successes: [
          {
            id: '01pxx00000NWwb3AAD',
            methodName: 'testMethod',
            name: 'TestApexClass',
            namespace: null as string | null, // Regular Apex test without namespace
            seeAllData: false,
            time: 50
          }
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        failures: [] as any[],
        apexLogId: '07Lxx00000cxy6YUAQ'
      };

      const result = await syncTests.formatSyncResults(
        mockSyncResult,
        Date.now()
      );

      expect(result.tests).to.have.length(1);
      expect(result.tests[0].category).to.equal(TestCategory.Apex);
      expect(result.tests[0].apexClass.fullName).to.equal('TestApexClass');
    });

    it('should assign Flow category to Flow tests', async () => {
      const mockSyncResult = {
        numTestsRun: 1,
        numFailures: 0,
        totalTime: 100,
        successes: [
          {
            id: '01pxx00000FlowTest01',
            methodName: 'testFlowMethod',
            name: 'TestFlowClass',
            namespace: 'FlowTesting.TestFlow', // Flow test namespace
            seeAllData: false,
            time: 75
          }
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        failures: [] as any[],
        apexLogId: '07Lxx00000cxy6YUAQ'
      };

      const result = await syncTests.formatSyncResults(
        mockSyncResult,
        Date.now()
      );

      expect(result.tests).to.have.length(1);
      expect(result.tests[0].category).to.equal(TestCategory.Flow);
      expect(result.tests[0].apexClass.fullName).to.equal(
        'FlowTesting.TestFlow.TestFlowClass'
      );
    });

    it('should assign correct categories for namespaced tests', async () => {
      const mockSyncResult = {
        numTestsRun: 2,
        numFailures: 0,
        totalTime: 150,
        successes: [
          {
            id: '01pxx00000CustomTest',
            methodName: 'testCustomMethod',
            name: 'CustomTestClass',
            namespace: 'myorg',
            seeAllData: false,
            time: 60
          },
          {
            id: '01pxx00000FlowTest02',
            methodName: 'testAnotherFlow',
            name: 'AnotherFlowTest',
            namespace: 'FlowTesting.AnotherFlow',
            seeAllData: false,
            time: 90
          }
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        failures: [] as any[],
        apexLogId: '07Lxx00000cxy6YUAQ'
      };

      const result = await syncTests.formatSyncResults(
        mockSyncResult,
        Date.now()
      );

      expect(result.tests).to.have.length(2);

      // Verify custom namespace Apex test
      const customApexTest = result.tests.find(
        (t) => t.methodName === 'testCustomMethod'
      );
      expect(customApexTest).to.exist;
      expect(customApexTest.category).to.equal(TestCategory.Apex);
      expect(customApexTest.apexClass.fullName).to.equal(
        'myorg.CustomTestClass'
      );

      // Verify Flow test with extended namespace
      const flowTest = result.tests.find(
        (t) => t.methodName === 'testAnotherFlow'
      );
      expect(flowTest).to.exist;
      expect(flowTest.category).to.equal(TestCategory.Flow);
      expect(flowTest.apexClass.fullName).to.equal(
        'FlowTesting.AnotherFlow.AnotherFlowTest'
      );
    });
  });
});
