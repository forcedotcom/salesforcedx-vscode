/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { commands, Disposable, ExtensionContext } from 'vscode';
import { forceLwcTestNavigateToTest } from './forceLwcTestNavigateToTest';
import { forceLwcTestRefreshTestExplorer } from './forceLwcTestRefreshTestExplorer';
import {
  forceLwcTestStartWatchingCurrentFile,
  forceLwcTestStopWatchingAllTests,
  forceLwcTestStopWatchingCurrentFile
} from './forceLwcTestWatchAction';
import {
  handleDidStartDebugSession,
  handleDidTerminateDebugSession,
  lwcTestCaseDebug,
  lwcTestDebugActiveTextEditorTest,
  lwcTestFileDebug
} from './lwcTestDebugAction';
import {
  lwcTestCaseRun,
  lwcTestFileRun,
  lwcTestRunActiveTextEditorTest,
  lwcTestRunAllTests
} from './lwcTestRunAction';

/**
 * Register all commands with the extension context
 * @param extensionContext extension context
 */
export const registerCommands = (
  extensionContext: ExtensionContext
): Disposable => {
  const lwcTestRunAllTestsCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.runAllTests',
    lwcTestRunAllTests
  );
  const forceLwcTestRefreshTestExplorerCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.refreshTestExplorer',
    forceLwcTestRefreshTestExplorer
  );
  const forceLwcTestNavigateToTestCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.navigateToTest',
    forceLwcTestNavigateToTest
  );
  const lwcTestFileRunCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.file.run',
    lwcTestFileRun
  );
  const lwcTestFileDebugCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.file.debug',
    lwcTestFileDebug
  );
  const lwcTestCaseRunCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.case.run',
    lwcTestCaseRun
  );
  const lwcTestCaseDebugCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.case.debug',
    lwcTestCaseDebug
  );
  const lwcTestEditorTitleRunCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.editorTitle.run',
    lwcTestRunActiveTextEditorTest
  );
  const lwcTestEditorTitleDebugCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.editorTitle.debug',
    lwcTestDebugActiveTextEditorTest
  );
  const forceLwcTestEditorTitleStartWatchingCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.editorTitle.startWatching',
    forceLwcTestStartWatchingCurrentFile
  );
  const forceLwcTestEditorTitleStopWatchingCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.editorTitle.stopWatching',
    forceLwcTestStopWatchingCurrentFile
  );
  const forceLwcTestStopWatchingAllTestsCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.stopWatchingAllTests',
    forceLwcTestStopWatchingAllTests
  );
  const startDebugSessionDisposable = vscode.debug.onDidStartDebugSession(
    handleDidStartDebugSession
  );
  const stopDebugSessionDisposable = vscode.debug.onDidTerminateDebugSession(
    handleDidTerminateDebugSession
  );
  const disposables = Disposable.from(
    lwcTestRunAllTestsCmd,
    forceLwcTestRefreshTestExplorerCmd,
    forceLwcTestNavigateToTestCmd,
    lwcTestFileRunCmd,
    lwcTestFileDebugCmd,
    lwcTestCaseRunCmd,
    lwcTestCaseDebugCmd,
    lwcTestEditorTitleRunCmd,
    lwcTestEditorTitleDebugCmd,
    forceLwcTestEditorTitleStartWatchingCmd,
    forceLwcTestEditorTitleStopWatchingCmd,
    forceLwcTestStopWatchingAllTestsCmd,
    startDebugSessionDisposable,
    stopDebugSessionDisposable
  );
  extensionContext.subscriptions.push(disposables);
  return disposables;
};
