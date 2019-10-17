/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/';
import { PreconditionChecker } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import { escapeStrForRegex } from 'jest-regex-util';
import * as path from 'path';
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { TestExecutionInfo, TestType } from '../types';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const notificationService = sfdxCoreExports.notificationService;
const telemetryService = sfdxCoreExports.telemetryService;

/**
 * Get the absolute path to LWC Test runner executable, installed in an SFDX project.
 * @param sfdxProjectPath path to the root directory of an SFDX Project
 * @returns path to lwc test runner
 */
export function getLwcTestRunnerExecutable(sfdxProjectPath: string) {
  const lwcTestRunnerExecutable = path.join(
    sfdxProjectPath,
    'node_modules',
    '.bin',
    'lwc-jest'
  );
  if (fs.existsSync(lwcTestRunnerExecutable)) {
    return lwcTestRunnerExecutable;
  } else {
    const errorMessage = nls.localize('no_lwc_jest_found_text');
    notificationService.showErrorMessage(errorMessage);
    telemetryService.sendException('lwc_test_no_lwc_jest_found', errorMessage);
  }
}

export class SfdxWorkspaceLwcTestRunnerInstallationChecker
  implements PreconditionChecker {
  public check(): boolean {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const sfdxProjectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const lwcTestRunnerExecutable = getLwcTestRunnerExecutable(
        sfdxProjectPath
      );
      return !!lwcTestRunnerExecutable;
    }
    return false;
  }
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

export function getJestArgs(testExecutionInfo: TestExecutionInfo) {
  if (testExecutionInfo.testType === TestType.LWC) {
  }
  const { testUri, testName } = testExecutionInfo;
  const { fsPath: testFsPath } = testUri;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
  if (workspaceFolder) {
    const workspaceFolderFsPath = workspaceFolder.uri.fsPath;
    const tempFolder = getTempFolder(testExecutionInfo);
    if (tempFolder) {
      const testRunId = uuid.v4();
      const outputFilePath = path.join(
        tempFolder,
        `test-result-${testRunId}.json`
      );
      startWatchingTestResults(tempFolder);
      const args = [
        '--',
        '--json',
        '--outputFile',
        outputFilePath,
        '--testLocationInResults', // TODO: do we need testLocationInResults?
        '--runTestsByPath',
        normalizeRunTestsByPath(workspaceFolderFsPath, testFsPath),
        '--testNamePattern',
        `"${escapeStrForRegex(testName)}"`
      ];
      return args;
    }
  }
  return [];
}

export function startWatchingTestResults(testResultsFolderPath: string) {
  const testResultsGlobPattern = path.join(testResultsFolderPath, '*.json');
  const testResultsWatcher = vscode.workspace.createFileSystemWatcher(
    testResultsGlobPattern
  );

  testResultsWatcher.onDidCreate(testResultsUri => {
    try {
      const { fsPath: testResultsFsPath } = testResultsUri;
      const testResultsJSON = fs.readFileSync(testResultsFsPath, {
        encoding: 'utf8'
      });
    } catch (error) {
      console.error(error);
    }

    testResultsWatcher.dispose();
  });

  testResultsWatcher.onDidChange(testResultsUri => {});
}

export function getTempFolder(testExecutionInfo: TestExecutionInfo) {
  const { testUri, testType } = testExecutionInfo;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
  if (workspaceFolder) {
    const workspaceFsPath = workspaceFolder.uri.fsPath;
    return new TestRunner().getTempFolder(workspaceFsPath, testType);
  } else {
    const errorMessage = nls.localize(
      'no_workspace_folder_found_for_test_text'
    );
    notificationService.showErrorMessage(errorMessage);
    telemetryService.sendException(
      'lwc_test_no_workspace_folder_found_for_test',
      errorMessage
    );
  }
}
