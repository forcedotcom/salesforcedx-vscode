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
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { CancellationToken, CancellationError } from 'vscode';
import { URI } from 'vscode-uri';
import * as settings from '../settings';
import { writeAndOpenTestReport } from '../utils/testReportGenerator';
import { writeTestResultJsonFile } from '../utils/testUtils';

type ApexTestRunOptions = {
  payload: AsyncTestConfiguration;
  outputDir: URI;
  codeCoverage: boolean;
  concise: boolean;
  telemetryTrigger: 'quickPick' | 'codeAction' | 'testView';
};

/** Append human-formatted test output to the output channel */
const appendTestOutput = Effect.fn('runApexTests.appendTestOutput')(function* (
  result: TestResult,
  codeCoverage: boolean,
  concise: boolean
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* Stream.fromIterable(
    new HumanReporter().format(result, codeCoverage, concise)?.split(/\r?\n/) ?? [
      `Test execution completed. Tests ran: ${result.summary.testsRan ?? 0}, Passed: ${result.summary.passing ?? 0}, Failed: ${result.summary.failing ?? 0}`
    ]
  ).pipe(
    Stream.tap(line => Effect.log(line)),
    Stream.tap(line => svc.appendToChannel(line)),
    Stream.runDrain
  );
});

/** Runs Apex tests and writes results. Returns undefined if cancelled. */
export const runApexTests = Effect.fn('runApexTests')(function* (
  options: ApexTestRunOptions,
  progress?: Progress<{ message?: string }>,
  token?: CancellationToken
) {
  yield* Effect.annotateCurrentSpan('trigger', options.telemetryTrigger);
  const startTime = Date.now();

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const connection = yield* api.services.ConnectionService.getConnection();
  const testService = new TestService(connection);

  const progressReporter: Progress<ApexTestProgressValue> = {
    report: value => {
      if (value.type === 'StreamingClientProgress' || value.type === 'FormatTestResultProgress') {
        progress?.report({ message: value.message });
      }
    }
  };

  const Cancelled = { _tag: 'Cancelled' } as const;
  type Cancelled = typeof Cancelled;

  // TODO: fix in apex-node W-18453221
  const result = yield* Effect.tryPromise({
    try: () => testService.runTestAsynchronous(options.payload, options.codeCoverage, false, progressReporter, token),
    catch: (e: unknown): Cancelled | Cause.UnknownException => {
      if (token?.isCancellationRequested) {
        return Cancelled;
      }
      if (e instanceof CancellationError) {
        return Cancelled;
      }
      return new Cause.UnknownException(e);
    }
  }).pipe(Effect.catchTag('Cancelled', () => Effect.succeed(undefined)));

  if (result === undefined || token?.isCancellationRequested) {
    return undefined;
  }
  // runTestAsynchronous can return TestRunIdResult on timeout; we need full TestResult to continue
  if (!('summary' in result)) {
    return undefined;
  }

  yield* Effect.tryPromise(() => writeTestResultJsonFile(result, options.outputDir, options.codeCoverage));

  yield* appendTestOutput(result, options.codeCoverage, options.concise);

  // Generate and open test report
  const outputFormat = settings.retrieveOutputFormat();
  const sortOrder = settings.retrieveTestSortOrder();
  yield* writeAndOpenTestReport(result, options.outputDir, outputFormat, options.codeCoverage, sortOrder).pipe(
    Effect.tap(() =>
      Effect.log('[Telemetry] apexTestReportGenerated').pipe(
        Effect.annotateLogs({ outputFormat, trigger: options.telemetryTrigger }),
        Effect.withSpan('apexTestReportGenerated', {
          attributes: { outputFormat, trigger: options.telemetryTrigger }
        })
      )
    ),
    Effect.catchAll(error => Effect.logError(`Failed to generate test report: ${String(error)}`))
  );

  const durationMs = Date.now() - startTime;
  const summary = result.summary;
  const telemetryAttrs = {
    trigger: options.telemetryTrigger,
    durationMs,
    testsRan: Number(summary?.testsRan ?? 0),
    testsPassed: Number(summary?.passing ?? 0),
    testsFailed: Number(summary?.failing ?? 0)
  };
  yield* Effect.log('[Telemetry] apexTestRun').pipe(
    Effect.annotateLogs(telemetryAttrs),
    Effect.withSpan('apexTestRun', { attributes: telemetryAttrs })
  );

  return result;
});
