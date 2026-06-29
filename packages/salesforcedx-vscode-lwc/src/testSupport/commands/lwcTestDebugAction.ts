/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { telemetryService } from '../../telemetry';
import { getLwcTestController } from '../testExplorer/lwcTestController';
import { TestCaseInfo, TestExecutionInfo } from '../types';
import { LWC_TEST_DEBUG_LOG_NAME } from '../types/constants';
import { workspaceService } from '../workspace/workspaceService';

const debugSessionStartTimes = new Map<string, number>();

/** Debug an individual test case (code lens). */
export const lwcTestCaseDebug = (data: { testExecutionInfo: TestCaseInfo }) =>
  getLwcTestController().runByExecutionInfo(data.testExecutionInfo, true);

/** Debug a test file (test explorer node). */
export const lwcTestFileDebug = (data: { testExecutionInfo: TestExecutionInfo }) =>
  getLwcTestController().runByExecutionInfo(data.testExecutionInfo, true);

/** Debug the test of the currently focused editor (editor-title debug button). */
export const lwcTestDebugActiveTextEditorTest = () => getLwcTestController().runActiveEditorFile(true);

/**
 * Log the start time of debug session
 * @param session debug session
 */
export const handleDidStartDebugSession = (session: vscode.DebugSession) => {
  const { configuration } = session;
  const { sfDebugSessionId } = configuration;
  if (typeof sfDebugSessionId === 'string') {
    debugSessionStartTimes.set(sfDebugSessionId, globalThis.performance.now());
  }
};

/**
 * Send telemetry event if applicable when debug session ends
 * @param session debug session
 */
export const handleDidTerminateDebugSession = (session: vscode.DebugSession) => {
  const { configuration } = session;
  const { sfDebugSessionId } = configuration;
  const startTime = typeof sfDebugSessionId === 'string' ? debugSessionStartTimes.get(sfDebugSessionId) : undefined;
  if (typeof startTime === 'number') {
    telemetryService.sendEventData(
      LWC_TEST_DEBUG_LOG_NAME,
      { workspaceType: workspaceService.getCurrentWorkspaceTypeForTelemetry() },
      { executionTime: globalThis.performance.now() - startTime }
    );
  }
};
