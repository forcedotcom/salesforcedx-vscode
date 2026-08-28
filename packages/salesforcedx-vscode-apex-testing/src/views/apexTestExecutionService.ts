/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ProgressAndSuccessCommandKey } from '../utils/notificationMode';
import { TestLevel, TestResult, TestService } from '@salesforce/apex-node';
import { ExtensionProviderService, getMessageFromError } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { APEX_TESTING_SECTION } from '../constants';
import { nls } from '../messages';
import { messages } from '../messages/i18n';
import { ApexTestRunCacheService } from '../testRunCache/apexTestRunCacheService';
import { toUserFriendlyApexTestError } from '../utils/apexTestErrorMapper';
import { DebugDispatchError, TestExecutionError, TestTempFolderError } from '../utils/apexTestExecutionErrors';
import { showRunSuccessNotification } from '../utils/notificationHelpers';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { buildTestPayload } from '../utils/payloadBuilder';
import {
  extractClassName,
  extractSuiteName,
  filterTestItemsByRequestExclude,
  gatherTests,
  getTestName,
  isClass,
  isMethod,
  isSuite,
  isSuiteClass
} from '../utils/testItemUtils';
import { openTestReport, writeAndOpenTestReport } from '../utils/testReportGenerator';
import { updateTestRunResults } from '../utils/testResultProcessor';
import { readTestRunIdFile, writeTestResultJsonFile } from '../utils/testUtils';
import { ApexTestTreeService, type TreeMutationContext } from './apexTestTreeService';

const TEST_RESULT_JSON_FILE = 'test-result.json';

/** How the run profile constrains an implicit "run all" (no explicit test selection). */
export type ApexTestRunScope = 'workspace-first' | 'all-org' | 'stale-workspace' | 'stale-org';

/** Per-invocation runtime data (params, not service deps). Tree maps + suiteToClasses come from
 * ApexTestTreeService accessors; suite resolution delegates to ApexTestTreeService.resolveSuiteChildren.
 * Connection/TestService are no longer threaded in: methods acquire the connection on demand via
 * ConnectionService.getConnection() (cached) + `new TestService(conn)`. */
export type ExecutionContext = {
  controller: vscode.TestController;
  orgOnlyTag: vscode.TestTag | undefined;
  inWorkspaceTag: vscode.TestTag | undefined;
};

/** Params for executeTests (run the resolved tests, write + claim the result, push into the live run). */
type ExecuteTestsParams = {
  testNames: string[];
  outputDir: URI;
  codeCoverage: boolean;
  token: vscode.CancellationToken;
  run: vscode.TestRun;
  testsToRun: vscode.TestItem[];
  runAllTestsInOrg: boolean;
};

/** Params for runTestPipeline (debug-or-execute branch for the resolved tests). */
type RunTestPipelineParams = {
  ctx: ExecutionContext;
  request: vscode.TestRunRequest;
  token: vscode.CancellationToken;
  isDebug: boolean;
  runScope: ApexTestRunScope;
  isImplicitFullRun: boolean;
  finalTests: vscode.TestItem[];
  run: vscode.TestRun;
};

/**
 * Owns the run/debug/result-processing region extracted from ApexTestController. Owns the
 * lastProcessedResultFile Ref (Option<URI>). Cross-extension services (ChannelService/FsService) are
 * reached through the api.services bridge — the apex-testing convention every service/command/watcher in
 * this package follows (see codeCoverageService, apexTestTreeService, testReportGenerator). Declaring them
 * as `.Default` deps would build a second, wrong-named channel (the runtime provides ChannelService via a
 * named ChannelServiceLayer('Apex Testing')). Still substitutable in tests by stubbing api.services.
 */
