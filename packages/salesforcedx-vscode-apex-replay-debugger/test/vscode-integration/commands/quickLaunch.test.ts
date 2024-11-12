/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogService, TestService } from '@salesforce/apex-node-bundle';
import { TestLevel, TestResult } from '@salesforce/apex-node-bundle/lib/src/tests/types';
import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core-bundle';
import { MockTestOrgData, TestContext } from '@salesforce/core-bundle';
import {
  ContinueResponse,
  notificationService,
  projectPaths,
  SFDX_CORE_CONFIGURATION_NAME,
  TraceFlags
} from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { CheckpointService } from '../../../src/breakpoints/checkpointService';
import * as launcher from '../../../src/commands/launchFromLogFile';
import { TestDebuggerExecutor } from '../../../src/commands/quickLaunch';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Quick launch apex tests', () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  let testDebuggerExec: TestDebuggerExecutor;
  const APEX_LOG_ID = 'abcd';
  const LOG_DIR = 'logs';
  const sb = createSandbox();

  let mockConnection: Connection;
  let notificationServiceStub: SinonStub;
  let traceFlagsStub: SinonStub;
  let testServiceStub: SinonStub;
  let logServiceStub: SinonStub;
  let launcherStub: SinonStub;
  let buildPayloadStub: SinonStub;
  let createCheckpointStub: SinonStub;
  let writeResultFilesStub: SinonStub;
  let settingStub: SinonStub;
  let oneOrMoreActiveCheckpointsStub: SinonStub;

  beforeEach(async () => {
    settingStub = sb.stub();
    sb.stub(vscode.workspace, 'getConfiguration').withArgs(SFDX_CORE_CONFIGURATION_NAME).returns({
      get: settingStub
    });
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sb.stub(ConfigAggregator.prototype, 'getPropertyValue').withArgs('target-org').returns(testData.username);
    notificationServiceStub = sb.stub(notificationService, 'showErrorMessage');
    sb.stub(workspaceContext, 'getConnection').returns(mockConnection);
    testServiceStub = sb
      .stub(TestService.prototype, 'runTestSynchronous')
      .resolves({ tests: [{ apexLogId: APEX_LOG_ID }] });
    buildPayloadStub = sb.stub(TestService.prototype, 'buildSyncPayload');
    writeResultFilesStub = sb.stub(TestService.prototype, 'writeResultFiles');
    createCheckpointStub = sb.stub(CheckpointService, 'sfCreateCheckpoints');
    oneOrMoreActiveCheckpointsStub = sb.stub(CheckpointService.prototype, 'hasOneOrMoreActiveCheckpoints');
    testDebuggerExec = new TestDebuggerExecutor();
  });

  afterEach(() => {
    sb.restore();
  });

  it('should debug an entire test class', async () => {
    oneOrMoreActiveCheckpointsStub.returns(true);
    createCheckpointStub.resolves(true);
    settingStub.withArgs('retrieve-test-code-coverage').returns(true);
    buildPayloadStub.resolves({
      tests: [{ className: 'MyClass' }],
      testLevel: 'RunSpecifiedTests'
    });
    traceFlagsStub = sb.stub(TraceFlags.prototype, 'ensureTraceFlags').returns(true);
    sb.stub(projectPaths, 'debugLogsFolder').returns(LOG_DIR);
    logServiceStub = sb.stub(LogService.prototype, 'getLogs').resolves([]);
    launcherStub = sb.stub(launcher, 'launchFromLogFile');

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(createCheckpointStub.called).to.equal(true);
    expect(testServiceStub.called).to.equal(true);
    const { args } = testServiceStub.getCall(0);
    expect(args[0]).to.eql({
      tests: [
        {
          className: 'MyClass'
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
    expect(launcherArgs[0]).to.equal(path.join('logs', 'abcd.log'));
    expect(launcherArgs[1]).to.equal(false);
    expect(buildPayloadStub.called).to.be.true;
    expect(buildPayloadStub.args[0]).to.eql([TestLevel.RunSpecifiedTests, undefined, 'MyClass']);
    expect(writeResultFilesStub.called).to.equal(true);
    const writeResultFilesArgs = writeResultFilesStub.getCall(0).args;
    expect(writeResultFilesArgs[0]).to.eql({
      tests: [
        {
          apexLogId: APEX_LOG_ID
        }
      ]
    });
    expect(writeResultFilesArgs[2]).to.equal(true);
  });

  it('should not upload checkpoints if there are no enabled checkpoints', async () => {
    oneOrMoreActiveCheckpointsStub.returns(false);
    createCheckpointStub.resolves(true);
    settingStub.withArgs('retrieve-test-code-coverage').returns(true);
    buildPayloadStub.resolves({
      tests: [{ className: 'MyClass' }],
      testLevel: 'RunSpecifiedTests'
    });
    traceFlagsStub = sb.stub(TraceFlags.prototype, 'ensureTraceFlags').returns(true);
    sb.stub(projectPaths, 'debugLogsFolder').returns(LOG_DIR);
    logServiceStub = sb.stub(LogService.prototype, 'getLogs').resolves([]);
    launcherStub = sb.stub(launcher, 'launchFromLogFile');

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(createCheckpointStub.called).to.equal(false);
    expect(testServiceStub.called).to.equal(true);
    const { args } = testServiceStub.getCall(0);
    expect(args[0]).to.eql({
      tests: [
        {
          className: 'MyClass'
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
    expect(launcherArgs[0]).to.equal(path.join('logs', 'abcd.log'));
    expect(launcherArgs[1]).to.equal(false);
    expect(buildPayloadStub.called).to.be.true;
    expect(buildPayloadStub.args[0]).to.eql([TestLevel.RunSpecifiedTests, undefined, 'MyClass']);
    expect(writeResultFilesStub.called).to.equal(true);
    const writeResultFilesArgs = writeResultFilesStub.getCall(0).args;
    expect(writeResultFilesArgs[0]).to.eql({
      tests: [
        {
          apexLogId: APEX_LOG_ID
        }
      ]
    });
    expect(writeResultFilesArgs[2]).to.equal(true);
  });

  it('should immediately return if checkpoints uploading fails', async () => {
    oneOrMoreActiveCheckpointsStub.returns(true);
    createCheckpointStub.resolves(false);
    settingStub.withArgs('retrieve-test-code-coverage').returns(true);
    buildPayloadStub.resolves({
      tests: [{ className: 'MyClass' }],
      testLevel: 'RunSpecifiedTests'
    });
    traceFlagsStub = sb.stub(TraceFlags.prototype, 'ensureTraceFlags').returns(true);
    sb.stub(projectPaths, 'debugLogsFolder').returns(LOG_DIR);
    logServiceStub = sb.stub(LogService.prototype, 'getLogs').resolves([]);
    launcherStub = sb.stub(launcher, 'launchFromLogFile');

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass']
    };
    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(createCheckpointStub.called).to.equal(true);
    expect(testServiceStub.called).to.equal(false);
    expect(logServiceStub.called).to.equal(false);
    expect(launcherStub.called).to.equal(false);
    expect(buildPayloadStub.called).to.equal(false);
    expect(writeResultFilesStub.called).to.equal(false);
  });

  it('should debug a single test method', async () => {
    oneOrMoreActiveCheckpointsStub.returns(true);
    createCheckpointStub.resolves(true);
    settingStub.withArgs('retrieve-test-code-coverage').returns(true);
    buildPayloadStub.resolves({
      tests: [{ className: 'MyClass', testMethods: ['testSomeCode'] }],
      testLevel: 'RunSpecifiedTests'
    });
    traceFlagsStub = sb.stub(TraceFlags.prototype, 'ensureTraceFlags').returns(true);
    sb.stub(projectPaths, 'debugLogsFolder').returns(LOG_DIR);
    logServiceStub = sb.stub(LogService.prototype, 'getLogs').resolves([]);
    launcherStub = sb.stub(launcher, 'launchFromLogFile');

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass', 'testSomeCode']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(oneOrMoreActiveCheckpointsStub.called).to.equal(true);
    expect(createCheckpointStub.called).to.equal(true);
    expect(buildPayloadStub.called).to.be.true;
    expect(buildPayloadStub.args[0]).to.eql([TestLevel.RunSpecifiedTests, 'MyClass.testSomeCode', 'MyClass']);
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
    expect(launcherArgs[0]).to.equal(path.join('logs', 'abcd.log'));
    expect(launcherArgs[1]).to.equal(false);
    expect(writeResultFilesStub.called).to.equal(true);
    const writeResultFilesArgs = writeResultFilesStub.getCall(0).args;
    expect(writeResultFilesArgs[0]).to.eql({
      tests: [
        {
          apexLogId: APEX_LOG_ID
        }
      ]
    });
    expect(writeResultFilesArgs[2]).to.equal(true);
  });

  it('should debug a single test method that fails', async () => {
    oneOrMoreActiveCheckpointsStub.returns(true);
    createCheckpointStub.resolves(true);
    settingStub.withArgs('retrieve-test-code-coverage').returns(true);
    buildPayloadStub.resolves({
      tests: [{ className: 'MyClass', testMethods: ['testSomeCode'] }],
      testLevel: 'RunSpecifiedTests'
    });
    traceFlagsStub = sb.stub(TraceFlags.prototype, 'ensureTraceFlags').returns(true);
    testServiceStub.resolves({} as TestResult);
    sb.stub(projectPaths, 'debugLogsFolder').returns(LOG_DIR);
    logServiceStub = sb.stub(LogService.prototype, 'getLogs').resolves([]);
    launcherStub = sb.stub(launcher, 'launchFromLogFile');

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass', 'testSomeCode']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(oneOrMoreActiveCheckpointsStub.called).to.equal(true);
    expect(createCheckpointStub.called).to.equal(true);
    expect(buildPayloadStub.called).to.be.true;
    expect(buildPayloadStub.args[0]).to.eql([TestLevel.RunSpecifiedTests, 'MyClass.testSomeCode', 'MyClass']);
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
    // Seems that there are two different error msgs:
    // On Windows: "Cannot read property 'length' of undefined"
    // On Mac: "Cannot read properties of undefined (reading 'length')"
    expect(notificationArgs[0].startsWith('Cannot read propert')).to.equal(true);
    expect(notificationArgs[0]).to.contain('undefined');
    expect(notificationArgs[0]).to.contain('length');
    expect(writeResultFilesStub.called).to.equal(true);
    const writeResultFilesArgs = writeResultFilesStub.getCall(0).args;
    expect(writeResultFilesArgs[0]).to.eql({});
    expect(writeResultFilesArgs[2]).to.equal(true);
  });

  it('should display an error for a missing test', async () => {
    oneOrMoreActiveCheckpointsStub.returns(true);
    createCheckpointStub.resolves(true);
    settingStub.withArgs('retrieve-test-code-coverage').returns(true);
    buildPayloadStub.resolves({
      tests: [{ className: 'MyClass', testMethods: ['testSomeCode'] }],
      testLevel: 'RunSpecifiedTests'
    });
    traceFlagsStub = sb.stub(TraceFlags.prototype, 'ensureTraceFlags').returns(true);
    testServiceStub.resolves({ tests: [] });

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass', 'testSomeCode']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(oneOrMoreActiveCheckpointsStub.called).to.equal(true);
    expect(createCheckpointStub.called).to.equal(true);
    expect(buildPayloadStub.called).to.be.true;
    expect(buildPayloadStub.args[0]).to.eql([TestLevel.RunSpecifiedTests, 'MyClass.testSomeCode', 'MyClass']);
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
    expect(notificationArgs[0]).to.equal(nls.localize('debug_test_no_results_found'));
    expect(writeResultFilesStub.called).to.equal(true);
    const writeResultFilesArgs = writeResultFilesStub.getCall(0).args;
    expect(writeResultFilesArgs[0]).to.eql({
      tests: []
    });
    expect(writeResultFilesArgs[2]).to.equal(true);
  });

  it('should display an error for a missing log file', async () => {
    oneOrMoreActiveCheckpointsStub.returns(true);
    createCheckpointStub.resolves(true);
    settingStub.withArgs('retrieve-test-code-coverage').returns(true);
    buildPayloadStub.resolves({
      tests: [{ className: 'MyClass', testMethods: ['testSomeCode'] }],
      testLevel: 'RunSpecifiedTests'
    });
    traceFlagsStub = sb.stub(TraceFlags.prototype, 'ensureTraceFlags').returns(true);
    testServiceStub.resolves({ tests: [{}] });

    const response: ContinueResponse<string[]> = {
      type: 'CONTINUE',
      data: ['MyClass', 'testSomeCode']
    };

    await testDebuggerExec.execute(response);

    expect(traceFlagsStub.called).to.equal(true);
    expect(oneOrMoreActiveCheckpointsStub.called).to.equal(true);
    expect(createCheckpointStub.called).to.equal(true);
    expect(buildPayloadStub.called).to.be.true;
    expect(buildPayloadStub.args[0]).to.eql([TestLevel.RunSpecifiedTests, 'MyClass.testSomeCode', 'MyClass']);
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
    expect(notificationArgs[0]).to.equal(nls.localize('debug_test_no_debug_log'));
    expect(writeResultFilesStub.called).to.equal(true);
    const writeResultFilesArgs = writeResultFilesStub.getCall(0).args;
    expect(writeResultFilesArgs[0]).to.eql({
      tests: [{}]
    });
    expect(writeResultFilesArgs[2]).to.equal(true);
  });
});
