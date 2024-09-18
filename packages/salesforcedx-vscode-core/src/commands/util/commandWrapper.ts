/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { logCommand } from './commandLog';

export const registerCommand = (commandId: string, callback: (...args: any[]) => any, thisArg?: any): vscode.Disposable => {
  return vscode.commands.registerCommand(commandId, wrapCommandCallback(commandId, callback), thisArg);
};

const wrapCommandCallback = (commandId: string, callback: (...args: any[]) => any): (...args: any[]) => any => {
  return async (...args: any[]) => {
    const startTime = Date.now();
    await callback(...args);
    await logCommand(commandId, Date.now() - startTime);
  };
};
