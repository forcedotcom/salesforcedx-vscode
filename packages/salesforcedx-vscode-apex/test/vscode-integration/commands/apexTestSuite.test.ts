/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestService } from '@salesforce/apex-node-bundle';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import * as vscode from 'vscode';
import { ApexTestQuickPickItem, TestType } from '../../../src/commands/apexTestRun';
import {
  ApexTestSuiteOptions,
  TestSuiteBuilder,
  TestSuiteCreator,
  TestSuiteSelector
} from '../../../src/commands/apexTestSuite';
import { workspaceContext } from '../../../src/context';

const sb = createSandbox();

describe('Test Suite Selector', () => {
  let quickPickStub: sinon.SinonStub;

  beforeEach(() => {
    sb.stub(workspaceContext, 'getConnection');
    quickPickStub = sb.stub(vscode.window, 'showQuickPick').returns({
      label: 'SuiteOne',
      type: TestType.Suite
    });

    sb.stub(TestService.prototype, 'retrieveAllSuites').resolves([
      { TestSuiteName: 'SuiteOne', Id: 'xxxxxxxxxxx27343' },
      { TestSuiteName: 'SuiteTwo', Id: 'xxxxxxxxxxx27343' }
    ]);
  });

  afterEach(() => {
    sb.restore();
  });

  it('Should have two test suites', async () => {
    const gatherer = new TestSuiteSelector();
    const result = await gatherer.gather();

    expect(result.type).to.equal('CONTINUE');
    expect(quickPickStub.getCall(0).args.length).to.equal(1);
    const fileItems: ApexTestQuickPickItem[] = quickPickStub.getCall(0).args[0];
    expect(fileItems.length).to.equal(2);
    expect(fileItems[0].label).to.equal('SuiteOne');
    expect(fileItems[0].type).to.equal(TestType.Suite);
    expect(fileItems[1].label).to.equal('SuiteTwo');
    expect(fileItems[1].type).to.equal(TestType.Suite);
  });

  it('Should select suite one', async () => {
    const gatherer = new TestSuiteSelector();
    const result = await gatherer.gather();

    expect(result.type).to.equal('CONTINUE');
    expect((result as ContinueResponse<ApexTestQuickPickItem>).data).to.eql({
      label: 'SuiteOne',
      type: TestType.Suite
    });
  });
});

describe('Test Suite Builder', () => {
  let quickPickStub: sinon.SinonStub;

  beforeEach(() => {
    sb.stub(workspaceContext, 'getConnection');
    quickPickStub = sb.stub(vscode.window, 'showQuickPick').returns([
      {
        label: 'SuiteOne',
        type: TestType.Suite
      }
    ]);

    sb.stub(TestService.prototype, 'retrieveAllSuites').resolves([
      { TestSuiteName: 'SuiteOne', Id: 'xxxxxxxxxxx27343' },
      { TestSuiteName: 'SuiteTwo', Id: 'xxxxxxxxxxx27343' }
    ]);
  });

  afterEach(() => {
    sb.restore();
  });

  it('Should have two test suites', async () => {
    const gatherer = new TestSuiteBuilder();
    const result = await gatherer.gather();

    expect(result.type).to.equal('CONTINUE');
    expect(quickPickStub.getCall(0).args.length).to.equal(1);
    const fileItems: ApexTestQuickPickItem[] = quickPickStub.getCall(0).args[0];
    expect(fileItems.length).to.equal(2);
    expect(fileItems[0].label).to.equal('SuiteOne');
    expect(fileItems[0].type).to.equal(TestType.Suite);
    expect(fileItems[1].label).to.equal('SuiteTwo');
    expect(fileItems[1].type).to.equal(TestType.Suite);
  });

  it('Should select suite one', async () => {
    const gatherer = new TestSuiteBuilder();
    const result = await gatherer.gather();

    expect(result.type).to.equal('CONTINUE');
    expect((result as ContinueResponse<ApexTestSuiteOptions>).data).to.eql({
      suitename: undefined,
      tests: ['SuiteOne']
    });
  });
});

describe('Test Suite Creator', async () => {
  let quickPickStub: sinon.SinonStub;

  beforeEach(async () => {
    sb.stub(workspaceContext, 'getConnection');
    quickPickStub = sb.stub(vscode.window, 'showQuickPick').returns([
      {
        label: 'NewClass',
        type: TestType.Class
      }
    ]);
    sb.stub(vscode.window, 'showInputBox').resolves('NewSuite');
  });

  afterEach(async () => {
    sb.restore();
  });

  it('Should create Test Suite and select one Apex Class', async () => {
    const gatherer = new TestSuiteCreator();
    const result = await gatherer.gather();

    expect(result.type).to.equal('CONTINUE');
    expect(quickPickStub.getCall(0).args.length).to.equal(2);
    const fileItems: ApexTestQuickPickItem[] = quickPickStub.getCall(0).args[0];
    expect(fileItems.length).to.equal(1);
    expect(fileItems[0].label).to.equal('DemoControllerTests');
    expect(fileItems[0].type).to.equal(TestType.Class);
  });
});
