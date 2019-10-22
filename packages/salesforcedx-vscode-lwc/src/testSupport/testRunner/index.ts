/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { PreconditionChecker } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import { escapeStrForRegex } from 'jest-regex-util';
import * as path from 'path';
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { TestExecutionInfo, TestInfoKind } from '../types';
import { getTempFolder, startWatchingTestResults } from './testResultsWatcher';

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
  const testName =
    'testName' in testExecutionInfo ? testExecutionInfo.testName : undefined;
  const { kind, testUri } = testExecutionInfo;
  const { fsPath: testFsPath } = testUri;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
  if (workspaceFolder) {
    const tempFolder = getTempFolder(testExecutionInfo);
    if (tempFolder) {
      const testRunId = uuid.v4();
      const testResultFileName = `test-result-${testRunId}.json`;
      const outputFilePath = path.join(tempFolder, testResultFileName);

      // TODO - refactor, rename getJestArgs or handle watching elsewhere
      startWatchingTestResults(tempFolder, testResultFileName);

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
      const args = [
        '--',
        '--json',
        '--outputFile',
        outputFilePath,
        '--testLocationInResults', // TODO: do we need testLocationInResults?
        ...runTestsByPathArgs,
        ...testNamePatternArgs
      ];
      return args;
    }
  }
  return [];
}
