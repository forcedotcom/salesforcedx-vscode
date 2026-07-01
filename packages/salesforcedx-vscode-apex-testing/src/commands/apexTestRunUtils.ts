/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AsyncTestConfiguration, HumanReporter, TestResult, TestService } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { CancellationTokenSource } from 'vscode';
import { URI } from 'vscode-uri';
import { getConnection } from '../coreExtensionUtils';
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

/** Runs Apex tests and writes results. Returns undefined when the run produced no usable result (timeout / no summary). */
export const runApexTests = Effect.fn('runApexTests')(function* (options: ApexTestRunOptions) {
  yield* Effect.annotateCurrentSpan('trigger', options.telemetryTrigger);

  const connection = yield* Effect.tryPromise({
    try: () => getConnection(),
    catch: (e): Error => (e instanceof Error ? e : new Error(String(e)))
  });
  const testService = new TestService(connection);

  // Bridge the fiber's interruption (e.g. user clicks Cancel on the progress notification) to a
  // vscode CancellationToken so apex-node stops polling the org server-side, not just the UI.
  // The interrupt itself raises UserCancellationError via promptService.withCancellableProgress;
  // apex-node never throws on cancel (it returns null once the token is set), so there is no
  // cancellation result to catch here.
  const tokenSource = new CancellationTokenSource();

  // TODO: fix in apex-node W-18453221
  const result = yield* Effect.tryPromise(() =>
    testService.runTestAsynchronous(options.payload, options.codeCoverage, false, undefined, tokenSource.token)
  ).pipe(
    Effect.onInterrupt(() => Effect.sync(() => tokenSource.cancel())),
    Effect.ensuring(Effect.sync(() => tokenSource.dispose()))
  );

  // runTestAsynchronous can return TestRunIdResult on timeout; we need full TestResult to continue
  if (!result || !('summary' in result)) {
    return undefined;
  }

  yield* Effect.tryPromise(() => writeTestResultJsonFile(result, options.outputDir, options.codeCoverage));

  yield* appendTestOutput(result, options.codeCoverage, options.concise);

  // Generate and open test report
  const outputFormat = settings.retrieveOutputFormat();
  const sortOrder = settings.retrieveTestSortOrder();
  yield* writeAndOpenTestReport(result, options.outputDir, outputFormat, options.codeCoverage, sortOrder).pipe(
    Effect.catchAll(error => Effect.logError(`Failed to generate test report: ${String(error)}`))
  );

  const summary = result.summary;
  // annotate the enclosing `runApexTests` span; duration captured automatically
  yield* Effect.annotateCurrentSpan({
    trigger: options.telemetryTrigger,
    testsRan: Number(summary?.testsRan ?? 0),
    testsPassed: Number(summary?.passing ?? 0),
    testsFailed: Number(summary?.failing ?? 0)
  });

  return result;
});
