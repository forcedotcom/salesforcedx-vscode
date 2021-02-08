/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { SyncTestConfiguration, TestService } from '../../src/tests';
import {
  TestLevel,
  ApexOrgWideCoverage,
  ApexCodeCoverageAggregate,
  ApexCodeCoverage
} from '../../src/tests/types';
import { nls } from '../../src/i18n';
import {
  codeCoverageQueryResult,
  perClassCodeCoverage,
  syncTestResultSimple,
  syncTestResultWithFailures
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
    const testResult = await testSrv.runTestSynchronous(requestOptions);
    expect(testResult).to.be.a('object');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult.summary).to.be.a('object');
    expect(testResult.summary.failRate).to.equal('100%');
    expect(testResult.summary.testsRan).to.equal(1);
    expect(testResult.summary.orgId).to.equal(
      mockConnection.getAuthInfoFields().orgId
    );
    expect(testResult.summary.outcome).to.equal('Failed');
    expect(testResult.summary.passRate).to.equal('0%');
    expect(testResult.summary.skipRate).to.equal('0%');
    expect(testResult.summary.testExecutionTimeInMs).to.equal(87);
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
    expect(testResult.summary.testRunCoverage).to.equal('66%');
    expect(testResult.summary.orgWideCoverage).to.equal('35%');
    expect(testResult.tests).to.be.a('array');
    expect(testResult.tests.length).to.equal(1);
    expect(testResult.codecoverage).to.be.a('array');
    expect(testResult.codecoverage.length).to.equal(3);
  });

  describe('Build sync payload', async () => {
    it('should build synchronous payload for tests without namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildSyncPayload(
        TestLevel.RunSpecifiedTests,
        'myClass.myTest'
      );

      expect(payload).to.deep.equal({
        tests: [{ className: 'myClass', testMethods: ['myTest'] }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.calledOnce).to.be.true;
    });

    it('should build synchronous payload for tests with namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildSyncPayload(
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

    it('should build synchronous payload for class without namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildSyncPayload(
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

    it('should build synchronous payload for class with namespace', async () => {
      const namespaceStub = sandboxStub
        .stub(TestService.prototype, 'queryNamespaces')
        .resolves(new Set(['myNamespace']));
      const testSrv = new TestService(mockConnection);
      const payload = await testSrv.buildSyncPayload(
        TestLevel.RunSpecifiedTests,
        undefined,
        'myNamespace.myClass'
      );

      expect(payload).to.deep.equal({
        tests: [{ className: 'myNamespace.myClass' }],
        testLevel: TestLevel.RunSpecifiedTests
      });
      expect(namespaceStub.notCalled).to.be.true;
    });

    it('should throw an error if multiple classes are specified', async () => {
      const testSrv = new TestService(mockConnection);

      try {
        await testSrv.buildSyncPayload(
          TestLevel.RunSpecifiedTests,
          'myNamespace.myClass.myTest, myNamespace.otherClass.otherTest'
        );
        assert.fail();
      } catch (e) {
        expect(e.message).to.equal(nls.localize('syncClassErr'));
      }
    });
  });
});
