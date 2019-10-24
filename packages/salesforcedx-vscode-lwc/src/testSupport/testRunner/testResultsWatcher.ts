/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { lwcTestIndexer } from '../testIndexer';
import { TestExecutionInfo } from '../types';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const notificationService = sfdxCoreExports.notificationService;
const telemetryService = sfdxCoreExports.telemetryService;

export function startWatchingTestResults(
  testResultsFolderPath: string,
  testResultFileName: string
) {
  const testResultsGlobPattern = path
    .join(testResultsFolderPath, testResultFileName)
    .replace(/\\/g, '/');
  const testResultsWatcher = vscode.workspace.createFileSystemWatcher(
    testResultsGlobPattern
  );

  testResultsWatcher.onDidCreate(testResultsUri => {
    try {
      const { fsPath: testResultsFsPath } = testResultsUri;
      const testResultsJSON = fs.readFileSync(testResultsFsPath, {
        encoding: 'utf8'
      });
      const testResults = JSON.parse(testResultsJSON);
      lwcTestIndexer.updateTestResults(testResults);
    } catch (error) {
      console.error(error);
    }

    testResultsWatcher.dispose();
  });

  // TODO
  // testResultsWatcher.onDidChange(testResultsUri => {});
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

export class TestResultsWatcher implements vscode.Disposable {
  private outputFilePath: string;
  private fileSystemWatcher?: vscode.FileSystemWatcher;
  constructor(outputFilePath: string) {
    this.outputFilePath = outputFilePath;
  }

  public static getTempFolder = getTempFolder;

  public watchTestResults() {
    const testResultsGlobPattern = this.outputFilePath.replace(/\\/g, '/');
    this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
      testResultsGlobPattern
    );
    this.fileSystemWatcher.onDidCreate(testResultsUri => {
      this.updateTestResultsFromTestResultsJson(testResultsUri);
    });

    this.fileSystemWatcher.onDidChange(testResultsUri => {
      this.updateTestResultsFromTestResultsJson(testResultsUri);
    });
  }

  private updateTestResultsFromTestResultsJson(testResultsUri: vscode.Uri) {
    try {
      const { fsPath: testResultsFsPath } = testResultsUri;
      const testResultsJSON = fs.readFileSync(testResultsFsPath, {
        encoding: 'utf8'
      });
      const testResults = JSON.parse(testResultsJSON);
      lwcTestIndexer.updateTestResults(testResults);
    } catch (error) {
      console.error(error);
    }
  }

  public dispose() {
    if (this.fileSystemWatcher) {
      this.fileSystemWatcher.dispose();
    }
  }
}
