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
import { SyncTestResult } from '../../src/tests/types';

const $$ = testSetup();

describe('Run Apex tests synchronously', () => {
  let mockConnection: Connection;
  let sandboxStub: SinonSandbox;
  let toolingRequestStub: SinonStub;
  let testRequest = {};
  const testData = new MockTestOrgData();
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
    // @ts-ignore
    toolingRequestStub.withArgs(testRequest).returns(requestResult);
    // @ts-ignore
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
    // @ts-ignore
    toolingRequestStub.withArgs(testRequest).returns(requestResult);
    // @ts-ignore
    const testSrv = new TestService(mockConnection);
    const testResult = await testSrv.runTestSynchronous(requestOptions);
    expect(testResult).to.be.a('array');
    expect(toolingRequestStub.calledOnce).to.equal(true);
    expect(testResult).to.deep.equals(requestResult);
  });
});