export class ApexTestExecutionService extends Effect.Service<ApexTestExecutionService>()('ApexTestExecutionService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    // Replaces the shell's `lastProcessedResultFile: URI | null`. executeTests writes via Ref.set;
    // onResultFileCreate reads via Ref.get + Option.match to dedupe the watcher against the run's own write.
    const lastProcessedResultFile = yield* Ref.make(Option.none<URI>());

    // ChannelService / FsService are yielded lazily inside the methods (not in this service-constructor
    // body) so ApexTestExecutionService.Default carries no build-time requirement — the runtime layer
    // (ChannelServiceLayer('Apex Testing') + the prebuilt FsService) provides them when methods run, the
    // same lazy pattern ApexTestTreeService uses for ExtensionProviderService.

    /** Read the JSON result file and parse it as a TestResult. */
    const readTestResult = Effect.fn('ApexTestExecutionService.readTestResult')(function* (testResultUri: URI) {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const resultText = yield* api.services.FsService.readFile(testResultUri).pipe(
        Effect.mapError(e => new TestExecutionError({ message: getMessageFromError(e) }))
      );
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return JSON.parse(resultText) as TestResult;
    });

    /** Test results folder for the run, failing with TestTempFolderError when no workspace can be resolved. */
    const getTempFolder = Effect.fn('ApexTestExecutionService.getTempFolder')(function* () {
      return yield* getTestResultsFolder().pipe(
        Effect.catchTags({
          NoDefaultOrgError: toTempFolderError,
          NoWorkspaceOpenError: toTempFolderError
        })
      );
    });

    /**
     * Apply a TestRun's results to the Test Explorer tree from an on-disk result file. Used by the watcher
     * (onResultFileCreate) and discovery's restore path. Creates its own detached TestRun since there is no
     * live run to attach to.
     */
    const updateTestResults = Effect.fn('ApexTestExecutionService.updateTestResults')(function* (
      ctx: ExecutionContext,
      testResultUri: URI
    ) {
      const resultContent = yield* readTestResult(testResultUri);
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const settings = yield* api.services.SettingsService;
      const [methodItems, classItems, codeCoverage, concise] = yield* Effect.all([
        ApexTestTreeService.getMethodItems(),
        ApexTestTreeService.getClassItems(),
        settings.getValue<boolean>(APEX_TESTING_SECTION, 'retrieve-test-code-coverage', false),
        settings.getValue<boolean>(APEX_TESTING_SECTION, 'test-run-concise', false)
      ]);
      const run = yield* Effect.sync(() => ctx.controller.createTestRun(new vscode.TestRunRequest()));
      yield* Effect.sync(() =>
        updateTestRunResults({
          result: resultContent,
          run,
          testsToRun: [],
          methodItems,
          classItems,
          codeCoverage: codeCoverage ?? false,
          concise: concise ?? false
        })
      ).pipe(Effect.ensuring(Effect.sync(() => run.end())));
    });

    /**
     * Watcher entrypoint: when a result file is created, process it once. Dedupes against executeTests's own
     * write (which records lastProcessedResultFile) so the watcher does not build a second, detached TestRun
     * for the same results.
     */
    const onResultFileCreate = Effect.fn('ApexTestExecutionService.onResultFileCreate')(function* (
      ctx: ExecutionContext,
      apexTestDir: URI,
      testResultUri: URI
    ) {
      const testRunId = yield* readTestRunIdFile(apexTestDir);
      const expectedResultUri = Utils.joinPath(
        apexTestDir,
        testRunId ? `test-result-${testRunId}.json` : TEST_RESULT_JSON_FILE
      );
      if (testResultUri.toString() !== expectedResultUri.toString()) {
        return;
      }
      const last = yield* Ref.get(lastProcessedResultFile);
      const alreadyProcessed = Option.match(last, {
        onNone: () => false,
        onSome: uri => uri.toString() === testResultUri.toString()
      });
      if (alreadyProcessed) {
        return;
      }
      yield* Ref.set(lastProcessedResultFile, Option.some(testResultUri));
      yield* updateTestResults(ctx, testResultUri);
    });

    /**
     * Run the selected tests asynchronously, write + claim the result file (so the watcher skips it), open
     * the report, clear stale tags, and push results into the live TestRun. Emits the `Ended …` channel
     * sentinel on success so e2e can gate run completion (run path only; debug emits no sentinel).
     */
    const executeTests = Effect.fn('ApexTestExecutionService.executeTests')(function* ({
      testNames,
      outputDir,
      codeCoverage,
      token,
      run,
      testsToRun,
      runAllTestsInOrg
    }: ExecuteTestsParams) {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const connection = yield* api.services.ConnectionService.getConnection().pipe(
        Effect.mapError(e => new TestExecutionError({ message: toUserFriendlyApexTestError(e) }))
      );
      const testService = new TestService(connection);
      const { payload, hasSuite, hasClass } = runAllTestsInOrg
        ? {
            payload: { testLevel: TestLevel.RunAllTestsInOrg, skipCodeCoverage: !codeCoverage },
            hasSuite: false,
            hasClass: false
          }
        : yield* buildTestPayload(testService, testsToRun, testNames, codeCoverage);

      const result = yield* Effect.tryPromise({
        try: async (): Promise<TestResult> => {
          const raw = await testService.runTestAsynchronous(
            payload,
            codeCoverage,
            false,
            {
              report: value => {
                if (value.type === 'StreamingClientProgress' || value.type === 'FormatTestResultProgress') {
                  run.appendOutput(`${value.message}\n`);
                }
              }
            },
            token
          );
          // TODO: fix in apex-node W-18453221
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return raw as TestResult;
        },
        catch: e => new TestExecutionError({ message: toUserFriendlyApexTestError(e) })
      });

      if (token.isCancellationRequested) {
        return;
      }

      // Write JSON result file and claim it as processed so the watcher's onResultFileCreate skips it and
      // does not build a second, detached TestRun for these same results (which would evict the shared
      // Run-All group to "older results"; see W-… history in the shell). Non-fatal: a write failure logs
      // and the run continues (report + result push still happen), matching the legacy console.error path.
      yield* writeTestResultJsonFile(result, outputDir, codeCoverage).pipe(
        Effect.catchTag('FsServiceError', error => Effect.logError('Failed to write JSON test result file', { error }))
      );
      const writtenResultFilename = result.summary?.testRunId
        ? `test-result-${result.summary.testRunId}.json`
        : TEST_RESULT_JSON_FILE;
      yield* Ref.set(lastProcessedResultFile, Option.some(Utils.joinPath(outputDir, writtenResultFilename)));

      // Generate and open the report (non-fatal: log + continue on failure).
      const reportSettings = yield* api.services.SettingsService;
      const outputFormat =
        (yield* reportSettings.getValue<'markdown' | 'text'>(APEX_TESTING_SECTION, 'outputFormat', 'markdown')) ??
        'markdown';
      const sortOrder =
        (yield* reportSettings.getValue<'runtime' | 'coverage' | 'severity'>(
          APEX_TESTING_SECTION,
          'testSortOrder',
          'runtime'
        )) ?? 'runtime';
      const reportUri = yield* writeAndOpenTestReport(result, outputDir, outputFormat, codeCoverage, sortOrder).pipe(
        Effect.tap(() => Effect.annotateCurrentSpan({ outputFormat, trigger: 'testExplorer' })),
        Effect.withSpan('apexTestReportGenerated'),
        // Report generation is best-effort; recover failures AND defects (e.g. a transformer throwing
        // synchronously) so a broken report never fails the test run, matching the legacy try/catch.
        Effect.catchAllCause(cause =>
          Effect.logError('Failed to generate test report', { cause }).pipe(Effect.as(undefined))
        )
      );

      // Clear stale indicators and apply active tags BEFORE updating results: VS Code snapshots
      // item.description when run.passed() is called.
      yield* ApexTestTreeService.clearStaleTags(testsToRun);

      const [methodItems, classItems] = yield* Effect.all([
        ApexTestTreeService.getMethodItems(),
        ApexTestTreeService.getClassItems()
      ]);
      yield* Effect.sync(() =>
        updateTestRunResults({ result, run, testsToRun, methodItems, classItems, codeCoverage })
      );

      const totalCount = result.summary.testsRan ?? 0;
      const command: ProgressAndSuccessCommandKey = messages.apex_test_run_text;
      const executionName = hasSuite
        ? nls.localize('apex_test_suite_run_text')
        : hasClass
          ? nls.localize('apex_test_class_run_text')
          : nls.localize('apex_test_run_text');
      // Sentinel (run path only): e2e gates run completion on `Ended SFDX: Run Apex Tests`. Uses the
      // ambient 'Apex Testing' ChannelService (api.services), same channel the run-command files emit to.
      // Must append BEFORE the success notification below: a toast success notification with an action
      // button awaits the user's response, which never resolves in a headless e2e run.
      const channelService = yield* api.services.ChannelService;
      yield* channelService.appendToChannel(`Ended ${executionName}`);
      if (totalCount > 0) {
        const notificationMode = yield* api.services.NotificationModeService;
        const runtime = yield* Effect.runtime<Effect.Effect.Context<ReturnType<typeof openTestReport>>>();
        yield* showRunSuccessNotification(
          notificationMode,
          command,
          executionName,
          reportUri,
          outputFormat,
          (uri, format) => Runtime.runPromise(runtime)(openTestReport(uri, format))
        );
      }
    });

    /**
     * Debug the selected tests by delegating to the replay-debugger commands. Org-only tests cannot be
     * debugged (errored + notified). No channel sentinel (debug delegates async to the replay-debugger).
     */
    const debugTests = Effect.fn('ApexTestExecutionService.debugTests')(function* (
      ctx: ExecutionContext,
      testsToRun: vscode.TestItem[],
      run: vscode.TestRun
    ) {
      const orgOnlyTag = ctx.orgOnlyTag;
      const orgOnlyTests = orgOnlyTag ? testsToRun.filter(test => test.tags?.includes(orgOnlyTag)) : [];
      if (orgOnlyTests.length > 0) {
        const errorMessage = nls.localize('apex_test_debug_org_only_warning_message');
        yield* Effect.sync(() => {
          orgOnlyTests.forEach(test => run.errored(test, new vscode.TestMessage(errorMessage)));
          void vscode.window.showErrorMessage(errorMessage);
        });
      }
      const testsToDebug = orgOnlyTag ? testsToRun.filter(test => !test.tags?.includes(orgOnlyTag)) : testsToRun;
      if (testsToDebug.length === 0) {
        return;
      }

      // Accumulators built by Loop A and consumed by Loops B/C. concurrency:1 on every Effect.forEach keeps
      // the replay debugger serviced one session at a time and makes the mutable-collection writes safe.
      const classIdsToDebug = new Set<string>();
      const methodsToDebug = new Map<string, Set<string>>();

      // Dispatch one replay-debugger command; map rejection to the E channel (never the raw value) then
      // recover in place so the failure never escapes the debug path.
      const dispatchDebug = (command: string, name: string, recover: (err: DebugDispatchError) => void) =>
        Effect.tryPromise({
          try: () => vscode.commands.executeCommand(command, { name }),
          catch: error => new DebugDispatchError({ message: toUserFriendlyApexTestError(error) })
        }).pipe(Effect.catchTag('DebugDispatchError', err => Effect.sync(() => recover(err))));

      // Loop A: partition selections into class-level and method-level debug; className-less methods and
      // suites are handled inline (dispatch / not-supported error).
      yield* Effect.forEach(
        testsToDebug,
        test => {
          if (isMethod(test.id)) {
            const testName = getTestName(test);
            const className = extractClassName(test.id);
            return className
              ? Effect.sync(() => {
                  const existingMethods = methodsToDebug.get(className) ?? new Set<string>();
                  existingMethods.add(testName);
                  methodsToDebug.set(className, existingMethods);
                })
              : dispatchDebug('sf.test.view.debugSingleTest', testName, err =>
                  run.errored(test, new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', err.message)))
                );
          }
          if (isClass(test.id)) {
            return Effect.sync(() => void classIdsToDebug.add(getTestName(test)));
          }
          if (isSuite(test.id)) {
            return Effect.sync(() =>
              run.errored(test, new vscode.TestMessage(nls.localize('apex_test_suite_debug_not_supported_message')))
            );
          }
          return Effect.void;
        },
        { concurrency: 1, discard: true }
      );

      // Loop B: class-level debug dispatch; on failure mark every selected test covered by the class errored.
      yield* Effect.forEach(
        [...classIdsToDebug],
        className =>
          dispatchDebug('sf.test.view.debugTests', className, err =>
            testsToDebug
              .filter(
                test =>
                  (isClass(test.id) && getTestName(test) === className) ||
                  (isMethod(test.id) && extractClassName(test.id) === className)
              )
              .forEach(test =>
                run.errored(test, new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', err.message)))
              )
          ),
        { concurrency: 1, discard: true }
      );

      // Loop C: method-level debug dispatch, skipping classes already debugged at class level (Loop B).
      yield* Effect.forEach(
        [...methodsToDebug],
        ([className, methods]) =>
          classIdsToDebug.has(className)
            ? Effect.void
            : Effect.forEach(
                [...methods],
                methodName =>
                  dispatchDebug('sf.test.view.debugSingleTest', methodName, err =>
                    testsToDebug
                      .filter(
                        test =>
                          isMethod(test.id) &&
                          extractClassName(test.id) === className &&
                          getTestName(test) === methodName
                      )
                      .forEach(test =>
                        run.errored(
                          test,
                          new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', err.message))
                        )
                      )
                  ),
                { concurrency: 1, discard: true }
              ),
        { concurrency: 1, discard: true }
      );
    });

    /**
     * Cache single class/method selections so Re-Run Last Class/Method surfaces (esp. web, no code lenses).
     * Detect from the RAW request.include before suite resolution/expansion. Run-profile only (not Debug).
     * Best-effort: failures are logged then ignored so they never fail the run.
     */
    const cacheSingleSelection = Effect.fn('ApexTestExecutionService.cacheSingleSelection')(function* (
      request: vscode.TestRunRequest,
      isDebug: boolean
    ) {
      const single = request.include?.length === 1 ? request.include[0] : undefined;
      if (isDebug || !single) {
        return;
      }
      yield* Match.value(single.id).pipe(
        Match.when(
          id => isClass(id) || isSuiteClass(id),
          () => ApexTestRunCacheService.setCachedClassTestParam(getTestName(single))
        ),
        Match.when(isMethod, () => ApexTestRunCacheService.setCachedMethodTestParam(getTestName(single))),
        Match.orElse(() => Effect.void),
        Effect.tapError(error => Effect.logWarning('apex test re-run cache set failed', { error })),
        Effect.ignore
      );
    });

    /**
     * Debug-or-execute branch for the resolved tests, with per-error run.errored mapping and run.end in
     * ensuring. Named so it carries its own span (vs an inline Effect.gen) for the debug/execute work.
     */
    const runTestPipeline = Effect.fn('ApexTestExecutionService.runTestPipeline')(function* ({
      ctx,
      request,
      token,
      isDebug,
      runScope,
      isImplicitFullRun,
      finalTests,
      run
    }: RunTestPipelineParams) {
      yield* Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan({
          trigger: 'testController',
          isDebug: String(isDebug),
          testsRan: finalTests.length
        });
        if (isDebug) {
          yield* debugTests(ctx, finalTests, run);
        } else {
          const testNames = finalTests.map(test => getTestName(test));
          const tmpFolder = yield* getTempFolder();
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          const settings = yield* api.services.SettingsService;
          const codeCoverage =
            (yield* settings.getValue<boolean>(APEX_TESTING_SECTION, 'retrieve-test-code-coverage', false)) ?? false;
          const runAllTestsInOrg =
            runScope === 'all-org' && isImplicitFullRun && (!request.exclude || request.exclude.length === 0);
          yield* executeTests({
            testNames,
            outputDir: tmpFolder,
            codeCoverage,
            token,
            run,
            testsToRun: finalTests,
            runAllTestsInOrg
          });
        }
      }).pipe(Effect.withSpan('apexTestRun'));
    });

    /**
     * Run-profile callback body: gather the requested tests, narrow per run scope (workspace-first /
     * all-org / stale-*), expand suites, then either debug or execute. Errors from the execution pipeline
     * are surfaced per test item (run.errored) so the run always ends cleanly.
     */
    const runTests = Effect.fn('ApexTestExecutionService.runTests')(function* (
      ctx: ExecutionContext,
      request: vscode.TestRunRequest,
      token: vscode.CancellationToken,
      isDebug: boolean,
      runScope: ApexTestRunScope
    ) {
      const suiteItems = yield* ApexTestTreeService.getSuiteItems();
      const methodItems = yield* ApexTestTreeService.getMethodItems();
      // Live Ref-backed Map: resolveSuiteChildren mutates it in place, so this snapshot stays current.
      const suiteToClasses = yield* ApexTestTreeService.getSuiteToClasses();
      const run = yield* Effect.sync(() => ctx.controller.createTestRun(request));

      yield* cacheSingleSelection(request, isDebug);

      const gatheredTests = gatherTests(request, ctx.controller.items, suiteItems);

      // Implicit full run (no explicit selection): restrict to in-workspace tests for the default profiles.
      const isImplicitFullRun = !request.include?.length;

      // Explicit multi-select of a mix of suites and individual tests/classes silently dropped the suites
      // downstream (buildTestPayload only builds a suite payload when the selection is suites-only). Reject
      // the whole run up front instead of executing a partial, confusing subset.
      if (
        !isImplicitFullRun &&
        gatheredTests.some(test => isSuite(test.id)) &&
        gatheredTests.some(test => !isSuite(test.id))
      ) {
        const message = nls.localize('apex_test_mixed_selection_not_supported_message');
        yield* Effect.sync(() => {
          gatheredTests.forEach(test => run.errored(test, new vscode.TestMessage(message)));
          void vscode.window.showErrorMessage(message);
          run.end();
        });
        return;
      }

      const inWorkspaceTag = ctx.inWorkspaceTag;
      const workspaceScopedTests =
        runScope === 'workspace-first' && isImplicitFullRun && inWorkspaceTag
          ? gatheredTests.filter(test => test.tags?.includes(inWorkspaceTag))
          : gatheredTests;

      // Stale profiles: expand all items to methods, keep only those with stale + matching location tag.
      const staleScopedTests =
        runScope === 'stale-workspace' || runScope === 'stale-org'
          ? narrowToStaleMethods(
              workspaceScopedTests,
              methodItems,
              suiteToClasses,
              runScope === 'stale-workspace' ? 'in-workspace' : 'org-only'
            )
          : workspaceScopedTests;

      // Resolve any suite in testsToRun so we have class data (for empty-suite check and expansion).
      yield* resolveUnloadedSuites(staleScopedTests, ctx);

      // Expand suites to their methods when running all tests (so multiple suites can run via method names).
      const expandedTests = isImplicitFullRun
        ? yield* ApexTestTreeService.getClassItems().pipe(
            Effect.flatMap(classItems => expandSuitesToMethods(staleScopedTests, ctx, suiteToClasses, classItems))
          )
        : staleScopedTests;

      // Suite expansion pulls methods from live class items and can reintroduce filter-hidden tests.
      const nonExcludedTests = filterTestItemsByRequestExclude(expandedTests, request.exclude);

      // Check for empty test suites and surface a clear error.
      const emptySuiteItems = nonExcludedTests.filter(
        test => isSuite(test.id) && (suiteToClasses.get(extractSuiteName(test.id) ?? '')?.size ?? 0) === 0
      );
      if (emptySuiteItems.length > 0) {
        const emptySuiteNames = emptySuiteItems.map(test => extractSuiteName(test.id)).filter((n): n is string => !!n);
        yield* Effect.sync(() => {
          emptySuiteItems.forEach(suiteItem =>
            run.errored(suiteItem, new vscode.TestMessage(nls.localize('apex_test_suite_empty_message')))
          );
          void vscode.window.showErrorMessage(
            nls.localize('apex_test_suite_empty_message_notification', emptySuiteNames.join(', '))
          );
        });
      }

      // Drop the empty suites flagged above (no-op when none were found).
      const finalTests = nonExcludedTests.filter(test => !emptySuiteItems.includes(test));

      if (finalTests.length === 0) {
        yield* Effect.sync(() => run.end());
        return;
      }

      yield* Effect.sync(() => {
        finalTests.forEach(test => run.started(test));
      });

      yield* runTestPipeline({ ctx, request, token, isDebug, runScope, isImplicitFullRun, finalTests, run }).pipe(
        Effect.catchTags({
          PayloadBuildError: e => erroredAll(run, finalTests, e.message),
          SuiteNameUnresolvedError: e => erroredAll(run, finalTests, e.message),
          TestTempFolderError: e => erroredAll(run, finalTests, e.message),
          TestExecutionError: e => erroredAll(run, finalTests, e.message)
        }),
        Effect.ensuring(Effect.sync(() => run.end()))
      );
    });

    return {
      lastProcessedResultFile,
      updateTestResults,
      onResultFileCreate,
      executeTests,
      debugTests,
      runTests
    };
  })
}) {}

