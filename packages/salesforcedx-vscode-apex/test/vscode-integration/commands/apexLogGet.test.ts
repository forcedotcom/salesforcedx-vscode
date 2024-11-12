/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { createSandbox, SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import { ApexDebugLogObject, LogFileSelector } from '../../../src/commands/apexLogGet';

// tslint:disable:no-unused-expression
describe('Apex Log Get Logging', () => {
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
  let showQuickPickStub: sinon.SinonStub;
  let apexLogListStub: sinon.SinonStub;

  beforeEach(() => {
    sb = createSandbox();
    apexLogListStub = sb
      .stub(LogFileSelector.prototype, 'getLogRecords')
      .onFirstCall()
      .resolves([])
      .onSecondCall()
      .resolves(logInfos.slice(0, 1))
      .onThirdCall()
      .resolves(logInfos.slice(0, 1))
      .resolves(logInfos);

    showQuickPickStub = sb.stub(vscode.window, 'showQuickPick').returns(logInfos[0]);
  });

  afterEach(() => {
    sb.restore();
  });

  it('Should show error notification if no logs exist using apex library', async () => {
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    expect(showQuickPickStub.called).to.be.false;
    expect(apexLogListStub.called).to.be.true;
  });

  it('Should display one logInfo using apex library', async () => {
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    showQuickPickStub.calledWith([logInfos[0]]);
    expect(apexLogListStub.called).to.be.true;
  });

  it('Should display two logInfos in reverse chronological order using apex library', async () => {
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    showQuickPickStub.calledWith([logInfos[1], logInfos[0]]);
    expect(apexLogListStub.called).to.be.true;
  });

  it('Should display the loginfos in reverse chronological order using apex library', async () => {
    const logFileSelector = new LogFileSelector();
    await logFileSelector.gather();
    showQuickPickStub.calledWith([logInfos[2], logInfos[1], logInfos[0]]);
    expect(apexLogListStub.called).to.be.true;
  });
});
