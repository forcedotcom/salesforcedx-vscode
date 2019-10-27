/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import { TestRunner, TestRunType } from '../testRunner';
import {
  TestCaseInfo,
  TestExecutionInfo,
  TestFileInfo,
  TestInfoKind,
  TestType
} from '../types';
import { isLwcJestTest } from '../utils';

import { telemetryService } from '../../telemetry';
export const FORCE_LWC_TEST_DEBUG_LOG_NAME = 'force_lwc_test_debug_action';

const debugSessionStartTimes = new Map<string, [number, number]>();

export function getDebugConfiguration(
  command: string,
  args: string[],
  cwd: string
): vscode.DebugConfiguration {
  const sfdxDebugSessionId = uuid.v4();
  const debugConfiguration: vscode.DebugConfiguration = {
    sfdxDebugSessionId,
    type: 'node',
    request: 'launch',
    name: 'Debug LWC test(s)',
    cwd,
    runtimeExecutable: command,
    args,
    console: 'integratedTerminal',
    internalConsoleOptions: 'openOnSessionStart',
    port: 9229,
    disableOptimisticBPs: true
  };
  return debugConfiguration;
}

export async function forceLwcTestDebug(testExecutionInfo: TestExecutionInfo) {
  const testRunner = new TestRunner(testExecutionInfo, TestRunType.DEBUG);
  const shellExecutionInfo = testRunner.getShellExecutionInfo();
  if (shellExecutionInfo) {
    const {
      command,
      args,
      workspaceFolder,
      testResultFsPath
    } = shellExecutionInfo;
    testRunner.startWatchingTestResults(testResultFsPath);
    const debugConfiguration = getDebugConfiguration(
      command,
      args,
      workspaceFolder.uri.fsPath
    );
    await vscode.debug.startDebugging(workspaceFolder, debugConfiguration);
  }
}

export async function forceLwcTestCaseDebug(data: {
  testExecutionInfo: TestCaseInfo;
}) {
  const { testExecutionInfo } = data;
  await forceLwcTestDebug(testExecutionInfo);
}

export async function forceLwcTestFileDebug(data: {
  testExecutionInfo: TestExecutionInfo;
}) {
  const { testExecutionInfo } = data;
  await forceLwcTestDebug(testExecutionInfo);
}

export async function forceLwcTestDebugActiveTextEditorTest() {
  const { activeTextEditor } = vscode.window;
  if (activeTextEditor && isLwcJestTest(activeTextEditor.document)) {
    const testExecutionInfo: TestFileInfo = {
      kind: TestInfoKind.TEST_FILE,
      testType: TestType.LWC,
      testUri: activeTextEditor.document.uri
    };
    await forceLwcTestFileDebug({ testExecutionInfo });
  }
}

export function handleDidStartDebugSession(session: vscode.DebugSession) {
  const { configuration } = session;
  const { sfdxDebugSessionId } = configuration;
  const startTime = process.hrtime();
  debugSessionStartTimes.set(sfdxDebugSessionId, startTime);
}

export function handleDidTerminateDebugSession(session: vscode.DebugSession) {
  const { configuration } = session;
  const startTime = debugSessionStartTimes.get(
    configuration.sfdxDebugSessionId
  );
  if (Array.isArray(startTime)) {
    telemetryService
      .sendCommandEvent(FORCE_LWC_TEST_DEBUG_LOG_NAME, startTime)
      .catch();
  }
}
