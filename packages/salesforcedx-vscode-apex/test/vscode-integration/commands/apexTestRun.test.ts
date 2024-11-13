/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { HumanReporter, TestLevel, TestService } from '@salesforce/apex-node-bundle';
import { expect } from 'chai';
import { assert, createSandbox, match, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import {
  ApexLibraryTestRunExecutor,
  ApexTestQuickPickItem,
  TestsSelector,
  TestType
} from '../../../src/commands/apexTestRun';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';
import * as settings from '../../../src/settings';

const sb = createSandbox();

/* tslint:disable:no-unused-expression */
describe('Apex Library Test Run Executor', async () => {
  let runTestStub: SinonStub;
  let buildPayloadStub: SinonStub;
  let writeResultFilesStub: SinonStub;
  let reportStub: SinonStub;
  let progress: vscode.Progress<unknown>;
  let cancellationTokenEventEmitter;
  let cancellationToken: vscode.CancellationToken;

  beforeEach(async () => {
    sb.stub(settings, 'retrieveTestCodeCoverage').returns(true);
    runTestStub = sb.stub(TestService.prototype, 'runTestAsynchronous');
    sb.stub(workspaceContext, 'getConnection');
    buildPayloadStub = sb.stub(TestService.prototype, 'buildAsyncPayload');
    sb.stub(HumanReporter.prototype, 'format');
    writeResultFilesStub = sb.stub(TestService.prototype, 'writeResultFiles');

    reportStub = sb.stub();
    progress = { report: reportStub };
    cancellationTokenEventEmitter = new vscode.EventEmitter();
    cancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: cancellationTokenEventEmitter.event
    };
  });

  afterEach(async () => {
    sb.restore();
  });

  it('should run test with correct parameters for specified class', async () => {
    buildPayloadStub.resolves({
      classNames: 'testClass',
      testLevel: TestLevel.RunSpecifiedTests
    });

    const apexLibExecutor = new ApexLibraryTestRunExecutor();
    await apexLibExecutor.run(
      {
        data: { type: TestType.Class, label: 'testClass' },
        type: 'CONTINUE'
      },
      progress,
      cancellationToken
    );
    expect(buildPayloadStub.called).to.be.true;
    expect(buildPayloadStub.args[0]).to.eql(['RunSpecifiedTests', undefined, 'testClass']);
    assert.calledOnce(runTestStub);
    assert.calledWith(
      runTestStub,
      {
        classNames: 'testClass',
        testLevel: TestLevel.RunSpecifiedTests
      },
      true,
      false,
      match.any,
      cancellationToken
    );
  });

  it('should run test with correct parameters for specified suite', async () => {
    buildPayloadStub.resolves({
      suiteNames: 'testSuite',
      testLevel: TestLevel.RunSpecifiedTests
    });

    const apexLibExecutor = new ApexLibraryTestRunExecutor();
    await apexLibExecutor.run(
      {
        data: { type: TestType.Suite, label: 'testSuite' },
        type: 'CONTINUE'
      },
      progress,
      cancellationToken
    );

    expect(buildPayloadStub.called).to.be.true;
    expect(buildPayloadStub.args[0]).to.eql(['RunSpecifiedTests', undefined, undefined, 'testSuite']);
    assert.calledOnce(runTestStub);
    assert.calledWith(
      runTestStub,
      { suiteNames: 'testSuite', testLevel: TestLevel.RunSpecifiedTests },
      true,
      false,
      match.any,
      cancellationToken
    );
  });

  it('should run test with correct parameters for all tests', async () => {
    const apexLibExecutor = new ApexLibraryTestRunExecutor();
    await apexLibExecutor.run(
      {
        data: { type: TestType.AllLocal, label: '' },
        type: 'CONTINUE'
      },
      progress,
      cancellationToken
    );

    assert.calledOnce(runTestStub);
    assert.calledWith(runTestStub, { testLevel: TestLevel.RunLocalTests }, true, false, match.any, cancellationToken);
  });

  it('should run test with correct parameters for all tests', async () => {
    const apexLibExecutor = new ApexLibraryTestRunExecutor();
    await apexLibExecutor.run(
      {
        data: { type: TestType.All, label: '' },
        type: 'CONTINUE'
      },
      progress,
      cancellationToken
    );

    assert.calledOnce(runTestStub);
    assert.calledWith(
      runTestStub,
      { testLevel: TestLevel.RunAllTestsInOrg },
      true,
      false,
      match.any,
      cancellationToken
    );
  });

  it('should report progress', async () => {
    const apexLibExecutor = new ApexLibraryTestRunExecutor();
    runTestStub.callsFake((payload, codecoverage, exitEarly, progressReporter, token) => {
      progressReporter.report({
        type: 'StreamingClientProgress',
        value: 'streamingTransportUp',
        message: 'Listening for streaming state changes...'
      });
      progressReporter.report({
        type: 'StreamingClientProgress',
        value: 'streamingProcessingTestRun',
        message: 'Processing test run 707500000000000001',
        testRunId: '707500000000000001'
      });
      progressReporter.report({
        type: 'FormatTestResultProgress',
        value: 'retrievingTestRunSummary',
        message: 'Retrieving test run summary record'
      });
      progressReporter.report({
        type: 'FormatTestResultProgress',
        value: 'queryingForAggregateCodeCoverage',
        message: 'Querying for aggregate code coverage results'
      });
    });

    await apexLibExecutor.run(
      {
        data: { type: TestType.All, label: '' },
        type: 'CONTINUE'
      },
      progress,
      cancellationToken
    );

    assert.calledWith(reportStub, {
      message: 'Listening for streaming state changes...'
    });
    assert.calledWith(reportStub, {
      message: 'Processing test run 707500000000000001'
    });
    assert.calledWith(reportStub, {
      message: 'Retrieving test run summary record'
    });
    assert.calledWith(reportStub, {
      message: 'Querying for aggregate code coverage results'
    });
  });

  it('should return if cancellation is requested', async () => {
    const apexLibExecutor = new ApexLibraryTestRunExecutor();
    runTestStub.callsFake(() => {
      cancellationToken.isCancellationRequested = true;
    });

    const result = await apexLibExecutor.run(
      {
        data: { type: TestType.All, label: '' },
        type: 'CONTINUE'
      },
      progress,
      cancellationToken
    );

    assert.calledOnce(runTestStub);
    assert.notCalled(writeResultFilesStub);
    expect(result).to.eql(false);
  });

  describe('Tests selector', () => {
    let quickPickStub: sinon.SinonStub;

    beforeEach(() => {
      quickPickStub = sb.stub(vscode.window, 'showQuickPick').returns({
        label: nls.localize('apex_test_run_all_test_label'),
        description: nls.localize('apex_test_run_all_tests_description_text'),
        type: TestType.All
      });
    });

    it('Should have test suite and class', async () => {
      const gatherer = new TestsSelector();
      const result = await gatherer.gather();

      expect(result.type).to.equal('CONTINUE');
      expect(quickPickStub.getCall(0).args.length).to.equal(1);
      const fileItems: ApexTestQuickPickItem[] = quickPickStub.getCall(0).args[0];
      expect(fileItems.length).to.equal(4);
      expect(fileItems[0].label).to.equal('DemoSuite');
      expect(fileItems[0].type).to.equal(TestType.Suite);
      expect(fileItems[3].label).to.equal('DemoControllerTests');
      expect(fileItems[3].type).to.equal(TestType.Class);
      expect(fileItems[1].label).to.equal(nls.localize('apex_test_run_all_local_test_label'));
      expect(fileItems[1].description).to.equal(nls.localize('apex_test_run_all_local_tests_description_text'));
      expect(fileItems[1].type).to.equal(TestType.AllLocal);
      expect(fileItems[2].label).to.equal(nls.localize('apex_test_run_all_test_label'));
      expect(fileItems[2].description).to.equal(nls.localize('apex_test_run_all_tests_description_text'));
      expect(fileItems[2].type).to.equal(TestType.All);
    });
  });
});
