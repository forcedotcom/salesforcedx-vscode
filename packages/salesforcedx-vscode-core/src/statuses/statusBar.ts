import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancellationTokenSource,
  StatusBarAlignment,
  StatusBarItem,
  window
} from 'vscode';
import { nls } from '../../src/messages';

export const CANCEL_EXECUTION_COMMAND = 'internal.cancel.execution.command';
const ALIGNMENT = StatusBarAlignment.Left;
const PRIORITY = -10;

export const statusBarItem: StatusBarItem = window.createStatusBarItem(
  ALIGNMENT,
  PRIORITY
);
export let statusTimer: NodeJS.Timer | undefined;
export let cancellationTokenSource: CancellationTokenSource | undefined;

/**
 * There is only _one_ singleton status bar item (that is cleared/updated). This
 * file keeps track of that, and this class allows you to interact with it.
 * Because there is only one status bar item, we can only show one operation at
 * a time. This has the consequence that if you have multiple operations, it
 * shows the last one. You can find the list of other running tasks in
 * {@link TaskViewProvider}.
 */
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

    statusBarItem.text = nls.localize('status_bar_text', execution.command);
    statusBarItem.tooltip = nls.localize('status_bar_tooltip');
    statusBarItem.command = CANCEL_EXECUTION_COMMAND;

    cancellationTokenSource = token;

    if (statusTimer) {
      clearInterval(statusTimer);
    }
    statusTimer = setInterval(() => cycleStatusBarText(statusBarItem), 1000);
    execution.processExitSubject.subscribe(data => {
      if (statusTimer) {
        clearInterval(statusTimer);
      }
      resetStatusBarItem();
    });
    execution.processErrorSubject.subscribe(data => {
      if (statusTimer) {
        clearInterval(statusTimer);
      }
      resetStatusBarItem();
    });

    statusBarItem.show();
  }
}

function resetStatusBarItem() {
  statusBarItem.text = '';
  statusBarItem.tooltip = '';
  statusBarItem.command = undefined;
  statusBarItem.hide();
}

export function cycleStatusBarText(item: StatusBarItem) {
  item.text = item.text + '.';
  if (/\.\.\.\.$/.test(item.text)) {
    // Reset the ellipsis and cycle
    item.text = item.text.replace(/\.\.\.\.$/, '');
  }
}

export function cancelCommandExecution() {
  if (cancellationTokenSource) {
    cancellationTokenSource.cancel();
    cancellationTokenSource = undefined;
    resetStatusBarItem();
    if (statusTimer) {
      clearInterval(statusTimer);
      statusTimer = undefined;
    }
  }
}
