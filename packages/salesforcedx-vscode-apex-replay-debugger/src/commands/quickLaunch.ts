/*
 * Copyright (c) 2026, salesforce.com, inc.
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
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { projectPaths, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { checkpointService, sfCreateCheckpoints } from '../breakpoints/checkpointService';
import { nls } from '../messages';
import { ensureTraceFlagsForCurrentUser } from '../services/ensureTraceFlags';
import { getRuntime } from '../services/runtime';
import { retrieveTestCodeCoverage } from '../utils/settings';
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
    const connection = await getRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        return yield* api.services.ConnectionService.getConnection();
      })
    );

    if (!connection) {
      return false;
    }

    if (!(await ensureTraceFlagsForCurrentUser())) {
      return false;
    }

    const oneOrMoreCheckpoints = checkpointService.hasOneOrMoreActiveCheckpoints();
    if (oneOrMoreCheckpoints) {
      const createCheckpointsResult = await sfCreateCheckpoints();
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
      void vscode.window.showErrorMessage(testResult.message);
    }
    return false;
  }

  private async runTests(connection: Connection, testClass: string, testMethod?: string): Promise<TestRunResult> {
    const testService = new TestService(connection);
    try {
      const singleTestName = testMethod ? `${testClass}.${testMethod}` : undefined;
      const payload = await testService.buildSyncPayload(
        TestLevel.RunSpecifiedTests,
        singleTestName,
        singleTestName ? undefined : testClass,
        undefined,
        !retrieveTestCodeCoverage() // the setting enables code coverage, so we need to pass false to disable it
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

      const testResult = testMethod ? (tests.find(test => test.methodName === testMethod) ?? tests[0]) : tests[0];
      if (!testResult?.apexLogId) {
        return {
          success: false,
          message: nls.localize('debug_test_no_debug_log')
        };
      }

      return { logFileId: testResult.apexLogId, success: true };
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

export const setupAndDebugTests = async (className: string, methodName?: string): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Running ${nls.localize('debug_test_exec_name')}`,
      cancellable: false
    },
    () => new QuickLaunch().debugTest(className, methodName)
  );
};
