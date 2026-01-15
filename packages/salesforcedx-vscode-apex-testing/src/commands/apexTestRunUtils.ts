/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ApexTestProgressValue,
  AsyncTestConfiguration,
  HumanReporter,
  Progress,
  TestResult,
  TestService
} from '@salesforce/apex-node';
import { CancellationToken } from 'vscode';
import { channelService } from '../channels';
import { getConnection } from '../coreExtensionUtils';
import * as settings from '../settings';
import { telemetryService } from '../telemetry/telemetry';
import { writeAndOpenTestReport } from '../utils/testReportGenerator';
import { writeTestResultJsonFile } from '../utils/testUtils';

type ApexTestRunOptions = {
  payload: AsyncTestConfiguration;
  outputDir: string;
  codeCoverage: boolean;
  concise: boolean;
  telemetryTrigger: 'quickPick' | 'codeAction' | 'testView';
};

/** Runs Apex tests and writes results. Returns undefined if cancelled. */
export const runApexTests = async (
  options: ApexTestRunOptions,
  progress?: Progress<{ message?: string }>,
  token?: CancellationToken
): Promise<TestResult | undefined> => {
  const startTime = Date.now();
  const connection = await getConnection();
  const testService = new TestService(connection);

  const progressReporter: Progress<ApexTestProgressValue> = {
    report: value => {
      if (value.type === 'StreamingClientProgress' || value.type === 'FormatTestResultProgress') {
        progress?.report({ message: value.message });
      }
    }
  };

  // TODO: fix in apex-node W-18453221
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const result = (await testService.runTestAsynchronous(
    options.payload,
    options.codeCoverage,
    false,
    progressReporter,
    token
  )) as TestResult;

  if (token?.isCancellationRequested) {
    return undefined;
  }

  // Write JSON test result file
  await writeTestResultJsonFile(result, options.outputDir, options.codeCoverage, testService);

  // Print test results to output channel
  const humanOutput = new HumanReporter().format(result, options.codeCoverage, false);
  if (humanOutput) {
    // Split by lines and add each line separately to preserve formatting
    const lines = humanOutput.split('\n');
    for (const line of lines) {
      channelService.appendLine(line);
    }
  } else {
    // Fallback if HumanReporter returns empty - at least show summary
    channelService.appendLine(
      `Test execution completed. Tests ran: ${result.summary.testsRan ?? 0}, Passed: ${result.summary.passing ?? 0}, Failed: ${result.summary.failing ?? 0}`
    );
  }

  // Generate and open test report
  const reportStartTime = Date.now();
  const outputFormat = settings.retrieveOutputFormat();
  const sortOrder = settings.retrieveTestSortOrder();
  try {
    await writeAndOpenTestReport(result, options.outputDir, outputFormat, options.codeCoverage, sortOrder);
    const reportDurationMs = Date.now() - reportStartTime;
    telemetryService.sendEventData(
      'apexTestReportGenerated',
      { outputFormat, trigger: options.telemetryTrigger },
      { reportDurationMs }
    );
  } catch (error) {
    console.error('Failed to generate test report:', error);
    // Continue even if report generation fails
  }

  const durationMs = Date.now() - startTime;
  const summary = result.summary;
  telemetryService.sendEventData(
    'apexTestRun',
    { trigger: options.telemetryTrigger },
    {
      durationMs,
      testsRan: Number(summary?.testsRan ?? 0),
      testsPassed: Number(summary?.passing ?? 0),
      testsFailed: Number(summary?.failing ?? 0)
    }
  );

  return result;
};
