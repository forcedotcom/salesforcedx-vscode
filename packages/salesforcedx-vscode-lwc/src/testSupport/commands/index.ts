/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { commands, Disposable, ExtensionContext } from 'vscode';
import {
  forceLwcTestCaseDebug,
  forceLwcTestDebugActiveTextEditorTest,
  forceLwcTestFileDebug,
  handleDidStartDebugSession,
  handleDidTerminateDebugSession
} from './forceLwcTestDebugAction';
import {
  forceLwcTestCaseRun,
  forceLwcTestFileRun,
  forceLwcTestRunActiveTextEditorTest,
  forceLwcTestRunAllTests
} from './forceLwcTestRunAction';
import { lwcTestNavigateToTest } from './lwcTestNavigateToTest';
import { lwcTestRefreshTestExplorer } from './lwcTestRefreshTestExplorer';
import {
  lwcTestStartWatchingCurrentFile,
  lwcTestStopWatchingAllTests,
  lwcTestStopWatchingCurrentFile
} from './lwcTestWatchAction';

/**
 * Register all commands with the extension context
 * @param extensionContext extension context
 */
export const registerCommands = (
  extensionContext: ExtensionContext
): Disposable => {
  const forceLwcTestRunAllTestsCmd = commands.registerCommand(
    'sfdx.force.lightning.lwc.test.runAllTests',
    forceLwcTestRunAllTests
  );
  const lwcTestRefreshTestExplorerCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.refreshTestExplorer',
    lwcTestRefreshTestExplorer
  );
  const lwcTestNavigateToTestCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.navigateToTest',
    lwcTestNavigateToTest
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
  const lwcTestEditorTitleStartWatchingCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.editorTitle.startWatching',
    lwcTestStartWatchingCurrentFile
  );
  const lwcTestEditorTitleStopWatchingCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.editorTitle.stopWatching',
    lwcTestStopWatchingCurrentFile
  );
  const lwcTestStopWatchingAllTestsCmd = commands.registerCommand(
    'sfdx.lightning.lwc.test.stopWatchingAllTests',
    lwcTestStopWatchingAllTests
  );
  const startDebugSessionDisposable = vscode.debug.onDidStartDebugSession(
    handleDidStartDebugSession
  );
  const stopDebugSessionDisposable = vscode.debug.onDidTerminateDebugSession(
    handleDidTerminateDebugSession
  );
  const disposables = Disposable.from(
    forceLwcTestRunAllTestsCmd,
    lwcTestRefreshTestExplorerCmd,
    lwcTestNavigateToTestCmd,
    forceLwcTestFileRunCmd,
    forceLwcTestFileDebugCmd,
    forceLwcTestCaseRunCmd,
    forceLwcTestCaseDebugCmd,
    forceLwcTestEditorTitleRunCmd,
    forceLwcTestEditorTitleDebugCmd,
    lwcTestEditorTitleStartWatchingCmd,
    lwcTestEditorTitleStopWatchingCmd,
    lwcTestStopWatchingAllTestsCmd,
    startDebugSessionDisposable,
    stopDebugSessionDisposable
  );
  extensionContext.subscriptions.push(disposables);
  return disposables;
};
