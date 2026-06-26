/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SinonStub, SinonSpy } from 'sinon';
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { join } from 'node:path';
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
import { fail } from 'node:assert';
import { SyncTests } from '../../src/tests/syncTests';
import { Writable } from 'node:stream';

let mockConnection: Connection;
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
    await $$.stubAuths(testData);
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    toolingRequestStub = $$.SANDBOX.stub(mockConnection.tooling, 'request');
    testRequest = {
      method: 'POST',
      url: `${mockConnection.tooling._baseUrl()}/runTestsSynchronous`,
      body: JSON.stringify(requestOptions),
      headers: { 'content-type': 'application/json' }
    };

    testServiceSpy = $$.SANDBOX.stub(TestService.prototype, 'createStream').returns(
      new Writable({
        write(chunk: unknown, encoding, callback) {
          callback();
        }
      })
    );

    junitSpy = $$.SANDBOX.spy(JUnitFormatTransformer.prototype, 'format');
    formatSpy = $$.SANDBOX.spy(diagnosticUtil, 'formatTestErrors');
  });

  it('should run a successful test', async () => {
    toolingRequestStub.withArgs(testRequest).returns(syncTestResultSimple);
    const testSrv = new TestService(mockConnection);
    const testResult = (await testSrv.runTestSynchronous(requestOptions)) as TestResult;
    expect(typeof testResult).toBe('object');
    expect(toolingRequestStub.calledOnce).toBe(true);
    expect(typeof testResult.summary).toBe('object');
    expect(testResult.summary.failRate).toBe('0%');
    expect(testResult.summary.testsRan).toBe(1);
    expect(testResult.summary.orgId).toBe(mockConnection.getAuthInfoFields().orgId);
    expect(testResult.summary.outcome).toBe('Passed');
    expect(testResult.summary.passRate).toBe('100%');
    expect(testResult.summary.skipRate).toBe('0%');
    expect(testResult.summary.testExecutionTimeInMs).toBe(270);
    expect(testResult.summary.username).toBe(mockConnection.getUsername());

    expect(Array.isArray(testResult.tests)).toBe(true);
    expect(testResult.tests).toHaveLength(1);
    expect(testResult.tests[0].queueItemId).toBe('');
    expect(testResult.tests[0].stackTrace).toBe('');
    expect(testResult.tests[0].message).toBe('');
    expect(testResult.tests[0].asyncApexJobId).toBe('');
    expect(testResult.tests[0].methodName).toBe('testOne');
    expect(testResult.tests[0].outcome).toBe('Pass');
    expect(testResult.tests[0].apexLogId).toBe('07Lxx00000cxy6YUAQ');
    expect(typeof testResult.tests[0].apexClass).toBe('object');
    expect(testResult.tests[0].apexClass.id).toBe('01pxx00000NWwb3AAD');
    expect(testResult.tests[0].apexClass.name).toBe('TestSample');
    expect(testResult.tests[0].apexClass.namespacePrefix).toBe('');
    expect(testResult.tests[0].apexClass.fullName).toBe('TestSample');
    expect(testResult.tests[0].runTime).toBe(107);
    expect(testResult.tests[0].testTimestamp).toBe('');
    expect(testResult.tests[0].fullName).toBe('TestSample.testOne');
  });

  it('should run a test with failures', async () => {
    toolingRequestStub.withArgs(testRequest).returns(syncTestResultWithFailures);
    const testSrv = new TestService(mockConnection);
    const testResult = (await testSrv.runTestSynchronous(requestOptions)) as TestResult;
    expect(typeof testResult).toBe('object');
    expect(toolingRequestStub.calledOnce).toBe(true);
    expect(typeof testResult.summary).toBe('object');
    expect(testResult.summary.failRate).toBe('100%');
    expect(testResult.summary.testsRan).toBe(4);
    expect(testResult.summary.orgId).toBe(mockConnection.getAuthInfoFields().orgId);
    expect(testResult.summary.outcome).toBe('Failed');
    expect(testResult.summary.passRate).toBe('0%');
    expect(testResult.summary.skipRate).toBe('0%');
    expect(testResult.summary.testExecutionTimeInMs).toBe(87);
    expect(testResult.summary.username).toBe(mockConnection.getUsername());

    expect(Array.isArray(testResult.tests)).toBe(true);
    expect(testResult.tests).toHaveLength(4);
    expect(testResult.tests[0].queueItemId).toBe('');
    expect(testResult.tests[0].stackTrace).toBe('Class.TestSample.testOne: line 27, column 1');
    expect(testResult.tests[0].message).toBe('System.AssertException: Assertion Failed: Expected: false, Actual: true');
    expect(testResult.tests[0].asyncApexJobId).toBe('');
    expect(testResult.tests[0].methodName).toBe('testOne');
    expect(testResult.tests[0].outcome).toBe('Fail');
    expect(testResult.tests[0].apexLogId).toBe('07Lxx00000cxy6YUAQ');
    expect(typeof testResult.tests[0].apexClass).toBe('object');
    expect(testResult.tests[0].apexClass.id).toBe('01pxx00000NWwb3AAD');
    expect(testResult.tests[0].apexClass.name).toBe('TestSample');
    expect(testResult.tests[0].apexClass.namespacePrefix).toBe('tr');
    expect(testResult.tests[0].apexClass.fullName).toBe('tr__TestSample');
    expect(testResult.tests[0].runTime).toBe(68);
    expect(testResult.tests[0].testTimestamp).toBe('');
    expect(testResult.tests[0].fullName).toBe('tr__TestSample.testOne');
    expect(testResult.tests[0].diagnostic!.lineNumber).toBe(27);
    expect(testResult.tests[0].diagnostic!.columnNumber).toBe(1);

    expect(testResult.tests[3].apexClass.fullName).toBe('tr__TestSample4');
    expect(testResult.tests[3].stackTrace).toBe('TestSample4: line 30');
    expect(testResult.tests[3].diagnostic!.lineNumber).toBeUndefined();
    expect(testResult.tests[3].diagnostic!.columnNumber).toBeUndefined();
  });

  it('should run a test with code coverage', async () => {
    toolingRequestStub.withArgs(testRequest).returns(syncTestResultSimple);
    const queryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');

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
    const testResult = (await testSrv.runTestSynchronous(requestOptions, true)) as TestResult;
    expect(typeof testResult).toBe('object');
    expect(toolingRequestStub.calledOnce).toBe(true);
    expect(typeof testResult.summary).toBe('object');
    expect(testResult.summary.testRunCoverage).toBe('66%');
    expect(testResult.summary.orgWideCoverage).toBe('35%');
    expect(Array.isArray(testResult.tests)).toBe(true);
    expect(testResult.tests).toHaveLength(1);
    expect(Array.isArray(testResult.codecoverage)).toBe(true);
    expect(testResult.codecoverage!).toHaveLength(3);
  });

  describe('Create Synchronous Result Files', () => {
    it('should create json result file without testRunId for sync runs', async () => {
      const config = {
        dirPath: 'path/to/directory',
        resultFormats: [ResultFormat.json]
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(syncResult, config);

      expect(testServiceSpy.getCall(0).firstArg).toBe(join(config.dirPath, 'test-result-default.json'));
      expect(testServiceSpy.callCount).toBe(1);
    });

    it('should create junit result file without testRunId for sync runs', async () => {
      const config = {
        dirPath: 'path/to/directory',
        resultFormats: [ResultFormat.junit]
      } as OutputDirConfig;
      const testSrv = new TestService(mockConnection);
      await testSrv.writeResultFiles(syncResult, config);

      expect(testServiceSpy.getCall(0).firstArg).toBe(join(config.dirPath, 'test-result-default-junit.xml'));
      expect(junitSpy.calledOnce).toBe(true);
      expect(testServiceSpy.callCount).toBe(1);
    });
  });

  describe('Format Test Errors', () => {
    it('should format test error when running synchronous tests', async () => {
      const testSrv = new TestService(mockConnection);
      const errMsg = "sObject type 'ApexClass' is not supported.";
      $$.SANDBOX.stub(SyncTests.prototype, 'formatSyncResults').throws(new Error(errMsg));
      try {
        await testSrv.runTestSynchronous({
          testLevel: TestLevel.RunLocalTests
        });
        fail('Should have failed');
      } catch (e) {
        expect(formatSpy.calledOnce).toBe(true);
        expect(e.message).toContain(nls.localize('invalidsObjectErr', ['ApexClass', errMsg]));
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

        failures: [] as any[],
        apexLogId: '07Lxx00000cxy6YUAQ'
      };

      const result = await syncTests.formatSyncResults(mockSyncResult, Date.now());

      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].category).toBe(TestCategory.Apex);
      expect(result.tests[0].apexClass.fullName).toBe('TestApexClass');
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

        failures: [] as any[],
        apexLogId: '07Lxx00000cxy6YUAQ'
      };

      const result = await syncTests.formatSyncResults(mockSyncResult, Date.now());

      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].category).toBe(TestCategory.Flow);
      expect(result.tests[0].apexClass.fullName).toBe('FlowTesting.TestFlow.TestFlowClass');
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

        failures: [] as any[],
        apexLogId: '07Lxx00000cxy6YUAQ'
      };

      const result = await syncTests.formatSyncResults(mockSyncResult, Date.now());

      expect(result.tests).toHaveLength(2);

      // Verify custom namespace Apex test
      const customApexTest = result.tests.find(t => t.methodName === 'testCustomMethod');
      expect(customApexTest).toBeDefined();
      expect(customApexTest!.category).toBe(TestCategory.Apex);
      expect(customApexTest!.apexClass.fullName).toBe('myorg.CustomTestClass');

      // Verify Flow test with extended namespace
      const flowTest = result.tests.find(t => t.methodName === 'testAnotherFlow');
      expect(flowTest).toBeDefined();
      expect(flowTest!.category).toBe(TestCategory.Flow);
      expect(flowTest!.apexClass.fullName).toBe('FlowTesting.AnotherFlow.AnotherFlowTest');
    });
  });
});
