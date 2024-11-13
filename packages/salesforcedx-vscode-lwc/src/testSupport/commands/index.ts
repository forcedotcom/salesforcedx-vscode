/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { commands, Disposable, ExtensionContext } from 'vscode';
import {
  handleDidStartDebugSession,
  handleDidTerminateDebugSession,
  lwcTestCaseDebug,
  lwcTestDebugActiveTextEditorTest,
  lwcTestFileDebug
} from './lwcTestDebugAction';
import { lwcTestNavigateToTest } from './lwcTestNavigateToTest';
import { lwcTestRefreshTestExplorer } from './lwcTestRefreshTestExplorer';
import { lwcTestCaseRun, lwcTestFileRun, lwcTestRunActiveTextEditorTest, lwcTestRunAllTests } from './lwcTestRunAction';
import {
  lwcTestStartWatchingCurrentFile,
  lwcTestStopWatchingAllTests,
  lwcTestStopWatchingCurrentFile
} from './lwcTestWatchAction';

/**
 * Register all commands with the extension context
 * @param extensionContext extension context
 */
export const registerCommands = (extensionContext: ExtensionContext): Disposable => {
  const lwcTestRunAllTestsCmd = commands.registerCommand('sf.lightning.lwc.test.runAllTests', lwcTestRunAllTests);
  const lwcTestRefreshTestExplorerCmd = commands.registerCommand(
    'sf.lightning.lwc.test.refreshTestExplorer',
    lwcTestRefreshTestExplorer
  );
  const lwcTestNavigateToTestCmd = commands.registerCommand(
    'sf.lightning.lwc.test.navigateToTest',
    lwcTestNavigateToTest
  );
  const lwcTestFileRunCmd = commands.registerCommand('sf.lightning.lwc.test.file.run', lwcTestFileRun);
  const lwcTestFileDebugCmd = commands.registerCommand('sf.lightning.lwc.test.file.debug', lwcTestFileDebug);
  const lwcTestCaseRunCmd = commands.registerCommand('sf.lightning.lwc.test.case.run', lwcTestCaseRun);
  const lwcTestCaseDebugCmd = commands.registerCommand('sf.lightning.lwc.test.case.debug', lwcTestCaseDebug);
  const lwcTestEditorTitleRunCmd = commands.registerCommand(
    'sf.lightning.lwc.test.editorTitle.run',
    lwcTestRunActiveTextEditorTest
  );
  const lwcTestEditorTitleDebugCmd = commands.registerCommand(
    'sf.lightning.lwc.test.editorTitle.debug',
    lwcTestDebugActiveTextEditorTest
  );
  const lwcTestEditorTitleStartWatchingCmd = commands.registerCommand(
    'sf.lightning.lwc.test.editorTitle.startWatching',
    lwcTestStartWatchingCurrentFile
  );
  const lwcTestEditorTitleStopWatchingCmd = commands.registerCommand(
    'sf.lightning.lwc.test.editorTitle.stopWatching',
    lwcTestStopWatchingCurrentFile
  );
  const lwcTestStopWatchingAllTestsCmd = commands.registerCommand(
    'sf.lightning.lwc.test.stopWatchingAllTests',
    lwcTestStopWatchingAllTests
  );
  const startDebugSessionDisposable = vscode.debug.onDidStartDebugSession(handleDidStartDebugSession);
  const stopDebugSessionDisposable = vscode.debug.onDidTerminateDebugSession(handleDidTerminateDebugSession);
  const disposables = Disposable.from(
    lwcTestRefreshTestExplorerCmd,
    lwcTestNavigateToTestCmd,
    lwcTestEditorTitleStartWatchingCmd,
    lwcTestEditorTitleStopWatchingCmd,
    lwcTestStopWatchingAllTestsCmd,
    lwcTestRunAllTestsCmd,
    lwcTestFileRunCmd,
    lwcTestFileDebugCmd,
    lwcTestCaseRunCmd,
    lwcTestCaseDebugCmd,
    lwcTestEditorTitleRunCmd,
    lwcTestEditorTitleDebugCmd,
    startDebugSessionDisposable,
    stopDebugSessionDisposable
  );
  extensionContext.subscriptions.push(disposables);
  return disposables;
};
