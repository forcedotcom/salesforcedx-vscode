/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApexTestResultData,
  LogService,
  ResultFormat,
  TestLevel,
  TestResult,
  TestService
} from '@salesforce/apex-node';
import type { Connection } from '@salesforce/core';
import {
  ContinueResponse,
  LibraryCommandletExecutor,
  notificationService,
  projectPaths,
  TraceFlags,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import type { SalesforceVSCodeCoreApi } from 'salesforcedx-vscode-core';
import * as vscode from 'vscode';
import { checkpointService, CheckpointService } from '../breakpoints/checkpointService';
import { OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { retrieveTestCodeCoverage } from '../utils';
import { launchFromLogFile } from './launchFromLogFile';

type TestRunResult = {
  logFileId?: string;
  message?: string;
  success: boolean;
};

type LogFileRetrieveResult = {
  filePath?: string;
  success: boolean;
};

class QuickLaunch {
  public async debugTest(testClass: string, testName?: string): Promise<boolean> {
    const connection = await vscode.extensions
      .getExtension<SalesforceVSCodeCoreApi>('salesforce.salesforcedx-vscode-core')
      ?.exports.services.WorkspaceContext.getInstance()
      .getConnection();

    if (!connection) {
      return false;
    }

    const traceFlags = new TraceFlags(connection);
    if (!(await traceFlags.ensureTraceFlags())) {
      return false;
    }

    const oneOrMoreCheckpoints = checkpointService.hasOneOrMoreActiveCheckpoints();
    if (oneOrMoreCheckpoints) {
      const createCheckpointsResult = await CheckpointService.sfCreateCheckpoints();
      if (!createCheckpointsResult) {
        return false;
      }
    }
    const testResult = await this.runTests(connection, testClass, testName);

    if (testResult.success && testResult.logFileId) {
      const logFileRetrieve = await this.retrieveLogFile(connection, testResult.logFileId);

      if (logFileRetrieve.success && logFileRetrieve.filePath) {
        await launchFromLogFile(logFileRetrieve.filePath, false);
        return true;
      }
    } else if (testResult.message) {
      notificationService.showErrorMessage(testResult.message);
    }
    return false;
  }

  private async runTests(connection: Connection, testClass: string, testMethod?: string): Promise<TestRunResult> {
    const testService = new TestService(connection);
    try {
      const payload = await testService.buildSyncPayload(
        TestLevel.RunSpecifiedTests,
        testMethod ? `${testClass}.${testMethod}` : undefined,
        testClass
      );
      // W-18453221
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const result: TestResult = (await testService.runTestSynchronous(payload, true)) as TestResult;
      if (workspaceUtils.hasRootWorkspace()) {
        const apexTestResultsPath = projectPaths.apexTestResultsFolder();
        await testService.writeResultFiles(
          result,
          { dirPath: apexTestResultsPath, resultFormats: [ResultFormat.json] },
          retrieveTestCodeCoverage()
        );
      }
      const tests: ApexTestResultData[] = result.tests;
      if (tests.length === 0) {
        return {
          success: false,
          message: nls.localize('debug_test_no_results_found')
        };
      }
      if (!tests[0].apexLogId) {
        return {
          success: false,
          message: nls.localize('debug_test_no_debug_log')
        };
      }

      return { logFileId: tests[0].apexLogId, success: true };
    } catch (e) {
      return { message: e.message, success: false };
    }
  }

  private async retrieveLogFile(connection: Connection, logId: string): Promise<LogFileRetrieveResult> {
    const logService = new LogService(connection);
    const outputDir = projectPaths.debugLogsFolder();

    await logService.getLogs({ logId, outputDir });
    const logPath = path.join(outputDir, `${logId}.log`);
    return { filePath: logPath, success: true };
  }
}

class TestDebuggerExecutor extends LibraryCommandletExecutor<string[]> {
  constructor() {
    super(nls.localize('debug_test_exec_name'), 'debug_test_replay_debugger', OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<string[]>): Promise<boolean> {
    if (!response.data) {
      return false;
    }

    const className = response.data[0];
    const methodName = response.data[1];
    const quickLaunch = new QuickLaunch();
    const success = await quickLaunch.debugTest(className, methodName);

    return success;
  }
}

export const setupAndDebugTests = async (className: string, methodName?: string): Promise<void> => {
  const executor = new TestDebuggerExecutor();
  const response: ContinueResponse<string[]> = {
    type: 'CONTINUE',
    data: [className, methodName].filter((f): f is string => f !== undefined)
  };
  await executor.execute(response);
};
