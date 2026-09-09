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
import { APEX_TESTING_SECTION } from '../constants';
import { nls } from '../messages';
import { writeAndOpenTestReport } from '../utils/testReportGenerator';
import { writeTestResultJsonFile } from '../utils/testUtils';

type ApexTestRunOptions = {
  payload: AsyncTestConfiguration;
  outputDir: URI;
  codeCoverage: boolean;
  concise: boolean;
  telemetryTrigger: 'quickPick' | 'codeAction' | 'testView';
};

/**
 * Shared run-command context: the prompt/channel services plus the `Ended …` completion sentinel that
 * the quick-pick + code-action commands both set up identically before running.
 */
export const getRunCommandContext = Effect.fn('getRunCommandContext')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const channelService = yield* api.services.ChannelService;
  const executionName = nls.localize('apex_test_run_text');
  // e2e specs gate completion on the `Ended SFDX: …` channel sentinel
  const appendEnded = channelService.appendToChannel(`Ended ${executionName}`);
  return { promptService, channelService, executionName, appendEnded };
});

/**
 * Shared prelude for the quick-pick + code-action run commands: read the codeCoverage/concise settings,
 * then resolve the payload (built from a fresh TestService on the cached connection) and outputDir
 * concurrently. `buildPayload`/`outputDir` are the only bits that differ between the two callers.
 */
export const resolveRunInputs = <E, R>(
  buildPayload: (testService: TestService, codeCoverage: boolean) => Promise<AsyncTestConfiguration>,
  outputDir: Effect.Effect<URI, E, R>
) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const settings = yield* api.services.SettingsService;
    const codeCoverage =
      (yield* settings.getValue<boolean>(APEX_TESTING_SECTION, 'retrieve-test-code-coverage', false)) ?? false;
    const concise = (yield* settings.getValue<boolean>(APEX_TESTING_SECTION, 'test-run-concise', false)) ?? false;
    const resolved = yield* Effect.all(
      {
        payload: api.services.ConnectionService.getConnection().pipe(
          Effect.flatMap(connection => Effect.promise(() => buildPayload(new TestService(connection), codeCoverage)))
        ),
        outputDir
      },
      { concurrency: 'unbounded' }
    );
    return { codeCoverage, concise, payload: resolved.payload, outputDir: resolved.outputDir };
  });

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

/** Runs Apex tests and writes results. Returns the completed (or soft-failed) test result plus the
 * generated report's location/format for callers to wire into a success toast's "Open Report" action.
 * `result` is undefined when the run produced no usable result (timeout / no summary); `reportUri` is
 * undefined when report generation failed (channel gets a warning line, but the run itself still
 * succeeds — no toast interruption). */
export const runApexTests = Effect.fn('runApexTests')(function* (options: ApexTestRunOptions) {
  yield* Effect.annotateCurrentSpan('trigger', options.telemetryTrigger);

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const connection = yield* api.services.ConnectionService.getConnection();
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
    return { result: undefined, reportUri: undefined, outputFormat: 'markdown' as const };
  }

  // Non-fatal: a write failure logs and the run continues (report generation still happens below).
  yield* writeTestResultJsonFile(result, options.outputDir, options.codeCoverage).pipe(
    Effect.catchAll(error => Effect.logError(`Failed to write JSON test result file: ${String(error)}`))
  );

  yield* appendTestOutput(result, options.codeCoverage, options.concise);

  // Generate and open test report
  const settings = yield* api.services.SettingsService;
  const outputFormat =
    (yield* settings.getValue<'markdown' | 'text'>(APEX_TESTING_SECTION, 'outputFormat', 'markdown')) ?? 'markdown';
  const sortOrder =
    (yield* settings.getValue<'runtime' | 'coverage' | 'severity'>(APEX_TESTING_SECTION, 'testSortOrder', 'runtime')) ??
    'runtime';
  const channelService = yield* api.services.ChannelService;
  const reportUri = yield* writeAndOpenTestReport(
    result,
    options.outputDir,
    outputFormat,
    options.codeCoverage,
    sortOrder
  ).pipe(
    Effect.catchAll(error =>
      Effect.logError(`Failed to generate test report: ${String(error)}`).pipe(
        Effect.andThen(
          channelService.appendToChannel(nls.localize('apex_test_report_generation_failed_message', String(error)))
        ),
        Effect.as(undefined)
      )
    )
  );

  const summary = result.summary;
  // annotate the enclosing `runApexTests` span; duration captured automatically
  yield* Effect.annotateCurrentSpan({
    trigger: options.telemetryTrigger,
    testsRan: Number(summary?.testsRan ?? 0),
    testsPassed: Number(summary?.passing ?? 0),
    testsFailed: Number(summary?.failing ?? 0)
  });

  return { result, reportUri, outputFormat };
});
