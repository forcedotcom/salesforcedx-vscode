/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import { Subject } from 'rxjs/Subject';
import * as sinon from 'sinon';
import { SinonStub, stub } from 'sinon';
import {
  CliCommandExecutor,
  CommandExecution,
  SfdxCommandBuilder
} from '../../../src/cli';
import { nls } from '../../../src/messages';

interface Progress<T> {
  report(value: T): void;
}

const vscodeStub = {
  CancellationTokenSource: class {
    public token = {
      isCancellationRequested: false,
      onCancellationRequested: (listener: any) => {
        return {
          dispose: () => {}
        };
      }
    };
    public cancel = () => {};
    public dispose = () => {};
  },
  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15
  },
  window: {
    withProgress: () => {}
  }
};

const { ProgressNotification } = proxyquire.noCallThru()(
  '../../../src/notifications',
  {
    vscode: vscodeStub
  }
);

// tslint:disable:no-unused-expression
describe('Progress Notification', () => {
  let tokenSource: any;
  let execution: CommandExecution;
  let withProgressStub: SinonStub;

  beforeEach(() => {
    tokenSource = new vscodeStub.CancellationTokenSource();
    execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force')
        .withArg('--help')
        .build(),
      {}
    ).execute(tokenSource.token);
    withProgressStub = stub(vscodeStub.window, 'withProgress').returns(
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
      location: vscodeStub.ProgressLocation.Notification,
      cancellable: true
    });
  });

  it('Should display progress based on given progress location', () => {
    const progressLocation = vscodeStub.ProgressLocation.Window;
    ProgressNotification.show(execution, tokenSource, progressLocation);

    expect(withProgressStub.getCall(0).args[0]).to.eql({
      title: nls.localize('progress_notification_text', execution.command),
      location: progressLocation,
      cancellable: true
    });
  });

  it('Should subscribe to the observable when given a progress reporter', async () => {
    const progressLocation = vscodeStub.ProgressLocation.Window;
    const progress: Progress<{
      message?: string;
      increment?: number;
    }> = {
      report: sinon.stub()
    };
    const token = new vscodeStub.CancellationTokenSource().token;
    withProgressStub.yields(progress, token);

    const reporter = new Subject<number>();
    const subscribeSpy = sinon.spy(reporter, 'subscribe');

    await ProgressNotification.show(
      execution,
      tokenSource,
      progressLocation,
      reporter.asObservable()
    );

    sinon.assert.calledOnce(subscribeSpy);
    sinon.assert.calledWith(subscribeSpy, sinon.match.has('next'));
    sinon.assert.calledWith(subscribeSpy, sinon.match.has('complete'));
  });

  it('Should report 100 progress when the reporter invokes complete', async () => {
    const progressLocation = vscodeStub.ProgressLocation.Window;
    const reportStub = sinon.stub();
    const progress: Progress<{
      message?: string;
      increment?: number;
    }> = {
      report: reportStub
    };
    const token = new vscodeStub.CancellationTokenSource().token;
    withProgressStub.yields(progress, token);

    const reporter = new Subject<number>();

    await ProgressNotification.show(
      execution,
      tokenSource,
      progressLocation,
      reporter.asObservable()
    );

    reporter.complete();
    sinon.assert.calledOnce(reportStub);
    sinon.assert.calledWith(reportStub, sinon.match({ increment: 100 }));
  });

  it('Should report incremental progress when the reporter invokes next', async () => {
    const progressLocation = vscodeStub.ProgressLocation.Window;
    const reportStub = sinon.stub();
    const progress: Progress<{
      message?: string;
      increment?: number;
    }> = {
      report: reportStub
    };
    const token = new vscodeStub.CancellationTokenSource().token;
    withProgressStub.yields(progress, token);

    const reporter = new Subject<number>();

    await ProgressNotification.show(
      execution,
      tokenSource,
      progressLocation,
      reporter.asObservable()
    );

    reporter.next(25);
    sinon.assert.calledOnce(reportStub);
    sinon.assert.calledWith(reportStub, sinon.match({ increment: 25 }));
  });
});
