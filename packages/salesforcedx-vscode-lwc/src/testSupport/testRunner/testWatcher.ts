/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { TestExecutionInfo } from '../types';
import { SFDX_LWC_JEST_IS_WATCHING_FOCUSED_FILE_CONTEXT } from '../types/constants';
import { SfdxTask } from './taskService';
import { TestRunner, TestRunType } from './testRunner';

class TestWatcher {
  private watchedTests: Map<string, SfdxTask> = new Map();

  public async watchTest(testExecutionInfo: TestExecutionInfo) {
    const testRunner = new TestRunner(testExecutionInfo, TestRunType.WATCH);
    const sfdxTask = await testRunner.executeAsSfdxTask();
    if (sfdxTask) {
      const { testUri } = testExecutionInfo;
      const { fsPath } = testUri;
      sfdxTask.onDidEnd(() => {
        this.watchedTests.delete(fsPath);
        this.setWatchingContext(testUri);
      });
      this.watchedTests.set(fsPath, sfdxTask);
      this.setWatchingContext(testUri);
    }
  }
  public stopWatchingTest(testExecutionInfo: TestExecutionInfo) {
    const { testUri } = testExecutionInfo;
    const { fsPath } = testUri;
    const watchTestTask = this.watchedTests.get(fsPath);
    if (watchTestTask) {
      watchTestTask.terminate();
    }
    this.watchedTests.delete(fsPath);
    this.setWatchingContext(testUri);
  }

  public isWatchingTest(testUri: vscode.Uri) {
    const { fsPath } = testUri;
    return this.watchedTests.has(fsPath);
  }

  public setWatchingContext(testUri: vscode.Uri) {
    if (
      vscode.window.activeTextEditor &&
      vscode.window.activeTextEditor.document.uri === testUri
    ) {
      vscode.commands.executeCommand(
        'setContext',
        SFDX_LWC_JEST_IS_WATCHING_FOCUSED_FILE_CONTEXT,
        this.isWatchingTest(testUri)
      );
    }
  }
}

export const testWatcher = new TestWatcher();
