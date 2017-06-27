import { window, StatusBarItem, StatusBarAlignment } from 'vscode';

let statusBarItem: StatusBarItem;
let statusTimer: NodeJS.Timer;

export function showStatus(status: string) {
  if (!statusBarItem) {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, -10);
  }
  statusBarItem.text = `$(clock) ${status}`;
  statusTimer = setInterval(
    () => (statusBarItem.text = statusBarItem.text + '.'),
    1000
  );
  statusBarItem.show();
}

export function hideStatus() {
  if (statusBarItem) {
    statusBarItem.hide();
  }
  if (statusTimer) {
    clearInterval(statusTimer);
  }
}
