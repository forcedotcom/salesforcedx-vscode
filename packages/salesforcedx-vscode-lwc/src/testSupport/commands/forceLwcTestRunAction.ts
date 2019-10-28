/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { getTestWorkspaceFolder, TestRunner, TestRunType } from '../testRunner';
import {
  TestDirectoryInfo,
  TestExecutionInfo,
  TestFileInfo,
  TestInfoKind,
  TestType
} from '../types';
import { FORCE_LWC_TEST_RUN_LOG_NAME } from '../types/constants';
import { isLwcJestTest } from '../utils';

export async function forceLwcTestRun(testExecutionInfo: TestExecutionInfo) {
  const testRunner = new TestRunner(
    testExecutionInfo,
    TestRunType.RUN,
    FORCE_LWC_TEST_RUN_LOG_NAME
  );
  try {
    return await testRunner.executeAsSfdxTask();
  } catch (error) {
    console.error(error);
  }
}

export function forceLwcTestCaseRun(data: {
  testExecutionInfo: TestExecutionInfo;
}) {
  const { testExecutionInfo } = data;
  return forceLwcTestRun(testExecutionInfo);
}

export function forceLwcTestFileRun(data: {
  testExecutionInfo: TestExecutionInfo;
}) {
  const { testExecutionInfo } = data;
  return forceLwcTestRun(testExecutionInfo);
}

export function forceLwcTestRunAllTests() {
  const workspaceFolder = getTestWorkspaceFolder();
  if (workspaceFolder) {
    const testExecutionInfo: TestDirectoryInfo = {
      kind: TestInfoKind.TEST_DIRECTORY,
      testType: TestType.LWC,
      testUri: workspaceFolder.uri
    };
    return forceLwcTestRun(testExecutionInfo);
  }
}

export function forceLwcTestRunActiveTextEditorTest() {
  const { activeTextEditor } = vscode.window;
  if (activeTextEditor && isLwcJestTest(activeTextEditor.document)) {
    const testExecutionInfo: TestFileInfo = {
      kind: TestInfoKind.TEST_FILE,
      testType: TestType.LWC,
      testUri: activeTextEditor.document.uri
    };
    return forceLwcTestFileRun({
      testExecutionInfo
    });
  }
}
