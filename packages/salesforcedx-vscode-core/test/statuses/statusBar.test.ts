/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import {
  CliCommandExecutor,
  CommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import { CancellationTokenSource, StatusBarItem } from 'vscode';
import { nls } from '../../src/messages';
import {
  CANCEL_EXECUTION_COMMAND,
  cancelCommandExecution,
  CancellableStatusBar,
  cancellationTokenSource,
  cycleStatusBarText,
  statusBarItem,
  statusTimer
} from '../../src/statuses/statusBar';

describe('Status Bar', () => {
  let tokenSource: CancellationTokenSource;
  let execution: CommandExecution;

  beforeEach(() => {
    tokenSource = new CancellationTokenSource();
    execution = new CliCommandExecutor(
      new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
      {}
    ).execute(tokenSource.token);
  });

  it('Should set up status bar items properly', () => {
    CancellableStatusBar.show(execution, tokenSource);

    expect(cancellationTokenSource).to.not.be.undefined;
    expect(statusTimer).to.not.be.undefined;
    expect(statusBarItem.text).to.equal(
      nls.localize('status_bar_text', execution.command)
    );
    expect(statusBarItem.tooltip).to.equal(nls.localize('status_bar_tooltip'));
    expect(statusBarItem.command).to.equal(CANCEL_EXECUTION_COMMAND);
  });

  it('Should reset state after cancellation', () => {
    CancellableStatusBar.show(execution, tokenSource);
    cancelCommandExecution();

    expect(cancellationTokenSource).to.be.undefined;
    expect(statusTimer).to.be.undefined;
    expect(statusBarItem.text).to.be.empty;
    expect(statusBarItem.tooltip).to.be.empty;
    expect(statusBarItem.command).to.be.undefined;
  });

  it('Should reset state after process exit (success or failure)', async () => {
    CancellableStatusBar.show(execution, tokenSource);
    cancelCommandExecution();

    await new Promise((resolve, reject) => {
      execution.processExitSubject.subscribe(data => {
        resolve();
      });
    });

    expect(cancellationTokenSource).to.be.undefined;
    expect(statusTimer).to.be.undefined;
    expect(statusBarItem.text).to.be.empty;
    expect(statusBarItem.tooltip).to.be.empty;
    expect(statusBarItem.command).to.be.undefined;
  });

  describe('Status bar text', () => {
    it('Should append . until a limit', () => {
      const item = ({ text: 'mock' } as any) as StatusBarItem;

      // First round
      cycleStatusBarText(item);
      expect(item.text).to.equal('mock.');

      // Second round
      cycleStatusBarText(item);
      expect(item.text).to.equal('mock..');
    });
    it('Should remove all . after limit', () => {
      const item = ({ text: 'mock...' } as any) as StatusBarItem;

      cycleStatusBarText(item);
      expect(item.text).to.equal('mock');
    });
  });
});
