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
  forceLwcTestFileDebug,
  handleDidStartDebugSession,
  handleDidTerminateDebugSession
} from './forceLwcTestDebugAction';
import { forceLwcTestRefreshTestExplorer } from './forceLwcTestRefreshTestExplorer';
import {
  forceLwcTestCaseRun,
  forceLwcTestFileRun,
  forceLwcTestRunAllTests
} from './forceLwcTestRunAction';

export function registerCommands(
  extensionContext: ExtensionContext
): Disposable {
  const forceLwcTestRunAllTestsCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.runAllTests',
    forceLwcTestRunAllTests
  );
  const forceLwcTestRefreshTestExplorerCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.refreshTestExplorer',
    forceLwcTestRefreshTestExplorer
  );
  const forceLwcTestFileRunCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.file.run',
    forceLwcTestFileRun
  );
  const forceLwcTestFileDebugCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.file.debug',
    forceLwcTestFileDebug
  );
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
    forceLwcTestRunAllTestsCmd,
    forceLwcTestRefreshTestExplorerCmd,
    forceLwcTestFileRunCmd,
    forceLwcTestFileDebugCmd,
    forceLwcTestCaseRunCmd,
    forceLwcTestCaseDebugCmd,
    startDebugSessionDisposable,
    stopDebugSessionDisposable
  );
}
