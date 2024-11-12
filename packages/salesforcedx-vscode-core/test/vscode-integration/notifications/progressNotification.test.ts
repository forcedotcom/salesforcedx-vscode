/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor, CommandExecution, SfCommandBuilder } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { Subject } from 'rxjs/Subject';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import { ProgressNotification } from '../../../src/notifications';

// tslint:disable:no-unused-expression
describe('Progress Notification', () => {
  let tokenSource: vscode.CancellationTokenSource;
  let execution: CommandExecution;
  beforeEach(() => {
    tokenSource = new vscode.CancellationTokenSource();
    execution = new CliCommandExecutor(new SfCommandBuilder().withArg('--help').build(), {}).execute(tokenSource.token);
  });

  it('Should display progress as a cancellable notification', async () => {
    const withProgressStub = sinon.stub(vscode.window, 'withProgress').returns(Promise.resolve());

    ProgressNotification.show(execution, tokenSource);

    expect(withProgressStub.called).to.be.true;
    expect(withProgressStub.getCall(0).args[0]).to.eql({
      title: nls.localize('progress_notification_text', execution.command),
      location: vscode.ProgressLocation.Notification,
      cancellable: true
    });
    withProgressStub.restore();
  });

  it('Should display progress based on given progress location', () => {
    const progressLocation = vscode.ProgressLocation.Window;
    const withProgressStub = sinon.stub(vscode.window, 'withProgress').returns(Promise.resolve());

    ProgressNotification.show(execution, tokenSource, progressLocation);

    expect(withProgressStub.getCall(0).args[0]).to.eql({
      title: nls.localize('progress_notification_text', execution.command),
      location: progressLocation,
      cancellable: true
    });
    withProgressStub.restore();
  });

  it('Should subscribe to the observable when given a progress reporter', async () => {
    const progressLocation = vscode.ProgressLocation.Window;
    const withProgressStub = sinon.stub(vscode.window, 'withProgress').returns(Promise.resolve());

    const progress: vscode.Progress<{
      message?: string;
      increment?: number;
    }> = {
      report: sinon.stub()
    };
    const token = new vscode.CancellationTokenSource().token;
    withProgressStub.yields(progress, token);

    const reporter = new Subject<number>();
    const subscribeSpy = sinon.spy(reporter, 'subscribe');

    await ProgressNotification.show(execution, tokenSource, progressLocation, reporter.asObservable());

    sinon.assert.calledOnce(subscribeSpy);
    sinon.assert.calledWith(subscribeSpy, sinon.match.has('next'));
    sinon.assert.calledWith(subscribeSpy, sinon.match.has('complete'));

    withProgressStub.restore();
  });

  it('Should report 100 progress when the reporter invokes complete', async () => {
    const progressLocation = vscode.ProgressLocation.Window;
    const withProgressStub = sinon.stub(vscode.window, 'withProgress').returns(Promise.resolve());

    const reportStub = sinon.stub();
    const progress: vscode.Progress<{
      message?: string;
      increment?: number;
    }> = {
      report: reportStub
    };
    const token = new vscode.CancellationTokenSource().token;
    withProgressStub.yields(progress, token);

    const reporter = new Subject<number>();

    await ProgressNotification.show(execution, tokenSource, progressLocation, reporter.asObservable());

    reporter.complete();
    sinon.assert.calledOnce(reportStub);
    sinon.assert.calledWith(reportStub, sinon.match({ increment: 100 }));

    withProgressStub.restore();
  });

  it('Should report incremental progress when the reporter invokes next', async () => {
    const progressLocation = vscode.ProgressLocation.Window;
    const withProgressStub = sinon.stub(vscode.window, 'withProgress').returns(Promise.resolve());

    const reportStub = sinon.stub();
    const progress: vscode.Progress<{
      message?: string;
      increment?: number;
    }> = {
      report: reportStub
    };
    const token = new vscode.CancellationTokenSource().token;
    withProgressStub.yields(progress, token);

    const reporter = new Subject<number>();

    await ProgressNotification.show(execution, tokenSource, progressLocation, reporter.asObservable());

    reporter.next(25);
    sinon.assert.calledOnce(reportStub);
    sinon.assert.calledWith(reportStub, sinon.match({ increment: 25 }));

    withProgressStub.restore();
  });
});
