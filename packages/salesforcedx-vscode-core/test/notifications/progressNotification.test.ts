/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import {
  CliCommandExecutor,
  CommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { nls } from '../../src/messages';
import { ProgressNotification } from './../../src/notifications/progressNotification';

// tslint:disable:no-unused-expression
describe('Progress Notification', () => {
  let tokenSource: vscode.CancellationTokenSource;
  let execution: CommandExecution;
  beforeEach(() => {
    tokenSource = new vscode.CancellationTokenSource();
    execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force')
        .withArg('--help')
        .build(),
      {}
    ).execute(tokenSource.token);
  });

  it('Should display progress as a cancellable notification', async () => {
    const withProgressStub = sinon
      .stub(vscode.window, 'withProgress')
      .returns(Promise.resolve());

    ProgressNotification.show(execution, tokenSource);

    expect(withProgressStub.called).to.be.true;
    expect(withProgressStub.getCall(0).args[0]).to.eql({
      title: nls.localize('progress_notification_text', execution.command),
      location: vscode.ProgressLocation.Notification,
      cancellable: true
    });
    withProgressStub.restore();
  });
});
