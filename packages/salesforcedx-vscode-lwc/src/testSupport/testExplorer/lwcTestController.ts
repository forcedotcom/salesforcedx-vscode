/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../../messages';
import { getRuntime } from '../../services/runtime';
import { telemetryService } from '../../telemetry';
import { lwcTestIndexer } from '../testIndexer';
import { taskService, SfTask } from '../testRunner/taskService';
import { TestRunner } from '../testRunner/testRunner';
import {
  LwcJestTestResults,
  TestCaseInfo,
  TestDirectoryInfo,
  TestExecutionInfo,
  TestFileInfo,
  TestResultStatus,
  isTestCaseInfo
} from '../types';
import { LWC_TEST_RUN_LOG_NAME } from '../types/constants';
import { isLwcJestTest } from '../utils/isLwcJestTest';
import { normalizeJestFsPath } from '../utils/normalizeJestFsPath';
import { workspace, workspaceService } from '../workspace';
import { appendLine, appendRunHeader, appendTestResultsOutput, TestItemLookup } from './testResultsOutput';

const TEST_CONTROLLER_ID = 'sf.lwc.testController';

// Matches .test.js and .test.ts suffixes
const TEST_FILE_SUFFIX_RE = /\.test\.[jt]s$/;

type ItemKind = 'file' | 'case';

const getFileLabel = (testUri: URI): string => {
  const base = Utils.basename(testUri);
  return base.replace(TEST_FILE_SUFFIX_RE, '');
};

const createFileId = (testUri: URI): string => `file:${testUri.toString()}`;

const createCaseId = (testUri: URI, testName: string, ancestorTitles: string[] | undefined): string => {
  const suffix = ancestorTitles && ancestorTitles.length > 0 ? `${ancestorTitles.join(' > ')} > ${testName}` : testName;
  return `case:${testUri.toString()}::${suffix}`;
};

/**
 * Normalize a file URI to a comparison key that is invariant to OS path aliasing: forward slashes and (on
 * Windows, whose filesystem is case-insensitive) lower case. Used to reconcile jest-reported long paths with
 * findFiles-reported short (8.3) paths when their shared suffix matches. The leading separator is dropped so the
 * key is a clean segment list.
 */
const toNormalizedPathKey = (testUri: URI): string => {
  const lower = process.platform === 'win32' ? testUri.fsPath.toLowerCase() : testUri.fsPath;
  return lower.replaceAll('\\', '/').replace(/^\/+/, '');
};

/**
 * True when two normalized path keys identify the same test file despite an aliased ancestor segment (e.g. the
 * Windows 8.3 short name `runner~1` vs `runneradmin`). We require the trailing path segments to match exactly up
 * to the first divergence and that divergence to be the only difference — i.e. one path is the other with a
 * single ancestor segment swapped, or they share a deep (>= 3 segment) suffix anchored at the filename. Three
 * segments is the LWC layout floor (`<component>/__tests__/<file>.test.js`), enough to be unambiguous.
 */
const sharePathTail = (a: string, b: string): boolean => {
  if (a === b) {
    return true;
  }
  const aSeg = a.split('/');
  const bSeg = b.split('/');
  let matched = 0;
  while (
    matched < aSeg.length &&
    matched < bSeg.length &&
    aSeg[aSeg.length - 1 - matched] === bSeg[bSeg.length - 1 - matched]
  ) {
    matched++;
  }
  return matched >= 3;
};

const getItemKind = (id: string): ItemKind | undefined => {
  if (id.startsWith('file:')) {
    return 'file';
  }
  if (id.startsWith('case:')) {
    return 'case';
  }
  return undefined;
};

/**
 * LWC Test Controller — exposes LWC Jest tests in VS Code's native Test Explorer.
 * Discovery reuses {@link lwcTestIndexer}; execution reuses {@link TestRunner}.
 */