/**
 * Mark every test in the run as errored with the failure message (run-pipeline failure surface).
 * Messages arrive already user-friendly: TestExecutionError carries toUserFriendlyApexTestError output,
 * the others carry localized nls strings.
 */
/** Map either workspace-resolution failure to the single user-facing "can't determine workspace" error. */
const toTempFolderError = () => new TestTempFolderError({ message: nls.localize('cannot_determine_workspace') });

const erroredAll = (run: vscode.TestRun, tests: vscode.TestItem[], message: string) =>
  Effect.sync(() => {
    tests.forEach(test => run.errored(test, new vscode.TestMessage(message)));
  });

/** Class names a selected item covers: itself for a class, its member classes for a suite, none for a method. */
const coveredClassNames = (test: vscode.TestItem, suiteToClasses: Map<string, Set<string>>): string[] => {
  if (isClass(test.id)) {
    const cn = extractClassName(test.id);
    return cn ? [cn] : [];
  }
  if (isSuite(test.id)) {
    const suiteName = extractSuiteName(test.id);
    const suiteClasses = suiteName ? suiteToClasses.get(suiteName) : undefined;
    return suiteClasses ? [...suiteClasses] : [];
  }
  return [];
};

/**
 * Stale-profile narrowing (pure): expand each selection to its methods and keep only those that are both
 * stale and match the profile's location tag ('in-workspace' for stale-workspace, 'org-only' for stale-org).
 */
