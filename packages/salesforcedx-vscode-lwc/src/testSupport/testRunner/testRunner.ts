/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { escapeStrForRegex } from 'jest-regex-util';
import * as path from 'path';
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';
import { TestExecutionInfo, TestInfoKind } from '../types';
import {
  getLwcTestRunnerExecutable,
  getWorkspaceFolderFromTestUri
} from './index';
import { taskService } from './taskService';
import { testResultsWatcher } from './testResultsWatcher';

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

export class TestRunner {
  private testExecutionInfo: TestExecutionInfo;
  private testRunType: TestRunType;
  private testRunId: string;
  private logName?: string;
  /**
   * Create a test runner.
   * @param testExecutionInfo Test Execution information
   * @param testRunType Run, Watch or Debug
   * @param logName Telemetry log name. If specified we will send command telemetry event when task finishes
   */
  constructor(
    testExecutionInfo: TestExecutionInfo,
    testRunType: TestRunType,
    logName?: string
  ) {
    this.testRunId = uuid.v4();
    this.testExecutionInfo = testExecutionInfo;
    this.testRunType = testRunType;
    this.logName = logName;
  }

  public getJestExecutionInfo(
    workspaceFolder: vscode.WorkspaceFolder
  ): JestExecutionInfo | undefined {
    const { testRunId, testRunType, testExecutionInfo } = this;
    const testName =
      'testName' in testExecutionInfo ? testExecutionInfo.testName : undefined;
    const { kind, testUri } = testExecutionInfo;
    const { fsPath: testFsPath } = testUri;
    const tempFolder = testResultsWatcher.getTempFolder(
      workspaceFolder,
      testExecutionInfo
    );

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

  public getShellExecutionInfo() {
    const workspaceFolder = getWorkspaceFolderFromTestUri(
      this.testExecutionInfo.testUri
    );
    if (workspaceFolder) {
      const jestExecutionInfo = this.getJestExecutionInfo(workspaceFolder);
      if (jestExecutionInfo) {
        const { jestArgs, jestOutputFilePath } = jestExecutionInfo;
        const cwd = workspaceFolder.uri.fsPath;
        const lwcTestRunnerExecutable = getLwcTestRunnerExecutable(cwd);
        let cliArgs: string[];
        if (this.testRunType === TestRunType.DEBUG) {
          cliArgs = ['--debug', '--', ...jestArgs];
        } else {
          cliArgs = ['--', ...jestArgs];
        }
        if (lwcTestRunnerExecutable) {
          return {
            workspaceFolder,
            command: lwcTestRunnerExecutable,
            args: cliArgs,
            testResultFsPath: jestOutputFilePath
          };
        }
      }
    }
  }

  public startWatchingTestResults(testResultFsPath: string) {
    testResultsWatcher.watchTestResults(testResultFsPath);
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
      if (this.logName) {
        const startTime = process.hrtime();
        sfdxTask.onDidEnd(() => {
          telemetryService.sendCommandEvent(this.logName, startTime).catch();
        });
      }
      return sfdxTask.execute();
    }
  }
}
