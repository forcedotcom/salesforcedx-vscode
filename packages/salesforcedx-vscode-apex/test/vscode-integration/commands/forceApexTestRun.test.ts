/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestLevel, TestService } from '@salesforce/apex-node';
import {
  EmptyParametersGatherer,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import { TestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonSpy, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import {
  ApexLibraryTestRunExecutor,
  ApexTestQuickPickItem,
  forceApexTestRun,
  ForceApexTestRunExecutor,
  TestsSelector,
  TestType
} from '../../../src/commands/forceApexTestRun';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';
import * as settings from '../../../src/settings';

const sb = createSandbox();

describe('Force Apex Test Run', () => {
  const testResultsOutput = join('test', 'results', 'apex');

  let retrieveCoverageStub: SinonStub;

  beforeEach(() => {
    retrieveCoverageStub = sb
      .stub(settings, 'retrieveTestCodeCoverage')
      .returns(false);
    sb.stub(TestRunner.prototype, 'getTempFolder').returns(testResultsOutput);
  });

  afterEach(() => sb.restore());

  describe('Command builder', () => {
    const builder = new ForceApexTestRunExecutor();

    it('Should build command for test suite', () => {
      const command = builder.build({
        label: 'MySuite',
        description: '',
        type: TestType.Suite
      });

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --suitenames MySuite --resultformat human --outputdir ${testResultsOutput} --loglevel error`
      );
      expect(command.description).to.equal(
        nls.localize('force_apex_test_run_text')
      );
    });

    it('Should build command for single class', () => {
      const command = builder.build({
        label: 'MyTestClass',
        description: '',
        type: TestType.Class
      });

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --classnames MyTestClass --resultformat human --outputdir ${testResultsOutput} --loglevel error`
      );
      expect(command.description).to.equal(
        nls.localize('force_apex_test_run_text')
      );
    });

    it('Should build command for all tests', () => {
      const command = builder.build({
        label: nls.localize('force_apex_test_run_all_test_label'),
        description: nls.localize(
          'force_apex_test_run_all_tests_description_text'
        ),
        type: TestType.All
      });

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --resultformat human --outputdir ${testResultsOutput} --loglevel error`
      );
      expect(command.description).to.equal(
        nls.localize('force_apex_test_run_text')
      );
    });
  });

  describe('Apex Library Test Run Executor', async () => {
    let runTestStub: sinon.SinonStub;

    beforeEach(async () => {
      retrieveCoverageStub.returns(true);
      runTestStub = sb.stub(TestService.prototype, 'runTestAsynchronous');
      sb.stub(workspaceContext, 'getConnection');
    });

    it('should run test with correct parameters for specified class', async () => {
      const apexLibExecutor = new ApexLibraryTestRunExecutor();
      await apexLibExecutor.execute({
        data: { type: TestType.Class, label: 'testClass' },
        type: 'CONTINUE'
      });

      expect(runTestStub.args[0]).to.deep.equal([
        { classNames: 'testClass', testLevel: TestLevel.RunSpecifiedTests },
        true
      ]);
    });

    it('should run test with correct parameters for specified suite', async () => {
      const apexLibExecutor = new ApexLibraryTestRunExecutor();
      await apexLibExecutor.execute({
        data: { type: TestType.Suite, label: 'testSuite' },
        type: 'CONTINUE'
      });

      expect(runTestStub.args[0]).to.deep.equal([
        { suiteNames: 'testSuite', testLevel: TestLevel.RunSpecifiedTests },
        true
      ]);
    });

    it('should run test with correct parameters for all tests', async () => {
      const apexLibExecutor = new ApexLibraryTestRunExecutor();
      await apexLibExecutor.execute({
        data: { type: TestType.All, label: '' },
        type: 'CONTINUE'
      });

      expect(runTestStub.args[0]).to.deep.equal([
        { testLevel: TestLevel.RunAllTestsInOrg },
        true
      ]);
    });
  });

  // tslint:disable:no-unused-expression
  describe('Use Apex Library Setting', () => {
    let settingStub: SinonStub;
    let apexExecutorStub: SinonSpy;
    let cliExecutorStub: SinonSpy;

    beforeEach(async () => {
      settingStub = sb.stub(settings, 'useApexLibrary');
      apexExecutorStub = sb.spy(
        ApexLibraryTestRunExecutor.prototype,
        'execute'
      );
      cliExecutorStub = sb.spy(ForceApexTestRunExecutor.prototype, 'execute');
      sb.stub(EmptyParametersGatherer.prototype, 'gather');
      sb.stub(SfdxWorkspaceChecker.prototype, 'check');
    });

    it('should use the ApexLibraryTestRunExecutor if setting is true', async () => {
      settingStub.returns(true);
      await forceApexTestRun();
      expect(cliExecutorStub.called).to.be.false;
    });

    it('should use the ForceApexTestRunExecutor if setting is false', async () => {
      settingStub.returns(false);
      await forceApexTestRun();
      expect(apexExecutorStub.called).to.be.false;
    });
  });

  describe('Tests selector', () => {
    let quickPickStub: sinon.SinonStub;

    beforeEach(() => {
      quickPickStub = sb.stub(vscode.window, 'showQuickPick').returns({
        label: nls.localize('force_apex_test_run_all_test_label'),
        description: nls.localize(
          'force_apex_test_run_all_tests_description_text'
        ),
        type: TestType.All
      });
    });

    it('Should have test suite and class', async () => {
      const gatherer = new TestsSelector();
      const result = await gatherer.gather();

      expect(result.type).to.equal('CONTINUE');
      expect(quickPickStub.getCall(0).args.length).to.equal(1);
      const fileItems: ApexTestQuickPickItem[] = quickPickStub.getCall(0)
        .args[0];
      expect(fileItems.length).to.equal(3);
      expect(fileItems[0].label).to.equal('DemoSuite');
      expect(fileItems[0].type).to.equal(TestType.Suite);
      expect(fileItems[2].label).to.equal('DemoControllerTests');
      expect(fileItems[2].type).to.equal(TestType.Class);
      expect(fileItems[1].label).to.equal(
        nls.localize('force_apex_test_run_all_test_label')
      );
      expect(fileItems[1].description).to.equal(
        nls.localize('force_apex_test_run_all_tests_description_text')
      );
      expect(fileItems[1].type).to.equal(TestType.All);
    });
  });
});
