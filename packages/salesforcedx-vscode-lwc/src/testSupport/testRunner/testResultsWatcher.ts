/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { lwcTestIndexer } from '../testIndexer';
import { TestExecutionInfo } from '../types';

export function getTempFolder(
  workspaceFolder: vscode.WorkspaceFolder,
  testExecutionInfo: TestExecutionInfo
) {
  const { testType } = testExecutionInfo;
  const workspaceFsPath = workspaceFolder.uri.fsPath;
  return new TestRunner().getTempFolder(workspaceFsPath, testType);
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
