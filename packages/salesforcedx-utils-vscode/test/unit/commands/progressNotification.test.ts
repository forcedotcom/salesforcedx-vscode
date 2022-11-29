/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Subject } from 'rxjs/Subject';
import { assert, match, SinonStub, spy, stub } from 'sinon';
import * as vscode from 'vscode';
import { ProgressNotification } from '../../../src';
import {
  CliCommandExecutor,
  CommandExecution,
  SfdxCommandBuilder
} from '../../../src/cli';
import { nls } from '../../../src/messages';

interface Progress<T> {
  report(value: T): void;
}

// tslint:disable:no-unused-expression
describe('Progress Notification', () => {
  let tokenSource: any;
  let execution: CommandExecution;
  let withProgressStub: SinonStub;

  beforeEach(() => {
    tokenSource = new vscode.CancellationTokenSource();
    execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force')
        .withArg('--help')
        .build(),
      {}
    ).execute(tokenSource.token);
    withProgressStub = stub(vscode.window, 'withProgress').returns(
      Promise.resolve()
    );
  });

  afterEach(() => {
    withProgressStub.restore();
  });

  it('Should display progress as a cancellable notification', async () => {
    ProgressNotification.show(execution, tokenSource);

    expect(withProgressStub.called).to.be.true;
    expect(withProgressStub.getCall(0).args[0]).to.eql({
      title: nls.localize('progress_notification_text', execution.command),
      location: vscode.ProgressLocation.Notification,
      cancellable: true
    });
  });

  it('Should display progress based on given progress location', () => {
    const progressLocation = vscode.ProgressLocation.Window;
    ProgressNotification.show(execution, tokenSource, progressLocation);

    expect(withProgressStub.getCall(0).args[0]).to.eql({
      title: nls.localize('progress_notification_text', execution.command),
      location: progressLocation,
      cancellable: true
    });
  });

  it('Should subscribe to the observable when given a progress reporter', async () => {
    const progressLocation = vscode.ProgressLocation.Window;
    const progress: Progress<{
      message?: string;
      increment?: number;
    }> = {
      report: stub()
    };
    const token = new vscode.CancellationTokenSource().token;
    withProgressStub.yields(progress, token);

    const reporter = new Subject<number>();
    const subscribeSpy = spy(reporter, 'subscribe');

    await ProgressNotification.show(
      execution,
      tokenSource,
      progressLocation,
      reporter.asObservable()
    );

    assert.calledOnce(subscribeSpy);
    assert.calledWith(subscribeSpy, match.has('next'));
    assert.calledWith(subscribeSpy, match.has('complete'));
  });

  it('Should report 100 progress when the reporter invokes complete', async () => {
    const progressLocation = vscode.ProgressLocation.Window;
    const reportStub = stub();
    const progress: Progress<{
      message?: string;
      increment?: number;
    }> = {
      report: reportStub
    };
    const token = new vscode.CancellationTokenSource().token;
    withProgressStub.yields(progress, token);

    const reporter = new Subject<number>();

    await ProgressNotification.show(
      execution,
      tokenSource,
      progressLocation,
      reporter.asObservable()
    );

    reporter.complete();
    assert.calledOnce(reportStub);
    assert.calledWith(reportStub, match({ increment: 100 }));
  });

  it('Should report incremental progress when the reporter invokes next', async () => {
    const progressLocation = vscode.ProgressLocation.Window;
    const reportStub = stub();
    const progress: Progress<{
      message?: string;
      increment?: number;
    }> = {
      report: reportStub
    };
    const token = new vscode.CancellationTokenSource().token;
    withProgressStub.yields(progress, token);

    const reporter = new Subject<number>();

    await ProgressNotification.show(
      execution,
      tokenSource,
      progressLocation,
      reporter.asObservable()
    );

    reporter.next(25);
    assert.calledOnce(reportStub);
    assert.calledWith(reportStub, match({ increment: 25 }));
  });
});
