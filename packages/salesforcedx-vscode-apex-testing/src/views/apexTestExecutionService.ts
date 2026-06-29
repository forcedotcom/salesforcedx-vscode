/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestLevel, TestResult, TestService } from '@salesforce/apex-node';
import { ExtensionProviderService, getMessageFromError } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { TEST_ID_PREFIXES } from '../constants';
import { nls } from '../messages';
import * as settings from '../settings';
import { telemetryService } from '../telemetry/telemetry';
import { ApexTestRunCacheService } from '../testRunCache/apexTestRunCacheService';
import { toUserFriendlyApexTestError } from '../utils/apexTestErrorMapper';
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
import { writeAndOpenTestReport } from '../utils/testReportGenerator';
import { updateTestRunResults } from '../utils/testResultProcessor';
import { readTestRunIdFile, writeTestResultJsonFile } from '../utils/testUtils';
import { TestExecutionError, TestTempFolderError } from './apexTestExecutionErrors';
import { ApexTestTreeService } from './apexTestTreeService';

const TEST_RESULT_JSON_FILE = 'test-result.json';

/** How the run profile constrains an implicit "run all" (no explicit test selection). */
export type ApexTestRunScope = 'workspace-first' | 'all-org' | 'stale-workspace' | 'stale-org';

/**
 * Per-invocation runtime data the execution methods need: vscode lifecycle objects (controller, tags),
 * the lazily-initialized org connection/testService, and shell-resident lookups that stay out of scope
 * (suite-child resolution, suite→classes map). These are params (runtime data), NOT service dependencies.
 * Tree maps are read via ApexTestTreeService accessors (not passed here). lastProcessedResultFile is a
 * service-owned Ref (not a param). ChannelService/FsService are yielded from context (deps), not params.
 */
export type ExecutionContext = {
  controller: vscode.TestController;
  orgOnlyTag: vscode.TestTag | undefined;
  inWorkspaceTag: vscode.TestTag | undefined;
  ensureInitialized: () => Promise<void>;
  getTestService: () => TestService;
  resolveSuiteChildren: (suiteItem: vscode.TestItem) => Promise<void>;
  getSuiteToClasses: () => Map<string, Set<string>>;
};