const narrowToStaleMethods = (
  testsToRun: vscode.TestItem[],
  methodItems: Map<string, vscode.TestItem>,
  suiteToClasses: Map<string, Set<string>>,
  requiredLocationTag: 'in-workspace' | 'org-only'
): vscode.TestItem[] => {
  const isStaleAndMatchesLocation = (item: vscode.TestItem): boolean =>
    !!(item.tags?.some(t => t.id === 'stale') && item.tags?.some(t => t.id === requiredLocationTag));
  const methodEntries = [...methodItems];
  return testsToRun.flatMap(test =>
    isMethod(test.id)
      ? isStaleAndMatchesLocation(test)
        ? [test]
        : []
      : coveredClassNames(test, suiteToClasses).flatMap(className => {
          const classPrefix = `${className}.`;
          return methodEntries.flatMap(([methodId, methodItem]) =>
            methodId.startsWith(classPrefix) && isStaleAndMatchesLocation(methodItem) ? [methodItem] : []
          );
        })
  );
};

/** TreeMutationContext for suite resolution (controller + tags; no staleTag/suiteTag needed). */
const toTreeMutationContext = (ctx: ExecutionContext): TreeMutationContext => ({
  controller: ctx.controller,
  suiteTag: undefined,
  orgOnlyTag: ctx.orgOnlyTag,
  inWorkspaceTag: ctx.inWorkspaceTag,
  staleTag: undefined
});

