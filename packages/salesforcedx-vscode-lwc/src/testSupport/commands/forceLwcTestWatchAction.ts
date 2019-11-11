/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import {
  TestExecutionInfo,
  TestFileInfo,
  TestInfoKind,
  TestType
} from '../types';

import { testWatcher } from '../testRunner/testWatcher';
import { isLwcJestTest } from '../utils';

/**
 * Start watching tests using the provided test execution info.
 * It will kick off a VS Code task to execute the test runner in watch mode,
 * so that on file changes to the test file or the code related to the test file,
 * it will re-run the tests.
 * @param data providded by test watch commands (or test explorer potentially in the future)
 */
export async function forceLwcTestStartWatching(data: {
  testExecutionInfo: TestExecutionInfo;
}) {
  const { testExecutionInfo } = data;
  await testWatcher.watchTest(testExecutionInfo);
}

export async function forceLwcTestStopWatching(data: {
  testExecutionInfo: TestExecutionInfo;
}) {
  const { testExecutionInfo } = data;
  testWatcher.stopWatchingTest(testExecutionInfo);
}

/**
 * Start watching the test of currently focused editor
 */
export async function forceLwcTestStartWatchingCurrentFile() {
  const { activeTextEditor } = vscode.window;
  if (activeTextEditor && isLwcJestTest(activeTextEditor.document)) {
    const testExecutionInfo: TestFileInfo = {
      kind: TestInfoKind.TEST_FILE,
      testType: TestType.LWC,
      testUri: activeTextEditor.document.uri
    };
    return forceLwcTestStartWatching({
      testExecutionInfo
    });
  }
}

/**
 * Stop watching the test of currently focused editor
 */
export function forceLwcTestStopWatchingCurrentFile() {
  const { activeTextEditor } = vscode.window;
  if (activeTextEditor && isLwcJestTest(activeTextEditor.document)) {
    const testExecutionInfo: TestFileInfo = {
      kind: TestInfoKind.TEST_FILE,
      testType: TestType.LWC,
      testUri: activeTextEditor.document.uri
    };
    return forceLwcTestStopWatching({
      testExecutionInfo
    });
  }
}