/**
 * ApexTestExecutionService — owns the run/debug/result-processing region extracted from the shell
 * ApexTestController. The shell keeps vscode lifecycle objects (controller, tags) and the suiteToClasses
 * writer, passing them via ExecutionContext (runtime data); the service owns the lastProcessedResultFile
 * Ref (an Option<URI>, replacing the shell's URI|null sentinel) plus the run/debug/result Effects.
 *
 * ChannelService / FsService are obtained via api.services (the services-extension bridge), not declared
 * as Default dependencies: the apex-testing runtime provides ChannelService via ChannelServiceLayer('Apex
 * Testing') (a Layer.succeed instance), NOT ChannelService.Default — declaring `.Default` here would build
 * a second, generic-named ChannelService and send the `Ended …` sentinel to the wrong channel. The service
 * class values are also exported only as types from salesforcedx-vscode-services, so api.services is the
 * only cross-package handle. This stays substitutable in tests (provide a stub ExtensionProviderService
 * whose api.services.ChannelService/FsService are stubs — same seam the tree-service tests use for
 * FsService). Settings are plain sync vscode config reads via the `settings` module, matching all other
 * apex-testing Effect code (apexTestRun.ts, apexTestTreeService.ts). ApexTestTreeService is reached via its
 * accessors (already in the merged runtime layer), not re-provided here.
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
        Effect.catchAll(() => new TestTempFolderError({ message: nls.localize('cannot_determine_workspace') }))
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
      const [methodItems, classItems] = yield* Effect.all([
        ApexTestTreeService.getMethodItems(),
        ApexTestTreeService.getClassItems()
      ]);
      yield* Effect.sync(() => {
        const run = ctx.controller.createTestRun(new vscode.TestRunRequest());
        try {
          updateTestRunResults({
            result: resultContent,
            run,
            testsToRun: [],
            methodItems,
            classItems,
            codeCoverage: settings.retrieveTestCodeCoverage(),
            concise: settings.retrieveTestRunConcise()
          });
        } finally {
          run.end();
        }
      });
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
      const testRunId = yield* Effect.promise(() => readTestRunIdFile(apexTestDir));
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
     * Clears stale tags from the test items that were just run, then propagates the clear up to parent class
     * and suite items once none of their members remain stale.
     */
    const clearStaleTagsForTests = Effect.fn('ApexTestExecutionService.clearStaleTagsForTests')(function* (
      ctx: ExecutionContext,
      testsToRun: vscode.TestItem[]
    ) {
      const [methodItems, classItems, suiteItems] = yield* Effect.all([
        ApexTestTreeService.getMethodItems(),
        ApexTestTreeService.getClassItems(),
        ApexTestTreeService.getSuiteItems()
      ]);
      const suiteToClasses = ctx.getSuiteToClasses();
      yield* Effect.sync(() => {
        // Build a set of method map keys that were just run (keys don't have the method: prefix)
        const runMethodIds = new Set<string>();
        for (const test of testsToRun) {
          if (isMethod(test.id)) {
            runMethodIds.add(test.id.replace(TEST_ID_PREFIXES.METHOD, ''));
          } else if (isClass(test.id)) {
            const className = extractClassName(test.id);
            if (className) {
              const classPrefix = `${className}.`;
              for (const methodId of methodItems.keys()) {
                if (methodId.startsWith(classPrefix)) {
                  runMethodIds.add(methodId);
                }
              }
            }
          } else if (isSuite(test.id)) {
            const suiteName = extractSuiteName(test.id);
            const classNames = suiteName ? suiteToClasses.get(suiteName) : undefined;
            if (classNames) {
              for (const className of classNames) {
                const classPrefix = `${className}.`;
                for (const methodId of methodItems.keys()) {
                  if (methodId.startsWith(classPrefix)) {
                    runMethodIds.add(methodId);
                  }
                }
              }
            }
          }
        }

        // Clear stale tags from methods that were run
        const affectedClasses = new Set<string>();
        for (const methodId of runMethodIds) {
          const methodItem = methodItems.get(methodId);
          if (methodItem) {
            methodItem.tags = (methodItem.tags ?? []).filter(t => t.id !== 'stale');
            affectedClasses.add(methodId.split('.')[0]);
          }
        }

        // Remove stale tag from parent class items if no methods remain stale
        for (const className of affectedClasses) {
          const classItem = classItems.get(className);
          if (classItem) {
            const classPrefix = `${className}.`;
            const hasStaleMethod = [...methodItems.entries()].some(
              ([id, item]) => id.startsWith(classPrefix) && item.tags?.some(t => t.id === 'stale')
            );
            if (!hasStaleMethod) {
              classItem.tags = (classItem.tags ?? []).filter(t => t.id !== 'stale');
            }
          }
        }

        // Remove stale tag from suite items if no member classes remain stale
        for (const [suiteName, suiteItem] of suiteItems) {
          const classNames = suiteToClasses.get(suiteName);
          if (classNames) {
            const hasStaleClass = [...classNames].some(cn => classItems.get(cn)?.tags?.some(t => t.id === 'stale'));
            if (!hasStaleClass) {
              suiteItem.tags = (suiteItem.tags ?? []).filter(t => t.id !== 'stale');
            }
          }
        }
      });
    });

    /**
     * Run the selected tests asynchronously, write + claim the result file (so the watcher skips it), open
     * the report, clear stale tags, and push results into the live TestRun. Emits the `Ended …` channel
     * sentinel on success so e2e can gate run completion (run path only; debug emits no sentinel).
     */
    const executeTests = Effect.fn('ApexTestExecutionService.executeTests')(function* (
      ctx: ExecutionContext,
      testNames: string[],
      outputDir: URI,
      codeCoverage: boolean,
      token: vscode.CancellationToken,
      run: vscode.TestRun,
      testsToRun: vscode.TestItem[],
      runAllTestsInOrg: boolean
    ) {
      yield* Effect.tryPromise({
        try: () => ctx.ensureInitialized(),
        catch: e => new TestExecutionError({ message: toUserFriendlyApexTestError(e) })
      });

      const testService = ctx.getTestService();
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
      // Run-All group to "older results"; see W-… history in the shell).
      yield* Effect.tryPromise({
        try: () => writeTestResultJsonFile(result, outputDir, codeCoverage),
        catch: e => new TestExecutionError({ message: getMessageFromError(e) })
      });
      const writtenResultFilename = result.summary?.testRunId
        ? `test-result-${result.summary.testRunId}.json`
        : TEST_RESULT_JSON_FILE;
      yield* Ref.set(lastProcessedResultFile, Option.some(Utils.joinPath(outputDir, writtenResultFilename)));

      // Generate and open the report (non-fatal: log + continue on failure).
      const reportStartTime = Date.now();
      const outputFormat = settings.retrieveOutputFormat();
      const sortOrder = settings.retrieveTestSortOrder();
      yield* writeAndOpenTestReport(result, outputDir, outputFormat, codeCoverage, sortOrder).pipe(
        Effect.tap(() =>
          Effect.sync(() =>
            telemetryService.sendEventData(
              'apexTestReportGenerated',
              { outputFormat, trigger: 'testExplorer' },
              { reportDurationMs: Date.now() - reportStartTime }
            )
          )
        ),
        // Report generation is best-effort; recover failures AND defects (e.g. a transformer throwing
        // synchronously) so a broken report never fails the test run, matching the legacy try/catch.
        Effect.catchAllCause(cause => Effect.logError('Failed to generate test report', { cause }))
      );

      // Clear stale indicators and apply active tags BEFORE updating results: VS Code snapshots
      // item.description when run.passed() is called.
      yield* clearStaleTagsForTests(ctx, testsToRun);

      const [methodItems, classItems] = yield* Effect.all([
        ApexTestTreeService.getMethodItems(),
        ApexTestTreeService.getClassItems()
      ]);
      yield* Effect.sync(() =>
        updateTestRunResults({ result, run, testsToRun, methodItems, classItems, codeCoverage })
      );

      const totalCount = result.summary.testsRan ?? 0;
      const executionName = hasSuite
        ? nls.localize('apex_test_suite_run_text')
        : hasClass
          ? nls.localize('apex_test_class_run_text')
          : nls.localize('apex_test_run_text');
      if (totalCount > 0) {
        yield* Effect.sync(
          () =>
            void vscode.window.showInformationMessage(
              nls.localize('apex_test_successful_execution_message', executionName)
            )
        );
      }
      // Sentinel (run path only): e2e gates run completion on `Ended SFDX: Run Apex Tests`. Uses the
      // ambient 'Apex Testing' ChannelService (api.services), same channel the run-command files emit to.
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const channelService = yield* api.services.ChannelService;
      yield* channelService.appendToChannel(`Ended ${executionName}`);
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
          for (const test of orgOnlyTests) {
            run.errored(test, new vscode.TestMessage(errorMessage));
          }
          void vscode.window.showErrorMessage(errorMessage);
        });
      }
      const testsToDebug = orgOnlyTag ? testsToRun.filter(test => !test.tags?.includes(orgOnlyTag)) : testsToRun;
      if (testsToDebug.length === 0) {
        return;
      }

      yield* Effect.promise(async () => {
        const classIdsToDebug = new Set<string>();
        const methodsToDebug = new Map<string, Set<string>>();

        for (const test of testsToDebug) {
          try {
            if (isMethod(test.id)) {
              const testName = getTestName(test);
              const className = extractClassName(test.id);
              if (className) {
                const existingMethods = methodsToDebug.get(className) ?? new Set<string>();
                existingMethods.add(testName);
                methodsToDebug.set(className, existingMethods);
              } else {
                await vscode.commands.executeCommand('sf.test.view.debugSingleTest', { name: testName });
              }
            } else if (isClass(test.id)) {
              classIdsToDebug.add(getTestName(test));
            } else if (isSuite(test.id)) {
              run.errored(test, new vscode.TestMessage(nls.localize('apex_test_suite_debug_not_supported_message')));
            }
          } catch (error) {
            const friendlyMessage = toUserFriendlyApexTestError(error);
            run.errored(test, new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', friendlyMessage)));
          }
        }

        for (const className of classIdsToDebug) {
          try {
            await vscode.commands.executeCommand('sf.test.view.debugTests', { name: className });
          } catch (error) {
            const friendlyMessage = toUserFriendlyApexTestError(error);
            for (const test of testsToDebug) {
              if (
                (isClass(test.id) && getTestName(test) === className) ||
                (isMethod(test.id) && extractClassName(test.id) === className)
              ) {
                run.errored(
                  test,
                  new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', friendlyMessage))
                );
              }
            }
          }
        }

        for (const [className, methods] of methodsToDebug) {
          // If class-level debug is explicitly selected, skip method-level debug for the same class.
          if (classIdsToDebug.has(className)) {
            continue;
          }
          for (const methodName of methods) {
            try {
              await vscode.commands.executeCommand('sf.test.view.debugSingleTest', { name: methodName });
            } catch (error) {
              const friendlyMessage = toUserFriendlyApexTestError(error);
              for (const test of testsToDebug) {
                if (isMethod(test.id) && extractClassName(test.id) === className && getTestName(test) === methodName) {
                  run.errored(
                    test,
                    new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', friendlyMessage))
                  );
                }
              }
            }
          }
        }
      });
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
    const runTestPipeline = Effect.fn('ApexTestExecutionService.runTestPipeline')(function* (
      ctx: ExecutionContext,
      request: vscode.TestRunRequest,
      token: vscode.CancellationToken,
      isDebug: boolean,
      runScope: ApexTestRunScope,
      isImplicitFullRun: boolean,
      finalTests: vscode.TestItem[],
      run: vscode.TestRun,
      startTime: number
    ) {
      if (isDebug) {
        yield* debugTests(ctx, finalTests, run);
      } else {
        const testNames = finalTests.map(test => getTestName(test));
        const tmpFolder = yield* getTempFolder();
        const codeCoverage = settings.retrieveTestCodeCoverage();
        const runAllTestsInOrg =
          runScope === 'all-org' && isImplicitFullRun && (!request.exclude || request.exclude.length === 0);
        yield* executeTests(ctx, testNames, tmpFolder, codeCoverage, token, run, finalTests, runAllTestsInOrg);
      }
      yield* Effect.sync(() =>
        telemetryService.sendEventData(
          'apexTestRun',
          { trigger: 'testController', isDebug: String(isDebug) },
          { durationMs: Date.now() - startTime, testsRan: finalTests.length }
        )
      );
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
      const startTime = Date.now();
      const suiteItems = yield* ApexTestTreeService.getSuiteItems();
      const methodItems = yield* ApexTestTreeService.getMethodItems();
      const suiteToClasses = ctx.getSuiteToClasses();
      const run = yield* Effect.sync(() => ctx.controller.createTestRun(request));

      yield* cacheSingleSelection(request, isDebug);

      let testsToRun = gatherTests(request, ctx.controller.items, suiteItems);

      // Implicit full run (no explicit selection): restrict to in-workspace tests for the default profiles.
      const isImplicitFullRun = !request.include?.length;
      const inWorkspaceTag = ctx.inWorkspaceTag;
      if (runScope === 'workspace-first' && isImplicitFullRun && inWorkspaceTag) {
        testsToRun = testsToRun.filter(test => test.tags?.includes(inWorkspaceTag));
      }

      // Stale profiles: expand all items to methods, keep only those with stale + matching location tag.
      if (runScope === 'stale-workspace' || runScope === 'stale-org') {
        const requiredLocationTag = runScope === 'stale-workspace' ? 'in-workspace' : 'org-only';
        const isStaleAndMatchesLocation = (item: vscode.TestItem): boolean =>
          !!(item.tags?.some(t => t.id === 'stale') && item.tags?.some(t => t.id === requiredLocationTag));
        const staleMethods: vscode.TestItem[] = [];
        for (const test of testsToRun) {
          if (isMethod(test.id)) {
            if (isStaleAndMatchesLocation(test)) {
              staleMethods.push(test);
            }
          } else {
            const classNames: string[] = [];
            if (isClass(test.id)) {
              const cn = extractClassName(test.id);
              if (cn) {
                classNames.push(cn);
              }
            } else if (isSuite(test.id)) {
              const suiteName = extractSuiteName(test.id);
              const suiteClasses = suiteName ? suiteToClasses.get(suiteName) : undefined;
              if (suiteClasses) {
                classNames.push(...suiteClasses);
              }
            }
            for (const className of classNames) {
              const classPrefix = `${className}.`;
              for (const [methodId, methodItem] of methodItems) {
                if (methodId.startsWith(classPrefix) && isStaleAndMatchesLocation(methodItem)) {
                  staleMethods.push(methodItem);
                }
              }
            }
          }
        }
        testsToRun = staleMethods;
      }

      // Resolve any suite in testsToRun so we have class data (for empty-suite check and expansion).
      yield* Effect.promise(async () => {
        for (const test of testsToRun) {
          if (isSuite(test.id)) {
            const suiteName = extractSuiteName(test.id);
            if (suiteName && test.children.size === 0) {
              await ctx.resolveSuiteChildren(test);
            }
          }
        }
      });

      // Expand suites to their methods when running all tests (so multiple suites can run via method names).
      if (!request.include || request.include.length === 0) {
        const classItems = yield* ApexTestTreeService.getClassItems();
        const expandedTests = yield* Effect.promise(async () => {
          const expanded: vscode.TestItem[] = [];
          for (const test of testsToRun) {
            if (isSuite(test.id)) {
              const suiteName = extractSuiteName(test.id);
              if (suiteName) {
                if (test.children.size === 0) {
                  await ctx.resolveSuiteChildren(test);
                }
                const classNames = suiteToClasses.get(suiteName);
                if (classNames && classNames.size > 0) {
                  for (const className of classNames) {
                    const classItem = classItems.get(className);
                    if (classItem) {
                      expanded.push(...Array.from(classItem.children, ([, item]) => item));
                    }
                  }
                } else {
                  expanded.push(test);
                }
              } else {
                expanded.push(test);
              }
            } else {
              expanded.push(test);
            }
          }
          return expanded;
        });
        testsToRun = expandedTests;
      }

      // Suite expansion pulls methods from live class items and can reintroduce filter-hidden tests.
      testsToRun = filterTestItemsByRequestExclude(testsToRun, request.exclude);

      // Check for empty test suites and surface a clear error.
      const emptySuiteItems = testsToRun.filter(
        test => isSuite(test.id) && (suiteToClasses.get(extractSuiteName(test.id) ?? '')?.size ?? 0) === 0
      );
      if (emptySuiteItems.length > 0) {
        const emptySuiteNames = emptySuiteItems.map(test => extractSuiteName(test.id)).filter((n): n is string => !!n);
        yield* Effect.sync(() => {
          for (const suiteItem of emptySuiteItems) {
            run.errored(suiteItem, new vscode.TestMessage(nls.localize('apex_test_suite_empty_message')));
          }
          void vscode.window.showErrorMessage(
            nls.localize('apex_test_suite_empty_message_notification', emptySuiteNames.join(', '))
          );
        });
        testsToRun = testsToRun.filter(test => !emptySuiteItems.includes(test));
      }

      if (testsToRun.length === 0) {
        yield* Effect.sync(() => run.end());
        return;
      }

      const finalTests = testsToRun;
      yield* Effect.sync(() => {
        for (const test of finalTests) {
          run.started(test);
        }
      });

      yield* runTestPipeline(
        ctx,
        request,
        token,
        isDebug,
        runScope,
        isImplicitFullRun,
        finalTests,
        run,
        startTime
      ).pipe(
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
      clearStaleTagsForTests,
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
const erroredAll = (run: vscode.TestRun, tests: vscode.TestItem[], message: string) =>
  Effect.sync(() => {
    for (const test of tests) {
      run.errored(test, new vscode.TestMessage(message));
    }
  });
