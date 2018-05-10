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
  ApexDebugLogObject,
  ForceApexLogGetExecutor,
  ForceApexLogList,
  LogFileSelector
} from '../../src/commands/forceApexLogGet';
import { nls } from '../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Apex Log Get Logging', () => {
  const newerStartTime = new Date(Date.now());
  const olderStartTime = new Date(Date.now() - 10 * 60000);
  const oldestStartTime = new Date(Date.now() - 20 * 60000);
  const logInfos: ApexDebugLogObject[] = [
    {
      Id: 'id3',
      LogLength: 300,
      Operation: '/should/show/up/third',
      Request: 'Api',
      StartTime: oldestStartTime.toISOString()
    },
    {
      Id: 'id2',
      LogLength: 200,
      Operation: '/should/show/up/second',
      Request: 'Api',
      StartTime: olderStartTime.toISOString()
    },
    {
      Id: 'id1',
      LogLength: 100,
      Operation: '/should/show/up/first',
      Request: 'Api',
      StartTime: newerStartTime.toISOString()
    }
  ];

  let getLogsStub: sinon.SinonStub;
  let showQuickPickStub: sinon.SinonStub;

  before(() => {
    getLogsStub = sinon
      .stub(ForceApexLogList, 'getLogs')
      .onFirstCall()
      .returns([])
      .onSecondCall()
      .returns(logInfos.slice(0, 1))
      .onThirdCall()
      .returns(logInfos.slice(0, 2))
      .returns(logInfos);

    showQuickPickStub = sinon
      .stub(vscode.window, 'showQuickPick')
      .returns(logInfos[0]);
  });

  after(() => {
    getLogsStub.restore();
    showQuickPickStub.restore();
  });

  it('Should build the start logging command and only have description set', () => {
    const LOG_ID = 'fakeLogId';
    const apexLogGetExecutor = new ForceApexLogGetExecutor();
    const startLoggingCmd = apexLogGetExecutor.build({
      id: LOG_ID,
      startTime: new Date().toDateString()
    });
    expect(startLoggingCmd.description).to.equal(
      nls.localize('force_apex_log_get_text')
    );
    expect(startLoggingCmd.toCommand()).to.equal(
      `sfdx force:apex:log:get --logid ${LOG_ID} --json --loglevel fatal`
    );
  });

  it('Should show error notification if no logs exist', async () => {
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    expect(showQuickPickStub.notCalled).to.be.true;
  });

  it('Should display one logInfo', async () => {
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    showQuickPickStub.calledWith([logInfos[0]]);
  });

  it('Should display two logInfos in reverse chronological order', async () => {
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    showQuickPickStub.calledWith([logInfos[1], logInfos[0]]);
  });

  it('Should display the loginfos in reverse chronological order', async () => {
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    showQuickPickStub.calledWith([logInfos[2], logInfos[1], logInfos[0]]);
  });
});