/** Resolve one suite via the tree service, logging (non-fatal) any ResolveSuiteChildrenError so a failed
 * suite passes through unresolved rather than failing the whole run (the empty-suite check handles it). */
const resolveSuiteChildrenBestEffort = Effect.fn('ApexTestExecutionService.resolveSuiteChildrenBestEffort')(function* (
  ctx: ExecutionContext,
  test: vscode.TestItem
) {
  yield* ApexTestTreeService.resolveSuiteChildren(toTreeMutationContext(ctx), test).pipe(
    Effect.catchTag('ResolveSuiteChildrenError', error =>
      Effect.logWarning('Failed to resolve suite children (non-fatal)', { error })
    )
  );
});

/** Resolve any suite in the list whose children haven't been loaded yet (needed for empty-suite + expansion). */
const resolveUnloadedSuites = Effect.fn('ApexTestExecutionService.resolveUnloadedSuites')(function* (
  testsToRun: vscode.TestItem[],
  ctx: ExecutionContext
) {
  yield* Effect.forEach(
    testsToRun,
    test =>
      isSuite(test.id) && extractSuiteName(test.id) && test.children.size === 0
        ? resolveSuiteChildrenBestEffort(ctx, test)
        : Effect.void,
    { concurrency: 1, discard: true }
  );
});

/**
 * Expand suites to their member methods (implicit full run only) so multiple suites can run via method
 * names. Non-suite items and unresolvable suites pass through unchanged.
 */
const expandSuitesToMethods = Effect.fn('ApexTestExecutionService.expandSuitesToMethods')(function* (
  testsToRun: vscode.TestItem[],
  ctx: ExecutionContext,
  suiteToClasses: Map<string, Set<string>>,
  classItems: Map<string, vscode.TestItem>
) {
  const expandedNested = yield* Effect.forEach(
    testsToRun,
    test =>
      Effect.gen(function* () {
        const suiteName = isSuite(test.id) ? extractSuiteName(test.id) : undefined;
        if (!suiteName) {
          return [test];
        }
        if (test.children.size === 0) {
          yield* resolveSuiteChildrenBestEffort(ctx, test);
        }
        const classNames = suiteToClasses.get(suiteName);
        return classNames && classNames.size > 0
          ? [...classNames].flatMap(className => {
              const classItem = classItems.get(className);
              return classItem ? Array.from(classItem.children, ([, item]) => item) : [];
            })
          : [test];
      }),
    { concurrency: 1 }
  );
  return expandedNested.flat();
});
