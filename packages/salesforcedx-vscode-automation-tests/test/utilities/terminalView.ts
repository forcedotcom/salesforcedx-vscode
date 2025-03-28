/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Duration, log, pause } from './miscellaneous';
import { TerminalView, Workbench } from 'vscode-extension-tester';

export async function getTerminalView(workbench: Workbench): Promise<TerminalView> {
  const bottomBar = await workbench.getBottomBar().wait();
  const terminalView = await (await bottomBar.openTerminalView()).wait();

  return terminalView;
}

export async function getTerminalViewText(workbench: Workbench, seconds: number): Promise<string> {
  await pause(Duration.seconds(seconds));
  const terminalView = await getTerminalView(workbench);

  return await terminalView.getText();
}

export async function executeCommand(workbench: Workbench, command: string): Promise<TerminalView> {
  log(`Executing the command, "${command}"`);

  const terminalView = await (await getTerminalView(workbench)).wait();
  if (!terminalView) {
    throw new Error('In executeCommand(), the terminal view returned from getTerminalView() was null (or undefined)');
  }
  await pause(Duration.seconds(5));
  await terminalView.executeCommand(command);

  return terminalView;
}
