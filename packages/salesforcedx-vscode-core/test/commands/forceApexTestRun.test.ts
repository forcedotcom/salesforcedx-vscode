/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  ApexTestQuickPickItem,
  ForceApexTestRunExecutor,
  TestsSelector,
  TestType
} from '../../src/commands/forceApexTestRun';
import { nls } from '../../src/messages';

describe('Force Apex Test Run', () => {
  describe('Command builder', () => {
    const builder = new ForceApexTestRunExecutor();

    it('Should build command for test suite', () => {
      const command = builder.build({
        label: 'MySuite',
        description: '',
        type: TestType.Suite
      });

      expect(command.toCommand()).to.equal(
        'sfdx force:apex:test:run --suitenames MySuite --resultformat human --loglevel error'
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
        'sfdx force:apex:test:run --classnames MyTestClass --synchronous --resultformat human --loglevel error'
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
        'sfdx force:apex:test:run --resultformat human --loglevel error'
      );
      expect(command.description).to.equal(
        nls.localize('force_apex_test_run_text')
      );
    });
  });

  describe('Tests selector', () => {
    let quickPickStub: sinon.SinonStub;
    beforeEach(() => {
      quickPickStub = sinon.stub(vscode.window, 'showQuickPick').returns({
        label: nls.localize('force_apex_test_run_all_test_label'),
        description: nls.localize(
          'force_apex_test_run_all_tests_description_text'
        ),
        type: TestType.All
      });
    });

    afterEach(() => {
      quickPickStub.restore();
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
      expect(fileItems[1].label).to.equal('DemoControllerTests');
      expect(fileItems[1].type).to.equal(TestType.Class);
      expect(fileItems[2].label).to.equal(
        nls.localize('force_apex_test_run_all_test_label')
      );
      expect(fileItems[2].description).to.equal(
        nls.localize('force_apex_test_run_all_tests_description_text')
      );
      expect(fileItems[2].type).to.equal(TestType.All);
    });
  });
});
