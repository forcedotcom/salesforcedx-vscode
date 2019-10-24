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
  forceLwcTestDebugActiveTextEditorTest,
  forceLwcTestFileDebug,
  handleDidStartDebugSession,
  handleDidTerminateDebugSession
} from './forceLwcTestDebugAction';
import { forceLwcTestNavigateToTest } from './forceLwcTestNavigateToTest';
import { forceLwcTestRefreshTestExplorer } from './forceLwcTestRefreshTestExplorer';
import {
  forceLwcTestCaseRun,
  forceLwcTestFileRun,
  forceLwcTestRunActiveTextEditorTest,
  forceLwcTestRunAllTests
} from './forceLwcTestRunAction';
import {
  forceLwcTestStartWatchingCurrentFile,
  forceLwcTestStopWatchingCurrentFile
} from './forceLwcTestWatchAction';

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
  const forceLwcTestNavigateToTestCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.navigateToTest',
    forceLwcTestNavigateToTest
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
  const forceLwcTestEditorTitleRunCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.editorTitle.run',
    forceLwcTestRunActiveTextEditorTest
  );
  const forceLwcTestEditorTitleDebugCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.editorTitle.debug',
    forceLwcTestDebugActiveTextEditorTest
  );
  const forceLwcTestEditorTitleStartWatchingCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.editorTitle.startWatching',
    forceLwcTestStartWatchingCurrentFile
  );
  const forceLwcTestEditorTitleStopWatchingCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.editorTitle.stopWatching',
    forceLwcTestStopWatchingCurrentFile
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
    forceLwcTestNavigateToTestCmd,
    forceLwcTestFileRunCmd,
    forceLwcTestFileDebugCmd,
    forceLwcTestCaseRunCmd,
    forceLwcTestCaseDebugCmd,
    forceLwcTestEditorTitleRunCmd,
    forceLwcTestEditorTitleDebugCmd,
    forceLwcTestEditorTitleStartWatchingCmd,
    forceLwcTestEditorTitleStopWatchingCmd,
    startDebugSessionDisposable,
    stopDebugSessionDisposable
  );
}
