/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { TestRunner, TestRunType } from '../testRunner';
import { TestDirectoryInfo, TestExecutionInfo, TestFileInfo, TestInfoKind, TestType } from '../types';
import { LWC_TEST_RUN_LOG_NAME } from '../types/constants';
import { isLwcJestTest } from '../utils';
import { workspace } from '../workspace';

/**
 * Run an LWC Jest test from provided test execution info
 * @param testExecutionInfo test execution info
 */
export const lwcTestRun = async (testExecutionInfo: TestExecutionInfo) => {
  const testRunner = new TestRunner(testExecutionInfo, TestRunType.RUN, LWC_TEST_RUN_LOG_NAME);
  try {
    return await testRunner.executeAsSfTask();
  } catch (error) {
    console.error(error);
  }
};

/**
 * Run an individual test case
 * @param data a test explorer node or information provided by code lens
 */
export const lwcTestCaseRun = (data: { testExecutionInfo: TestExecutionInfo }) => {
  const { testExecutionInfo } = data;
  return lwcTestRun(testExecutionInfo);
};

/**
 * Run a test file
 * @param data a test explorer node
 */
export const lwcTestFileRun = (data: { testExecutionInfo: TestExecutionInfo }) => {
  const { testExecutionInfo } = data;
  return lwcTestRun(testExecutionInfo);
};

/**
 * Run all tests in the workspace folder
 */
export const lwcTestRunAllTests = () => {
  const workspaceFolder = workspace.getTestWorkspaceFolder();
  if (workspaceFolder) {
    const testExecutionInfo: TestDirectoryInfo = {
      kind: TestInfoKind.TEST_DIRECTORY,
      testType: TestType.LWC,
      testUri: workspaceFolder.uri
    };
    return lwcTestRun(testExecutionInfo);
  }
};

/**
 * Run the test of currently focused editor
 */
export const lwcTestRunActiveTextEditorTest = () => {
  const { activeTextEditor } = vscode.window;
  if (activeTextEditor && isLwcJestTest(activeTextEditor.document)) {
    const testExecutionInfo: TestFileInfo = {
      kind: TestInfoKind.TEST_FILE,
      testType: TestType.LWC,
      testUri: activeTextEditor.document.uri
    };
    return lwcTestFileRun({
      testExecutionInfo
    });
  }
};
