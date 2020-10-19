/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import {
  ApexDebugLogObject,
  ApexLibraryGetLogsExecutor,
  ApexLibraryLogListExecutor,
  forceApexLogGet,
  ForceApexLogGetExecutor,
  ForceApexLogList,
  LogFileSelector
} from '../../../src/commands/forceApexLogGet';
import { nls } from '../../../src/messages';
import { sfdxCoreSettings } from '../../../src/settings';

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
      StartTime: oldestStartTime.toISOString(),
      Status: 'Success',
      LogUser: {
        Name: 'Marco'
      }
    },
    {
      Id: 'id2',
      LogLength: 200,
      Operation: '/should/show/up/second',
      Request: 'Api',
      StartTime: olderStartTime.toISOString(),
      Status: 'Success',
      LogUser: {
        Name: 'Marco'
      }
    },
    {
      Id: 'id1',
      LogLength: 100,
      Operation: '/should/show/up/first',
      Request: 'Api',
      StartTime: newerStartTime.toISOString(),
      Status: 'Success',
      LogUser: {
        Name: 'Marco'
      }
    }
  ];

  let sb: SinonSandbox;
  let cliGetLogsStub: sinon.SinonStub;
  let showQuickPickStub: sinon.SinonStub;
  let apexLogListStub: sinon.SinonStub;
  let settingStub: SinonStub;

  before(() => {
    sb = createSandbox();
    cliGetLogsStub = sb
      .stub(ForceApexLogList, 'getLogs')
      .onFirstCall()
      .returns([])
      .onSecondCall()
      .returns(logInfos.slice(0, 1))
      .onThirdCall()
      .returns(logInfos.slice(0, 2))
      .returns(logInfos);

    apexLogListStub = sb
      .stub(ApexLibraryLogListExecutor.prototype, 'execute')
      .onFirstCall()
      .resolves({ result: [] })
      .onSecondCall()
      .resolves({ result: logInfos.slice(0, 1) })
      .onThirdCall()
      .resolves({ result: logInfos.slice(0, 1) })
      .resolves({ result: logInfos });

    showQuickPickStub = sb
      .stub(vscode.window, 'showQuickPick')
      .returns(logInfos[0]);

    settingStub = sb.stub(sfdxCoreSettings, 'getApexLibrary').returns(false);
  });

  after(() => {
    sb.restore();
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

  it('Should show error notification if no logs exist using apex library', async () => {
    settingStub.returns(true);
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    expect(showQuickPickStub.notCalled).to.be.true;
    expect(apexLogListStub.called).to.be.true;
  });

  it('Should display one logInfo using apex library', async () => {
    settingStub.returns(true);
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    showQuickPickStub.calledWith([logInfos[0]]);
    expect(apexLogListStub.called).to.be.true;
  });

  it('Should display two logInfos in reverse chronological order using apex library', async () => {
    settingStub.returns(true);
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    showQuickPickStub.calledWith([logInfos[1], logInfos[0]]);
    expect(apexLogListStub.called).to.be.true;
  });

  it('Should display the loginfos in reverse chronological order using apex library', async () => {
    settingStub.returns(true);
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    showQuickPickStub.calledWith([logInfos[2], logInfos[1], logInfos[0]]);
    expect(apexLogListStub.called).to.be.true;
  });
});

describe('use CLI Command setting', async () => {
  let sb: SinonSandbox;
  let settingStub: SinonStub;
  let apexLogGetStub: SinonStub;
  let apexLogListStub: SinonStub;
  let cliLogGetStub: SinonStub;
  let cliLogListStub: SinonStub;

  beforeEach(async () => {
    sb = createSandbox();
    settingStub = sb.stub(sfdxCoreSettings, 'getApexLibrary');
    apexLogGetStub = sb.stub(ApexLibraryGetLogsExecutor.prototype, 'execute');
    apexLogListStub = sb
      .stub(ApexLibraryLogListExecutor.prototype, 'execute')
      .resolves({ result: [] });
    cliLogGetStub = sb.stub(ForceApexLogGetExecutor.prototype, 'execute');
    cliLogListStub = sb
      .stub(ForceApexLogList, 'getLogs')
      .resolves({ result: [] });
  });

  afterEach(async () => {
    sb.restore();
  });

  it('should use the ApexLibraryGetLogsExecutor if setting is true', async () => {
    settingStub.returns(true);
    const fileSelector = sb
      .stub(LogFileSelector.prototype, 'gather')
      .returns({ type: 'CONTINUE' } as ContinueResponse<{}>);

    await forceApexLogGet();

    expect(apexLogGetStub.calledOnce).to.be.true;
    expect(cliLogGetStub.called).to.be.false;
    expect(fileSelector.called).to.be.true;
  });

  it('should use the ApexLibraryLogListExecutor if setting is true', async () => {
    settingStub.returns(true);
    await new LogFileSelector().gather();
    expect(cliLogListStub.notCalled).to.be.true;
    expect(apexLogListStub.calledOnce).to.be.true;
  });

  it('should use the ForceApexLogGetExecutor if setting is false', async () => {
    settingStub.returns(false);
    const fileSelector = sb
      .stub(LogFileSelector.prototype, 'gather')
      .returns({ type: 'CONTINUE' } as ContinueResponse<{}>);

    await forceApexLogGet();

    expect(cliLogGetStub.calledOnce).to.be.true;
    expect(fileSelector.calledOnce).to.be.true;
    expect(apexLogGetStub.called).to.be.false;
  });

  it('should use ForceApexLogList if setting is false', async () => {
    settingStub.returns(false);
    await new LogFileSelector().gather();
    expect(cliLogListStub.calledOnce).to.be.true;
    expect(apexLogListStub.notCalled).to.be.true;
  });
});
