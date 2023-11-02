/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { TestExecutionInfo } from '../types';
import { FORCE_LWC_TEST_WATCH_LOG_NAME } from '../types/constants';
import { SFDX_LWC_JEST_IS_WATCHING_FOCUSED_FILE_CONTEXT } from '../types/constants';
import { SfdxTask } from './taskService';
import { TestRunner, TestRunType } from './testRunner';

/**
 * Test Watcher class for watching Jest tests
 */
class TestWatcher {
  private watchedTests: Map<string, SfdxTask> = new Map();

  /**
   * Start watching tests from provided test execution info
   * @param testExecutionInfo test execution info
   */
  public async watchTest(testExecutionInfo: TestExecutionInfo) {
    const testRunner = new TestRunner(
      testExecutionInfo,
      TestRunType.WATCH,
      FORCE_LWC_TEST_WATCH_LOG_NAME
    );
    try {
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
        return sfdxTask;
      }
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Stop watching tests from provided test execution info
   * @param testExecutionInfo test execution info
   */
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

  /**
   * Stop watching all tests.
   */
  public stopWatchingAllTests() {
    for (const [fsPath, watchTestTask] of this.watchedTests.entries()) {
      if (watchTestTask) {
        watchTestTask.terminate();
      }
      this.watchedTests.delete(fsPath);
      this.setWatchingContext(vscode.Uri.file(fsPath));
    }
  }

  /**
   * Determine if we are watching the test uri
   * @param testUri uri of the test
   */
  public isWatchingTest(testUri: vscode.Uri) {
    const { fsPath } = testUri;
    return this.watchedTests.has(fsPath);
  }

  /**
   * Execute setContext command if applicable so that start/stop watching buttons
   * display appropriately in editor/title
   * @param testUri uri of the test
   */
  public setWatchingContext(testUri: vscode.Uri) {
    if (
      vscode.window.activeTextEditor &&
      vscode.window.activeTextEditor.document.uri.fsPath === testUri.fsPath
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
