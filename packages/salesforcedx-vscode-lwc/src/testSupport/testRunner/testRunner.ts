import { escapeStrForRegex } from 'jest-regex-util';
import * as path from 'path';
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import { TestExecutionInfo, TestInfoKind } from '../types';
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

export function getJestExecutionInfo(
  testRunId: string,
  testRunType: TestRunType,
  testExecutionInfo: TestExecutionInfo
): JestExecutionInfo | undefined {
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
      if (kind === TestInfoKind.TEST_FILE || kind === TestInfoKind.TEST_CASE) {
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
      if (testRunType === TestRunType.DEBUG) {
        runModeArgs = ['--debug'];
      } else if (testRunType === TestRunType.WATCH) {
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

import { getLwcTestRunnerExecutable } from './index';
import { taskService } from './taskService';
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

  public async execute() {
    const jestExecutionInfo = getJestExecutionInfo(
      this.testRunId,
      this.testRunType,
      this.testExecutionInfo
    );

    if (jestExecutionInfo) {
      const { jestArgs, jestOutputFilePath } = jestExecutionInfo;
      this.testResultWatcher = new TestResultsWatcher(jestOutputFilePath);
      this.testResultWatcher.watchTestResults();
      const { testUri } = this.testExecutionInfo;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
      if (workspaceFolder) {
        const cwd = workspaceFolder.uri.fsPath;

        const lwcTestRunnerExcutable = getLwcTestRunnerExecutable(cwd);
        const cliArgs = ['--', ...jestArgs];

        if (lwcTestRunnerExcutable) {
          const taskName = `${this.testRunType.charAt(0).toUpperCase() +
            this.testRunType.substring(1)} Test`; // TODO: nls
          const sfdxTask = taskService.createTask(
            this.testRunId,
            taskName,
            workspaceFolder,
            lwcTestRunnerExcutable,
            cliArgs
          );
          sfdxTask.onDidEnd(() => {
            // debugger;
            this.dispose();
          });
          return sfdxTask.execute();
        }
      }
    }
  }

  public dispose() {
    if (this.testResultWatcher) {
      this.testResultWatcher.dispose();
    }
  }
}
