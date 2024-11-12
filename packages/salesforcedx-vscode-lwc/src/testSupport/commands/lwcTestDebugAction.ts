/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import { telemetryService } from '../../telemetry';
import { TestRunner, TestRunType } from '../testRunner';
import { TestCaseInfo, TestExecutionInfo, TestFileInfo, TestInfoKind, TestType } from '../types';
import { LWC_TEST_DEBUG_LOG_NAME } from '../types/constants';
import { isLwcJestTest } from '../utils';

import { workspaceService } from '../workspace/workspaceService';

const debugSessionStartTimes = new Map<string, [number, number]>();

/**
 * Create a VS Code debug configuration for LWC Jest tests.
 * @param command LWC test runner executable
 * @param args CLI arguments
 * @param cwd current working directory
 */
export const getDebugConfiguration = (command: string, args: string[], cwd: string): vscode.DebugConfiguration => {
  const sfDebugSessionId = uuid.v4();
  const debugConfiguration: vscode.DebugConfiguration = {
    sfDebugSessionId,
    type: 'node',
    request: 'launch',
    name: 'Debug LWC test(s)',
    cwd,
    runtimeExecutable: command,
    args,
    resolveSourceMapLocations: ['**', '!**/node_modules/**'],
    console: 'integratedTerminal',
    internalConsoleOptions: 'openOnSessionStart',
    port: 9229,
    disableOptimisticBPs: true
  };
  return debugConfiguration;
};

/**
 * Start a debug session with provided test execution information
 * @param testExecutionInfo test execution information
 */
export const lwcTestDebug = async (testExecutionInfo: TestExecutionInfo) => {
  const testRunner = new TestRunner(testExecutionInfo, TestRunType.DEBUG);
  const shellExecutionInfo = testRunner.getShellExecutionInfo();
  if (shellExecutionInfo) {
    const { command, args, workspaceFolder, testResultFsPath } = shellExecutionInfo;
    testRunner.startWatchingTestResults(testResultFsPath);
    const debugConfiguration = getDebugConfiguration(command, args, workspaceFolder.uri.fsPath);
    await vscode.debug.startDebugging(workspaceFolder, debugConfiguration);
  }
};

/**
 * Debug an individual test case
 * @param data a test explorer node or information provided by code lens
 */
export const lwcTestCaseDebug = async (data: { testExecutionInfo: TestCaseInfo }) => {
  const { testExecutionInfo } = data;
  await lwcTestDebug(testExecutionInfo);
};

/**
 * Debug a test file
 * @param data a test explorer node
 */
export const lwcTestFileDebug = async (data: { testExecutionInfo: TestExecutionInfo }) => {
  const { testExecutionInfo } = data;
  await lwcTestDebug(testExecutionInfo);
};

/**
 * Debug the test of currently focused editor
 */
export const lwcTestDebugActiveTextEditorTest = async () => {
  const { activeTextEditor } = vscode.window;
  if (activeTextEditor && isLwcJestTest(activeTextEditor.document)) {
    const testExecutionInfo: TestFileInfo = {
      kind: TestInfoKind.TEST_FILE,
      testType: TestType.LWC,
      testUri: activeTextEditor.document.uri
    };
    await lwcTestFileDebug({ testExecutionInfo });
  }
};

/**
 * Log the start time of debug session
 * @param session debug session
 */
export const handleDidStartDebugSession = (session: vscode.DebugSession) => {
  const { configuration } = session;
  const { sfDebugSessionId } = configuration;
  const startTime = process.hrtime();
  debugSessionStartTimes.set(sfDebugSessionId, startTime);
};

/**
 * Send telemetry event if applicable when debug session ends
 * @param session debug session
 */
export const handleDidTerminateDebugSession = (session: vscode.DebugSession) => {
  const { configuration } = session;
  const startTime = debugSessionStartTimes.get(configuration.sfDebugSessionId);
  if (Array.isArray(startTime)) {
    telemetryService.sendCommandEvent(LWC_TEST_DEBUG_LOG_NAME, startTime, {
      workspaceType: workspaceService.getCurrentWorkspaceTypeForTelemetry()
    });
  }
};