class LwcTestController {
  private readonly controller: vscode.TestController;
  private readonly fileItems = new Map<string, vscode.TestItem>();
  private readonly caseItems = new Map<string, vscode.TestItem>();
  // Secondary index from a normalized (case- and separator-insensitive) path to the discovery URI used to key
  // fileItems/caseItems. Jest reports test paths with the OS-resolved long name (e.g. C:\Users\runneradmin\...)
  // while VS Code's findFiles can return an 8.3 short name (C:\Users\RUNNER~1\...). Those produce different
  // URI.toString() keys, so an exact fileItems.get() on the jest path misses and the run row is left undecorated
  // (ending up "(Skipped)"). This index lets results map back to the discovery URI without fs.realpath, which is
  // banned for web-extension compatibility.
  private readonly discoveryUriByNormalizedPath = new Map<string, URI>();
  private readonly disposables: vscode.Disposable[] = [];
  // All LWC Jest tests are workspace-only, so tag every item with the same `in-workspace` tag id the Apex
  // controller uses. VS Code's Test Explorer tag filter (@in-workspace) matches by tag id across all
  // controllers and hides untagged items, so without this the `@in-workspace` filter hides every LWC test.
  private readonly inWorkspaceTag = new vscode.TestTag('in-workspace');
  private runProfile!: vscode.TestRunProfile;
  private debugProfile!: vscode.TestRunProfile;

  constructor() {
    this.controller = vscode.tests.createTestController(TEST_CONTROLLER_ID, nls.localize('lwc_test_controller_label'));
    this.setupProfiles();
    this.setupResolveHandler();
    this.setupRefreshHandler();
    this.setupIndexerListeners();
  }

  public dispose = (): void => {
    while (this.disposables.length > 0) {
      const d = this.disposables.pop();
      d?.dispose();
    }
    this.controller.dispose();
  };

  public refresh = async (): Promise<void> => {
    lwcTestIndexer.resetIndex();
    await this.populateFiles();
  };

  /** Public entry: run (or debug) the test(s) described by `info` through the native Test Run UI. */
  public runByExecutionInfo = async (info: TestExecutionInfo, isDebug: boolean): Promise<void> => {
    const item = await this.resolveItemForExecutionInfo(info);
    if (!item) {
      return;
    }
    // Reveal the Test Results panel so command/code-lens/button runs surface progress immediately.
    void vscode.commands.executeCommand('workbench.panel.testResults.view.focus');
    // If caller asked for a specific case but we could only resolve the file item,
    // pass the original case info so jest still gets --testNamePattern (don't silently run the whole file).
    const execOverride = info.kind === 'testCase' && getItemKind(item.id) === 'file' ? info : undefined;
    const profile = isDebug ? this.debugProfile : this.runProfile;
    const request = new vscode.TestRunRequest([item], undefined, profile);
    const tokenSource = new vscode.CancellationTokenSource();
    try {
      await this.runTests(request, tokenSource.token, isDebug, execOverride);
    } finally {
      tokenSource.dispose();
    }
  };

