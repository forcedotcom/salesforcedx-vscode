/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import clipboard from 'clipboardy';
import {
  TerminalView,
  Workbench
} from 'wdio-vscode-service';
import { CMD_KEY } from 'wdio-vscode-service/dist/constants';
import {
  log,
  pause
} from './miscellaneous';

export async function getTerminalView(workbench: Workbench): Promise<TerminalView> {
  const bottomBar = await workbench.getBottomBar();
  const terminalView = await bottomBar.openTerminalView();
  await pause(5);

  return terminalView;
}

export async function getTerminalViewText(terminalView: TerminalView, seconds: number): Promise<string> {
  for (let i = 0; i < seconds; i++) {
    await pause(1);

    // const terminalText = await terminalView.getText();
    // terminalView.getText() no longer works

    await browser.keys([CMD_KEY, 'a', 'c']);
    // Should be able to use Keys.Ctrl, but Keys is not exported from webdriverio
    // See https://webdriver.io/docs/api/browser/keys/
    const terminalText = await clipboard.read();

    if (terminalText && terminalText !== '') {
      return terminalText;
    }
  }

  throw new Error('Exceeded time limit - text in the terminal was not found');
}

export async function executeCommand(workbench: Workbench, command: string): Promise<TerminalView> {
  log(`Executing the command, "${command}"`);

  const terminalView = await getTerminalView(workbench);
  if (!terminalView) {
    throw new Error('In executeCommand(), the terminal view returned from getTerminalView() was null (or undefined)');
  }

  await terminalView.executeCommand(command);

  return terminalView;
}
