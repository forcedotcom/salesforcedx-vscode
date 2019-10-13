/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { commands, Disposable, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';
import {
  forceLwcTestCaseDebug,
  handleDidStartDebugSession,
  handleDidTerminateDebugSession
} from './forceLwcTestDebugAction';
import { forceLwcTestCaseRun } from './forceLwcTestRunAction';

export function registerCommands(
  extensionContext: ExtensionContext
): Disposable {
  const forceLwcTestCaseRunCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.case.run',
    forceLwcTestCaseRun
  );
  const forceLwcTestCaseDebugCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.case.debug',
    forceLwcTestCaseDebug
  );
  const startDebugSessionDisposable = vscode.debug.onDidStartDebugSession(
    handleDidStartDebugSession
  );
  const stopDebugSessionDisposable = vscode.debug.onDidTerminateDebugSession(
    handleDidTerminateDebugSession
  );
  return Disposable.from(
    forceLwcTestCaseRunCmd,
    forceLwcTestCaseDebugCmd,
    startDebugSessionDisposable,
    stopDebugSessionDisposable
  );
}
