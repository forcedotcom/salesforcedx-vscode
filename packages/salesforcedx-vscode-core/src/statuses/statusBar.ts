import {
  CancellationTokenSource,
  StatusBarItem,
  StatusBarAlignment,
  window
} from 'vscode';

import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export const CANCEL_EXECUTION_COMMAND = 'internal.cancel.execution.command';
const ALIGNMENT = StatusBarAlignment.Left;
const PRIORITY = -10;

const statusBarItem: StatusBarItem = window.createStatusBarItem(
  ALIGNMENT,
  PRIORITY
);
let statusTimer: NodeJS.Timer | null;
let cancellationTokenSource: CancellationTokenSource | null;

export class CancellableStatusBar {
  public static show(
    execution: CommandExecution,
    token: CancellationTokenSource
  ) {
    return new CancellableStatusBar(execution, token);
  }

  private constructor(
    execution: CommandExecution,
    token: CancellationTokenSource
  ) {
    resetStatusBarItem();

    statusBarItem.text = `$(x) ${execution.command}`;
    statusBarItem.tooltip = 'Click to cancel the command';
    statusBarItem.command = CANCEL_EXECUTION_COMMAND;

    cancellationTokenSource = token;

    if (statusTimer) {
      clearInterval(statusTimer);
    }
    statusTimer = setInterval(cycleStatusBarText, 1000);
    execution.processExitSubject.subscribe(data => {
      if (statusTimer) {
        clearInterval(statusTimer);
      }
      statusBarItem.hide();
    });

    statusBarItem.show();
  }
}

function resetStatusBarItem() {
  statusBarItem.text = '';
  statusBarItem.tooltip = '';
  statusBarItem.command = undefined;
}

function cycleStatusBarText() {
  statusBarItem.text = statusBarItem.text + '.';
  if (/\.\.\.\.$/.test(statusBarItem.text)) {
    // Reset the ellipsis and cycle
    statusBarItem.text = statusBarItem.text.replace(/\.\.\.\.$/, '');
  }
}

export function cancelCommandExecution() {
  if (cancellationTokenSource) {
    cancellationTokenSource.cancel();
    resetStatusBarItem();
    if (statusTimer) {
      clearInterval(statusTimer);
    }
  }
}
