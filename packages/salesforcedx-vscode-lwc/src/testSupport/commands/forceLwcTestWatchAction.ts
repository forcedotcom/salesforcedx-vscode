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
