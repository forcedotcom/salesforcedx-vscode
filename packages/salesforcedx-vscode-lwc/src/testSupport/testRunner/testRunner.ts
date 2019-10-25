import { escapeStrForRegex } from 'jest-regex-util';
import * as path from 'path';
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { TestExecutionInfo, TestInfoKind } from '../types';
import { getLwcTestRunnerExecutable } from './index';
import { taskService } from './taskService';
import { TestResultsWatcher } from './testResultsWatcher';

export const enum TestRunType {
  RUN = 'run',
  DEBUG = 'debug',
  WATCH = 'watch'
}

/**
 * Returns relative path for Jest runTestsByPath on Windows
 * or absolute path on other systems
 * @param cwd
 * @param testFsPath
 */
export function normalizeRunTestsByPath(cwd: string, testFsPath: string) {
  if (/^win32/.test(process.platform)) {
    return path.relative(cwd, testFsPath);
  }
  return testFsPath;
}

type JestExecutionInfo = {
  jestArgs: string[];
  jestOutputFilePath: string;
};

export class TestRunner implements vscode.Disposable {
  private testExecutionInfo: TestExecutionInfo;
  private testRunType: TestRunType;
  private testRunId: string;
  private testResultWatcher?: TestResultsWatcher;
  constructor(testExecutionInfo: TestExecutionInfo, testRunType: TestRunType) {
    this.testRunId = uuid.v4();
    this.testExecutionInfo = testExecutionInfo;
    this.testRunType = testRunType;
  }

  public getJestExecutionInfo(): JestExecutionInfo | undefined {
    const { testRunId, testRunType, testExecutionInfo } = this;
    const testName =
      'testName' in testExecutionInfo ? testExecutionInfo.testName : undefined;
    const { kind, testUri } = testExecutionInfo;
    const { fsPath: testFsPath } = testUri;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
    if (workspaceFolder) {
      const tempFolder = TestResultsWatcher.getTempFolder(testExecutionInfo);
      if (tempFolder) {
        const testResultFileName = `test-result-${testRunId}.json`;
        const outputFilePath = path.join(tempFolder, testResultFileName);
        // Specify --runTestsByPath if running test on individual files
        let runTestsByPathArgs: string[];
        if (
          kind === TestInfoKind.TEST_FILE ||
          kind === TestInfoKind.TEST_CASE
        ) {
          const workspaceFolderFsPath = workspaceFolder.uri.fsPath;
          runTestsByPathArgs = [
            '--runTestsByPath',
            normalizeRunTestsByPath(workspaceFolderFsPath, testFsPath)
          ];
        } else {
          runTestsByPathArgs = [];
        }
        const testNamePatternArgs = testName
          ? ['--testNamePattern', `"${escapeStrForRegex(testName)}"`]
          : [];

        let runModeArgs: string[];
        if (testRunType === TestRunType.WATCH) {
          runModeArgs = ['--watch'];
        } else {
          runModeArgs = [];
        }
        const args = [
          ...runModeArgs,
          '--json',
          '--outputFile',
          outputFilePath,
          '--testLocationInResults',
          ...runTestsByPathArgs,
          ...testNamePatternArgs
        ];
        return {
          jestArgs: args,
          jestOutputFilePath: outputFilePath
        };
      }
    }
  }

  public getShellExecutionInfo() {
    const jestExecutionInfo = this.getJestExecutionInfo();
    if (jestExecutionInfo) {
      const { jestArgs, jestOutputFilePath } = jestExecutionInfo;
      const { testUri } = this.testExecutionInfo;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
      if (workspaceFolder) {
        const cwd = workspaceFolder.uri.fsPath;
        const lwcTestRunnerExcutable = getLwcTestRunnerExecutable(cwd);
        let cliArgs: string[];
        if (this.testRunType === TestRunType.DEBUG) {
          cliArgs = ['--debug', '--', ...jestArgs];
        } else {
          cliArgs = ['--', ...jestArgs];
        }
        if (lwcTestRunnerExcutable) {
          return {
            workspaceFolder,
            command: lwcTestRunnerExcutable,
            args: cliArgs,
            testResultFsPath: jestOutputFilePath
          };
        }
      }
    }
  }

  public startWatchingTestResults(testResultFsPath: string) {
    this.testResultWatcher = new TestResultsWatcher(testResultFsPath);
    this.testResultWatcher.watchTestResults();
  }

  private getTaskName() {
    // Only run and watch uses tasks for execution
    switch (this.testRunType) {
      case TestRunType.RUN:
        return nls.localize('run_test_task_name');
      case TestRunType.WATCH:
        return nls.localize('watch_test_task_name');
      default:
        return nls.localize('default_task_name');
    }
  }

  public async executeAsSfdxTask() {
    const shellExecutionInfo = this.getShellExecutionInfo();
    if (shellExecutionInfo) {
      const {
        command,
        args,
        workspaceFolder,
        testResultFsPath
      } = shellExecutionInfo;
      this.startWatchingTestResults(testResultFsPath);
      const taskName = this.getTaskName();
      const sfdxTask = taskService.createTask(
        this.testRunId,
        taskName,
        workspaceFolder,
        command,
        args
      );
      sfdxTask.onDidEnd(() => {
        // Dispose the watcher after a timeout since on task process end,
        // test file creations event might not been notified
        // to the test result watcher.
        setTimeout(() => {
          this.dispose();
        }, 5000);
      });
      return sfdxTask.execute();
    }
  }

  public dispose() {
    if (this.testResultWatcher) {
      this.testResultWatcher.dispose();
    }
  }
}
