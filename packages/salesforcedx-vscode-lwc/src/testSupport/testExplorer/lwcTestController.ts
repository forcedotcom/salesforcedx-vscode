/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFile } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../../messages';
import { lwcTestIndexer } from '../testIndexer';
import { taskService, SfTask } from '../testRunner/taskService';
import { TestRunner, TestRunType } from '../testRunner/testRunner';
import {
  LwcJestTestResults,
  TestCaseInfo,
  TestDirectoryInfo,
  TestExecutionInfo,
  TestFileInfo,
  TestInfoKind,
  TestResultStatus,
  TestType
} from '../types';
import { workspace } from '../workspace';
import { appendLine, appendRunHeader, appendTestResultsOutput, TestItemLookup } from './testResultsOutput';

const TEST_CONTROLLER_ID = 'sf.lwc.testController';

const TEST_FILE_EXT = '.test.js';

type ItemKind = 'file' | 'case';

const getFileLabel = (testUri: URI): string => {
  const base = Utils.basename(testUri);
  return base.endsWith(TEST_FILE_EXT) ? base.slice(0, -TEST_FILE_EXT.length) : base;
};

const createFileId = (testUri: URI): string => `file:${testUri.toString()}`;

const createCaseId = (testUri: URI, testName: string, ancestorTitles: string[] | undefined): string => {
  const suffix = ancestorTitles && ancestorTitles.length > 0 ? `${ancestorTitles.join(' > ')} > ${testName}` : testName;
  return `case:${testUri.toString()}::${suffix}`;
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
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.controller = vscode.tests.createTestController(TEST_CONTROLLER_ID, nls.localize('lwc_test_controller_label'));
    this.setupProfiles();
    this.setupResolveHandler();
    this.setupRefreshHandler();
    this.setupIndexerListeners();
  }

  public getController = (): vscode.TestController => this.controller;

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

  private setupProfiles = (): void => {
    this.controller.createRunProfile(
      nls.localize('lwc_test_run_profile_title'),
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTests(request, token, false),
      true
    );
    this.controller.createRunProfile(
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
        // Out-of-band jest results (e.g. watch mode) drive a tree refresh via onDidUpdateTestIndex above;
        // inline run/debug results are written by runTests via the current TestRun.
      })
    );
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
    this.fileItems.set(id, item);
    return item;
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

  private gatherTargets = async (
    request: vscode.TestRunRequest
  ): Promise<{ item: vscode.TestItem; exec: TestExecutionInfo }[]> => {
    const rootItems = request.include && request.include.length > 0 ? [...request.include] : this.topLevelItems();
    const excluded = new Set((request.exclude ?? []).map(item => item.id));
    const result: { item: vscode.TestItem; exec: TestExecutionInfo }[] = [];
    for (const item of rootItems) {
      if (excluded.has(item.id)) {
        continue;
      }
      const exec = await this.toTestExecutionInfo(item);
      if (exec) {
        result.push({ item, exec });
      }
    }
    return result;
  };

  private toTestExecutionInfo = async (item: vscode.TestItem): Promise<TestExecutionInfo | undefined> => {
    const kind = getItemKind(item.id);
    if (!item.uri) {
      return undefined;
    }
    const testUri = URI.revive(item.uri);
    if (kind === 'file') {
      const info: TestFileInfo = {
        kind: TestInfoKind.TEST_FILE,
        testType: TestType.LWC,
        testUri
      };
      return info;
    }
    if (kind === 'case') {
      const info: TestCaseInfo = {
        kind: TestInfoKind.TEST_CASE,
        testType: TestType.LWC,
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
      kind: TestInfoKind.TEST_DIRECTORY,
      testType: TestType.LWC,
      testUri: workspaceFolder.uri
    };
  };

  private runTests = async (
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
    isDebug: boolean
  ): Promise<void> => {
    const run = this.controller.createTestRun(request);
    try {
      const targets = await this.gatherTargets(request);
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
        await this.executeOne(run, target.exec, target.item, isDebug, token);
      }
    } finally {
      run.end();
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
    const testRunner = new TestRunner(exec, isDebug ? TestRunType.DEBUG : TestRunType.RUN);
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
    findFileItem: testUri => this.fileItems.get(createFileId(testUri)),
    findCaseItem: (testUri, title, ancestorTitles) =>
      this.caseItems.get(createCaseId(testUri, title, ancestorTitles))
  };

  /** Walk the Jest JSON output and attribute results to matching TestItems. */
  private applyResults = (run: vscode.TestRun, results: LwcJestTestResults): void => {
    for (const fileResult of results.testResults) {
      const testUri = URI.file(fileResult.name);
      const fileId = createFileId(testUri);
      const fileItem = this.fileItems.get(fileId);
      for (const assertion of fileResult.assertionResults) {
        const id = createCaseId(testUri, assertion.title, assertion.ancestorTitles);
        const caseItem = this.caseItems.get(id);
        if (!caseItem) {
          continue;
        }
        const status = jestStatusToStatus(assertion.status);
        if (status === TestResultStatus.PASSED) {
          run.passed(caseItem);
        } else if (status === TestResultStatus.FAILED) {
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
};

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const readJestResults = async (filePath: string): Promise<LwcJestTestResults | undefined> => {
  try {
    const text = await readFile(filePath);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return JSON.parse(text) as LwcJestTestResults;
  } catch (error) {
    console.debug('Failed to read LWC test results JSON:', error);
    return undefined;
  }
};

const jestStatusToStatus = (status: string): TestResultStatus => {
  if (status === 'passed') {
    return TestResultStatus.PASSED;
  }
  if (status === 'failed') {
    return TestResultStatus.FAILED;
  }
  return TestResultStatus.SKIPPED;
};

let instance: LwcTestController | undefined;

const getLwcTestController = (): LwcTestController => {
  instance ??= new LwcTestController();
  return instance;
};

const disposeLwcTestController = (): void => {
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