  /** Public entry for the editor-title button / command palette: run the active LWC test file. */
  public runActiveEditorFile = (isDebug: boolean): Promise<void> | undefined => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isLwcJestTest(editor.document)) {
      return undefined;
    }
    const info: TestFileInfo = { kind: 'testFile', testUri: editor.document.uri };
    return this.runByExecutionInfo(info, isDebug);
  };

  private resolveItemForExecutionInfo = async (info: TestExecutionInfo): Promise<vscode.TestItem | undefined> => {
    // Normalize URI to match discovery keying (strips /private on macOS)
    const normalizedUri = URI.file(normalizeJestFsPath(info.testUri.fsPath));
    const fileId = createFileId(normalizedUri);
    // discovery may not have run yet for this uri; create the item on demand
    const fileItem =
      this.fileItems.get(fileId) ?? this.getOrCreateFileItem({ kind: 'testFile', testUri: normalizedUri });
    if (info.kind === 'testFile' || info.kind === 'testDirectory') {
      return fileItem;
    }
    // testCase: ensure children are resolved, then match by label (== jest testName)
    await this.resolveFileChildren(fileItem);
    const targetName = isTestCaseInfo(info) ? info.testName : undefined;
    let match: vscode.TestItem | undefined;
    fileItem.children.forEach(child => {
      if (!match && child.label === targetName) {
        match = child;
      }
    });
    return match ?? fileItem;
  };

  private setupProfiles = (): void => {
    this.runProfile = this.controller.createRunProfile(
      nls.localize('lwc_test_run_profile_title'),
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTests(request, token, false),
      true
    );
    this.debugProfile = this.controller.createRunProfile(
      nls.localize('lwc_test_debug_profile_title'),
      vscode.TestRunProfileKind.Debug,
      (request, token) => this.runTests(request, token, true)
    );
  };

  private setupResolveHandler = (): void => {
    this.controller.resolveHandler = async (test: vscode.TestItem | undefined) => {
      if (!test) {
        await this.populateFiles();
        return;
      }
      if (getItemKind(test.id) === 'file' && test.uri) {
        await this.resolveFileChildren(test);
      }
    };
  };

  private setupRefreshHandler = (): void => {
    this.controller.refreshHandler = async () => {
      await this.refresh();
    };
  };

  private setupIndexerListeners = (): void => {
    this.disposables.push(
      lwcTestIndexer.onDidUpdateTestIndex(() => {
        void this.populateFiles();
      }),
      lwcTestIndexer.onDidUpdateTestResultsIndex(() => {
        // Out-of-band results written by watch-mode runs (still on the bare-task path via executeAsSfTask).
        // Run/debug commands now route through this controller, so this listener exists only for watch.
        // Remove alongside the watch -> Continuous Run migration (follow-up WI).
        // Apply the indexer's latest per-file results so the Test Explorer shows pass/fail icons.
        void this.applyIndexerResults();
      })
    );
  };

  /**
   * Apply results stored in the indexer (from out-of-band watch-mode runs) to the VS Code
   * Test Explorer so pass/fail icons update. Run/debug now route through this controller and
   * attribute results to their own run; only watch still produces out-of-band results.
   */
  private applyIndexerResults = async (): Promise<void> => {
    try {
      const allFiles = await lwcTestIndexer.findAllTestFileInfo();
      const run = this.controller.createTestRun(new vscode.TestRunRequest(), 'out-of-band results', false);
      try {
        for (const fileInfo of allFiles) {
          const fileId = createFileId(fileInfo.testUri);
          const fileItem = this.fileItems.get(fileId);
          if (!fileItem) {
            continue;
          }
          const fileStatus = fileInfo.testResult?.status;
          const testCases = fileInfo.testCasesInfo ?? [];
          for (const testCase of testCases) {
            const caseId = createCaseId(testCase.testUri, testCase.testName, testCase.ancestorTitles);
            const caseItem = this.caseItems.get(caseId);
            if (caseItem) {
              const caseStatus = testCase.testResult?.status;
              if (caseStatus === 'passed') {
                run.passed(caseItem);
              } else if (caseStatus === 'failed') {
                run.failed(caseItem, new vscode.TestMessage(nls.localize('lwc_test_failed_message')));
              } else if (caseStatus === 'skipped') {
                run.skipped(caseItem);
              }
            }
          }
          if (fileStatus === 'passed') {
            run.passed(fileItem);
          } else if (fileStatus === 'failed') {
            run.failed(
              fileItem,
              new vscode.TestMessage(nls.localize('lwc_one_or_more_tests_failed_in_this_file_message'))
            );
          }
        }
      } finally {
        run.end();
      }
    } catch (error) {
      console.error('LWC applyIndexerResults failed:', error);
    }
  };

  private populateFiles = async (): Promise<void> => {
    try {
      const allFiles = await lwcTestIndexer.findAllTestFileInfo();
      const seen = new Set<string>();
      const items: vscode.TestItem[] = [];
      for (const fileInfo of allFiles) {
        const item = this.getOrCreateFileItem(fileInfo);
        items.push(item);
        seen.add(item.id);
      }
      items.sort((a, b) => (a.label > b.label ? 1 : -1));
      this.controller.items.replace(items);
      for (const id of this.fileItems.keys()) {
        if (!seen.has(id)) {
          this.fileItems.delete(id);
        }
      }
      // Rebuild the normalized-path index from the surviving file items so removed files don't linger.
      this.discoveryUriByNormalizedPath.clear();
      for (const item of this.fileItems.values()) {
        if (item.uri) {
          this.discoveryUriByNormalizedPath.set(toNormalizedPathKey(URI.revive(item.uri)), URI.revive(item.uri));
        }
      }
      for (const [id, item] of this.caseItems.entries()) {
        const parent = item.parent;
        if (!parent || !seen.has(parent.id)) {
          this.caseItems.delete(id);
        }
      }
    } catch (error) {
      console.error('LWC test discovery failed:', error);
    }
  };

  private getOrCreateFileItem = (fileInfo: TestFileInfo): vscode.TestItem => {
    const id = createFileId(fileInfo.testUri);
    const existing = this.fileItems.get(id);
    if (existing) {
      return existing;
    }
    const item = this.controller.createTestItem(id, getFileLabel(fileInfo.testUri), fileInfo.testUri);
    item.canResolveChildren = true;
    item.tags = [this.inWorkspaceTag];
    this.fileItems.set(id, item);
    this.discoveryUriByNormalizedPath.set(toNormalizedPathKey(fileInfo.testUri), fileInfo.testUri);
    return item;
  };

  /**
   * Map a jest-reported test URI back to the URI discovery used to key fileItems/caseItems. Jest emits the
   * OS-resolved long path while findFiles can emit an 8.3 short path (Windows), so an exact match may fail.
   * Try the normalized exact key first, then fall back to the unique discovery URI whose normalized path shares
   * the same trailing segments (the divergence is always in an ancestor segment, never the component/file tail).
   * Returns the jest URI unchanged when nothing matches, preserving prior behaviour.
   */
  private resolveDiscoveryUri = (jestUri: URI): URI => {
    const key = toNormalizedPathKey(jestUri);
    const exact = this.discoveryUriByNormalizedPath.get(key);
    if (exact) {
      return exact;
    }
    const matches: URI[] = [];
    for (const [candidateKey, candidateUri] of this.discoveryUriByNormalizedPath.entries()) {
      if (sharePathTail(key, candidateKey)) {
        matches.push(candidateUri);
      }
    }
    // Only trust the fallback when it is unambiguous; otherwise leave the jest URI so we don't mis-attribute.
    return matches.length === 1 ? matches[0] : jestUri;
  };

  private resolveFileChildren = async (fileItem: vscode.TestItem): Promise<void> => {
    if (!fileItem.uri) {
      return;
    }
    const testUri = URI.revive(fileItem.uri);
    const cases = await lwcTestIndexer.findTestInfoFromLwcJestTestFile(testUri);
    const seen = new Set<string>();
    const newItems: vscode.TestItem[] = [];
    for (const testCase of cases) {
      const id = createCaseId(testCase.testUri, testCase.testName, testCase.ancestorTitles);
      seen.add(id);
      let caseItem = this.caseItems.get(id);
      if (!caseItem) {
        caseItem = this.controller.createTestItem(id, testCase.testName, testCase.testUri);
        caseItem.tags = [this.inWorkspaceTag];
        this.caseItems.set(id, caseItem);
      }
      if (testCase.testLocation?.range) {
        caseItem.range = testCase.testLocation.range;
      }
      newItems.push(caseItem);
    }
    fileItem.children.replace(newItems);
    for (const [id, item] of this.caseItems.entries()) {
      if (item.parent === fileItem && !seen.has(id)) {
        this.caseItems.delete(id);
      }
    }
  };

  private topLevelItems = (): vscode.TestItem[] => {
    const items: vscode.TestItem[] = [];
    this.controller.items.forEach(item => items.push(item));
    return items;
  };

  private gatherTargets = (request: vscode.TestRunRequest): { item: vscode.TestItem; exec: TestExecutionInfo }[] => {
    const rootItems = request.include && request.include.length > 0 ? [...request.include] : this.topLevelItems();
    const excluded = new Set((request.exclude ?? []).map(item => item.id));
    const result: { item: vscode.TestItem; exec: TestExecutionInfo }[] = [];
    for (const item of rootItems) {
      if (excluded.has(item.id)) {
        continue;
      }
      const exec = this.toTestExecutionInfo(item);
      if (exec) {
        result.push({ item, exec });
      }
    }
    return result;
  };

  private toTestExecutionInfo = (item: vscode.TestItem): TestExecutionInfo | undefined => {
    const kind = getItemKind(item.id);
    if (!item.uri) {
      return undefined;
    }
    const testUri = URI.revive(item.uri);
    if (kind === 'file') {
      const info: TestFileInfo = {
        kind: 'testFile',
        testUri
      };
      return info;
    }
    if (kind === 'case') {
      const info: TestCaseInfo = {
        kind: 'testCase',
        testUri,
        testName: item.label
      };
      return info;
    }
    return undefined;
  };

  private runAllAsDirectory = (): TestDirectoryInfo | undefined => {
    const workspaceFolder = workspace.getTestWorkspaceFolder();
    if (!workspaceFolder) {
      return undefined;
    }
    return {
      kind: 'testDirectory',
      testUri: workspaceFolder.uri
    };
  };

  private runTests = async (
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
    isDebug: boolean,
    execOverride?: TestExecutionInfo
  ): Promise<void> => {
    const startTime = globalThis.performance.now();
    const run = this.controller.createTestRun(request);
    try {
      const targets = this.gatherTargets(request);
      const isImplicitRunAll = !request.include || request.include.length === 0;

      if (targets.length === 0 && !isImplicitRunAll) {
        return;
      }

      appendRunHeader(run, isDebug);

      // When running without any explicit selection, delegate to a single directory-level jest run
      // so we don't spawn one task per file.
      if (isImplicitRunAll) {
        const dirInfo = this.runAllAsDirectory();
        if (!dirInfo) {
          return;
        }
        for (const target of targets) {
          this.markRunning(run, target.item);
        }
        await this.executeOne(run, dirInfo, undefined, isDebug, token);
        return;
      }

      for (const target of targets) {
        if (token.isCancellationRequested) {
          break;
        }
        this.markRunning(run, target.item);
        // When execOverride is provided AND this is a single-item request, use the override
        // to preserve the original testName for --testNamePattern (e.g., when a case item
        // couldn't be resolved but we still want to run that specific test, not the whole file).
        const exec = execOverride && request.include?.length === 1 ? execOverride : target.exec;
        await this.executeOne(run, exec, target.item, isDebug, token);
      }
    } finally {
      run.end();
      if (!isDebug) {
        telemetryService.sendEventData(
          LWC_TEST_RUN_LOG_NAME,
          { workspaceType: workspaceService.getCurrentWorkspaceTypeForTelemetry() },
          { executionTime: globalThis.performance.now() - startTime }
        );
      }
    }
  };

  private markRunning = (run: vscode.TestRun, item: vscode.TestItem): void => {
    run.started(item);
    item.children.forEach(child => this.markRunning(run, child));
  };

  private executeOne = async (
    run: vscode.TestRun,
    exec: TestExecutionInfo,
    sourceItem: vscode.TestItem | undefined,
    isDebug: boolean,
    token: vscode.CancellationToken
  ): Promise<void> => {
    const testRunner = new TestRunner(exec, isDebug ? 'debug' : 'run');
    try {
      const shellInfo = await testRunner.getShellExecutionInfo();
      if (!shellInfo) {
        if (sourceItem) {
          run.errored(sourceItem, new vscode.TestMessage(nls.localize('no_lwc_testrunner_found_text')));
        }
        return;
      }

      const { command, args, workspaceFolder, testResultFsPath } = shellInfo;

      if (isDebug) {
        await vscode.debug.startDebugging(workspaceFolder, {
          sfDebugSessionId: globalThis.crypto.randomUUID(),
          type: 'node',
          request: 'launch',
          name: 'Debug LWC test(s)',
          cwd: workspaceFolder.uri.fsPath,
          runtimeExecutable: command,
          args,
          resolveSourceMapLocations: ['**', '!**/node_modules/**'],
          console: 'integratedTerminal',
          internalConsoleOptions: 'openOnSessionStart',
          port: 9229,
          disableOptimisticBPs: true
        });
        await waitForResultFile(testResultFsPath, token);
      } else {
        // Results surface in the Test Results tab. The Task API always allocates a terminal for a
        // ShellExecution; createTask's default presentation (reveal:Never, shared panel) keeps it
        // hidden and reused across runs rather than spawning a new terminal each run.
        const sfTask = taskService.createTask(
          globalThis.crypto.randomUUID(),
          nls.localize('run_test_task_name'),
          workspaceFolder,
          command,
          args
        );
        const ended = awaitTaskEnd(sfTask, token);
        await sfTask.execute();
        await ended;
      }

      if (token.isCancellationRequested) {
        return;
      }

      const results = await readJestResults(testResultFsPath);
      if (results) {
        this.applyResults(run, results);
        appendTestResultsOutput(run, results, this.testItemLookup);
      } else if (sourceItem) {
        run.errored(sourceItem, new vscode.TestMessage(nls.localize('no_test_results_produced_message')));
        appendLine(run, nls.localize('no_test_results_produced_message'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (sourceItem) {
        run.errored(sourceItem, new vscode.TestMessage(message));
      } else {
        console.error('LWC test run failed:', error);
      }
    }
  };

  /** Contract used by the output module to resolve TestItems for a Jest result. */
  private readonly testItemLookup: TestItemLookup = {
    findFileItem: testUri =>
      this.fileItems.get(createFileId(this.resolveDiscoveryUri(URI.file(normalizeJestFsPath(testUri.fsPath))))),
    findCaseItem: (testUri, title, ancestorTitles) =>
      this.caseItems.get(
        createCaseId(this.resolveDiscoveryUri(URI.file(normalizeJestFsPath(testUri.fsPath))), title, ancestorTitles)
      )
  };

  /** Walk the Jest JSON output and attribute results to matching TestItems. */
  private applyResults = (run: vscode.TestRun, results: LwcJestTestResults): void => {
    for (const fileResult of results.testResults) {
      // Strip /private prefix on macOS so URI matches findFiles (symlink, not realpath), then reconcile any
      // remaining short/long (8.3) path divergence back to the discovery URI that keys the items.
      const testUri = this.resolveDiscoveryUri(URI.file(normalizeJestFsPath(fileResult.name)));
      const fileItem = this.fileItems.get(createFileId(testUri));
      for (const assertion of fileResult.assertionResults) {
        const id = createCaseId(testUri, assertion.title, assertion.ancestorTitles);
        const caseItem = this.caseItems.get(id);
        if (!caseItem) {
          continue;
        }
        const status = jestStatusToStatus(assertion.status);
        if (status === 'passed') {
          run.passed(caseItem);
        } else if (status === 'failed') {
          const message = new vscode.TestMessage(
            assertion.failureMessages?.join('\n') ?? nls.localize('lwc_test_failed_message')
          );
          if (caseItem.uri && assertion.location) {
            message.location = new vscode.Location(
              caseItem.uri,
              new vscode.Position(Math.max(0, assertion.location.line - 1), Math.max(0, assertion.location.column - 1))
            );
          }
          run.failed(caseItem, message);
        } else {
          run.skipped(caseItem);
        }
      }
      if (fileItem) {
        if (fileResult.status === 'passed') {
          run.passed(fileItem);
        } else if (fileResult.status === 'failed') {
          run.failed(
            fileItem,
            new vscode.TestMessage(nls.localize('lwc_one_or_more_tests_failed_in_this_file_message'))
          );
        }
      }
    }
  };
}

const awaitTaskEnd = (sfTask: SfTask, token: vscode.CancellationToken): Promise<void> =>
  new Promise<void>(resolve => {
    const endDisposable = sfTask.onDidEnd(() => {
      endDisposable.dispose();
      cancelDisposable.dispose();
      resolve();
    });
    const cancelDisposable = token.onCancellationRequested(() => {
      sfTask.terminate();
    });
  });

/**
 * Waits for the jest test-result file to appear on disk, signaling the debug run has finished writing output.
 * Jest debug runs don't emit task end events, so we poll the file system with vscode.workspace.fs.
 */
const waitForResultFile = async (filePath: string, token: vscode.CancellationToken): Promise<void> => {
  const uri = URI.file(filePath);
  for (let attempt = 0; attempt < 600; attempt++) {
    if (token.isCancellationRequested) {
      return;
    }
    try {
      await vscode.workspace.fs.stat(uri);
      return;
    } catch {
      await delay(500);
    }
  }
  void vscode.window.showWarningMessage(nls.localize('lwc_test_result_file_timeout_message'));
};

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const readJestResultsFile = Effect.fn('readJestResultsFile')(function* (filePath: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.FsService.readFile(filePath).pipe(
    Effect.tapError(error => Effect.logDebug('Failed to read LWC test results JSON:', error))
  );
});

const readJestResults = async (filePath: string): Promise<LwcJestTestResults | undefined> => {
  try {
    const text = await getRuntime().runPromise(readJestResultsFile(filePath));
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return JSON.parse(text) as LwcJestTestResults;
  } catch (error) {
    console.debug('Failed to read LWC test results JSON:', error);
    return undefined;
  }
};

const jestStatusToStatus = (status: string): TestResultStatus => {
  if (status === 'passed') {
    return 'passed';
  }
  if (status === 'failed') {
    return 'failed';
  }
  return 'skipped';
};

let instance: LwcTestController | undefined;

export const getLwcTestController = (): LwcTestController => {
  instance ??= new LwcTestController();
  return instance;
};

// Exposed for test isolation: allows tests to reset the singleton between test cases
export const disposeLwcTestController = (): void => {
  if (instance) {
    instance.dispose();
    instance = undefined;
  }
};

export const registerLwcTestController = (extensionContext: vscode.ExtensionContext): void => {
  const controller = getLwcTestController();
  extensionContext.subscriptions.push({ dispose: () => disposeLwcTestController() });
  void controller.refresh();
};
