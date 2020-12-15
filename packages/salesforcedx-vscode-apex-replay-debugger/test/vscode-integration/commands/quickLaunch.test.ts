/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogService, TestService } from '@salesforce/apex-node';
import { TestResult } from '@salesforce/apex-node/lib/src/tests/types';
import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import * as launcher from '../../../src/commands/launchFromLogFile';
import { TestDebuggerExecutor } from '../../../src/commands/quickLaunch';
import { TraceFlags } from '../../../src/commands/traceFlags';
import { nls } from '../../../src/messages';
import * as utils from '../../../src/utils';

const coreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { workspaceContext } = coreExports;
export const notificationService = coreExports.notificationService;

const $$ = testSetup();

describe('Quick launch apex tests', () => {
  const testData = new MockTestOrgData();
  const testDebuggerExec = new TestDebuggerExecutor();
  const APEX_LOG_ID = 'abcd';
  const LOG_DIR = 'logs';

  let mockConnection: Connection;
  let sb: SinonSandbox;
  let notificationServiceStub: SinonStub;
  let traceFlagsStub: SinonStub;
  let testServiceStub: SinonStub;
  let logServiceStub: SinonStub;
  let launcherStub: SinonStub;

  beforeEach(async () => {
    sb = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sb.stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);
    notificationServiceStub = sb.stub(notificationService, 'showErrorMessage');
  });

  afterEach(() => {
    sb.restore();
  });

  it('should debug an entire test class', async () => {
    sb.stub(workspaceContext, 'getConnection').returns(mockConnection);
    traceFlagsStub = sb
      .stub(TraceFlags.prototype, 'ensureTraceFlags')
      .returns(true);
    testServiceStub = sb
      .stub(TestService.prototype, 'runTestSynchronous')
      .resolves({ tests: [{ apexLogId: APEX_LOG_ID }] } as TestResult);
    sb.stub(utils, 'getLogDirPath').returns(LOG_DIR);
    logServiceStub = sb.stub(LogService.prototype, 'getLogs').resolves([]);
    launcherStub = sb.stub(launcher, 'launchFromLogFile');

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(testServiceStub.called).to.equal(true);
    const { args } = testServiceStub.getCall(0);
    expect(args[0]).to.eql({
      tests: [
        {
          className: 'MyClass',
          testMethods: undefined
        }
      ],
      testLevel: 'RunSpecifiedTests'
    });

    expect(logServiceStub.called).to.equal(true);
    const logArgs = logServiceStub.getCall(0).args;
    expect(logArgs[0]).to.eql({
      logId: APEX_LOG_ID,
      outputDir: LOG_DIR
    });

    expect(launcherStub.called).to.equal(true);
    const launcherArgs = launcherStub.getCall(0).args;
    expect(launcherArgs[0]).to.equal('logs/abcd.log');
    expect(launcherArgs[1]).to.equal(false);
  });

  it('should debug a single test method', async () => {
    sb.stub(workspaceContext, 'getConnection').returns(mockConnection);
    traceFlagsStub = sb
      .stub(TraceFlags.prototype, 'ensureTraceFlags')
      .returns(true);
    testServiceStub = sb
      .stub(TestService.prototype, 'runTestSynchronous')
      .resolves({ tests: [{ apexLogId: APEX_LOG_ID }] } as TestResult);
    sb.stub(utils, 'getLogDirPath').returns(LOG_DIR);
    logServiceStub = sb.stub(LogService.prototype, 'getLogs').resolves([]);
    launcherStub = sb.stub(launcher, 'launchFromLogFile');

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass', 'testSomeCode']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(testServiceStub.called).to.equal(true);
    const { args } = testServiceStub.getCall(0);
    expect(args[0]).to.eql({
      tests: [
        {
          className: 'MyClass',
          testMethods: ['testSomeCode']
        }
      ],
      testLevel: 'RunSpecifiedTests'
    });

    expect(logServiceStub.called).to.equal(true);
    const logArgs = logServiceStub.getCall(0).args;
    expect(logArgs[0]).to.eql({
      logId: APEX_LOG_ID,
      outputDir: LOG_DIR
    });

    expect(launcherStub.called).to.equal(true);
    const launcherArgs = launcherStub.getCall(0).args;
    expect(launcherArgs[0]).to.equal('logs/abcd.log');
    expect(launcherArgs[1]).to.equal(false);
  });

  it('should debug a single test method that fails', async () => {
    sb.stub(workspaceContext, 'getConnection').returns(mockConnection);
    traceFlagsStub = sb
      .stub(TraceFlags.prototype, 'ensureTraceFlags')
      .returns(true);
    testServiceStub = sb
      .stub(TestService.prototype, 'runTestSynchronous')
      .resolves({} as TestResult);
    sb.stub(utils, 'getLogDirPath').returns(LOG_DIR);
    logServiceStub = sb.stub(LogService.prototype, 'getLogs').resolves([]);
    launcherStub = sb.stub(launcher, 'launchFromLogFile');

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass', 'testSomeCode']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(testServiceStub.called).to.equal(true);
    const { args } = testServiceStub.getCall(0);
    expect(args[0]).to.eql({
      tests: [
        {
          className: 'MyClass',
          testMethods: ['testSomeCode']
        }
      ],
      testLevel: 'RunSpecifiedTests'
    });

    expect(logServiceStub.called).to.equal(false);
    expect(launcherStub.called).to.equal(false);

    expect(notificationServiceStub.called).to.equal(true);
    const notificationArgs = notificationServiceStub.getCall(0).args;
    expect(notificationArgs[0]).to.equal(
      "Cannot read property 'length' of undefined"
    );
  });

  it('should display an error for a missing test', async () => {
    sb.stub(workspaceContext, 'getConnection').returns(mockConnection);
    traceFlagsStub = sb
      .stub(TraceFlags.prototype, 'ensureTraceFlags')
      .returns(true);
    testServiceStub = sb
      .stub(TestService.prototype, 'runTestSynchronous')
      .resolves({ tests: [] });

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass', 'testSomeCode']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(testServiceStub.called).to.equal(true);
    const { args } = testServiceStub.getCall(0);
    expect(args[0]).to.eql({
      tests: [
        {
          className: 'MyClass',
          testMethods: ['testSomeCode']
        }
      ],
      testLevel: 'RunSpecifiedTests'
    });

    expect(notificationServiceStub.called).to.equal(true);
    const notificationArgs = notificationServiceStub.getCall(0).args;
    expect(notificationArgs[0]).to.equal(
      nls.localize('debug_test_no_results_found')
    );
  });

  it('should display an error for a missing log file', async () => {
    sb.stub(workspaceContext, 'getConnection').returns(mockConnection);
    traceFlagsStub = sb
      .stub(TraceFlags.prototype, 'ensureTraceFlags')
      .returns(true);
    testServiceStub = sb
      .stub(TestService.prototype, 'runTestSynchronous')
      .resolves({ tests: [{}] });

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass', 'testSomeCode']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(testServiceStub.called).to.equal(true);
    const { args } = testServiceStub.getCall(0);
    expect(args[0]).to.eql({
      tests: [
        {
          className: 'MyClass',
          testMethods: ['testSomeCode']
        }
      ],
      testLevel: 'RunSpecifiedTests'
    });

    expect(notificationServiceStub.called).to.equal(true);
    const notificationArgs = notificationServiceStub.getCall(0).args;
    expect(notificationArgs[0]).to.equal(
      nls.localize('debug_test_no_debug_log')
    );
  });
});
