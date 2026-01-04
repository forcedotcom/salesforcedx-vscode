/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ApexTestProgressValue,
  AsyncTestConfiguration,
  Progress,
  ResultFormat,
  TestResult,
  TestService
} from '@salesforce/apex-node';
import { getVscodeCoreExtension } from 'salesforcedx-vscode-apex/src/coreExtensionUtils';
import { CancellationToken } from 'vscode';
import * as settings from '../settings';
import { telemetryService } from '../telemetry/telemetry';
import { writeAndOpenTestReport } from '../utils/testReportGenerator';

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
  const vscodeCoreExtension = await getVscodeCoreExtension();
  const connection = await vscodeCoreExtension.exports.WorkspaceContext.getInstance().getConnection();
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

  await testService.writeResultFiles(
    result,
    { resultFormats: [ResultFormat.json], dirPath: options.outputDir },
    options.codeCoverage
  );

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
