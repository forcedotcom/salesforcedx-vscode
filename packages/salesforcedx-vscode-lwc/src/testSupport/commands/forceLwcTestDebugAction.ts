/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import { getJestArgs, getLwcTestRunnerExecutable } from '../testRunner';
import {
  TestCaseInfo,
  TestExecutionInfo,
  TestFileInfo,
  TestInfoKind,
  TestType
} from '../types';
import { isLwcJestTest } from '../utils';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const telemetryService = sfdxCoreExports.telemetryService;
export const FORCE_LWC_TEST_DEBUG_LOG_NAME = 'force_lwc_test_debug_action';

const debugSessionStartTimes = new Map<string, [number, number]>();

export function getDebugConfiguration(
  lwcTestRunnerExecutablePath: string,
  cwd: string,
  testExecutionInfo: TestExecutionInfo
): vscode.DebugConfiguration {
  const sfdxDebugSessionId = uuid.v4();
  const jestArgs = getJestArgs(testExecutionInfo);
  const args = ['--debug', ...jestArgs];
  const debugConfiguration: vscode.DebugConfiguration = {
    sfdxDebugSessionId,
    type: 'node',
    request: 'launch',
    name: 'Debug LWC test(s)',
    cwd,
    runtimeExecutable: lwcTestRunnerExecutablePath,
    args,
    console: 'integratedTerminal',
    internalConsoleOptions: 'openOnSessionStart',
    port: 9229,
    disableOptimisticBPs: true
  };
  return debugConfiguration;
}

export async function forceLwcTestCaseDebug(data: {
  testExecutionInfo: TestCaseInfo;
}) {
  const { testExecutionInfo } = data;
  const { testUri } = testExecutionInfo;
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    const cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const lwcTestRunnerExecutablePath = getLwcTestRunnerExecutable(cwd);
    if (lwcTestRunnerExecutablePath) {
      const debugConfiguration = getDebugConfiguration(
        lwcTestRunnerExecutablePath,
        cwd,
        testExecutionInfo
      );
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
      await vscode.debug.startDebugging(workspaceFolder, debugConfiguration);
    }
  }
}

export async function forceLwcTestFileDebug(data: {
  testExecutionInfo: TestExecutionInfo;
}) {
  const { testExecutionInfo } = data;
  const { testUri } = testExecutionInfo;
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    const cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const lwcTestRunnerExecutablePath = getLwcTestRunnerExecutable(cwd);
    if (lwcTestRunnerExecutablePath) {
      const debugConfiguration = getDebugConfiguration(
        lwcTestRunnerExecutablePath,
        cwd,
        testExecutionInfo
      );
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
      await vscode.debug.startDebugging(workspaceFolder, debugConfiguration);
    }
  }
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
    telemetryService.sendCommandEvent(FORCE_LWC_TEST_DEBUG_LOG_NAME, startTime);
  }
}
