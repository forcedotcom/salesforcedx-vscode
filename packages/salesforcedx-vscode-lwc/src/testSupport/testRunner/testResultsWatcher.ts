/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getTestResultsFolder, readFile } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { lwcTestIndexer } from '../testIndexer';
import { TestExecutionInfo } from '../types';

/**
 * Test result watcher to watch for creating/updating test results,
 * and update test indexer.
 */
class TestResultsWatcher implements vscode.Disposable {
  private fileSystemWatchers = new Map<string, vscode.FileSystemWatcher>();
  private disposables: vscode.Disposable[] = [];

  /**
   * Register test result watcher with extension context
   * @param extensionContext extension context
   */
  public register(extensionContext: vscode.ExtensionContext) {
    extensionContext.subscriptions.push(this);
  }

  /**
   * Determine the test result output folder. It should be under
   * .sfdx/tools/testresults/lwc of the workspace folder of the test
   * @param workspaceFolder workspace folder of the test
   * @param testExecutionInfo test execution info
   */
  public getTempFolder(workspaceFolder: vscode.WorkspaceFolder, testExecutionInfo: TestExecutionInfo) {
    const { testType } = testExecutionInfo;
    const workspaceFsPath = workspaceFolder.uri.fsPath;
    return getTestResultsFolder(workspaceFsPath, testType);
  }

  /**
   * Start file watchers for test results if needed.
   * The file watchers will read test result file and update test indexer.
   * @param outputFilePath Jest test results output path
   */
  public watchTestResults(outputFilePath: string) {
    const outputFileFolder = path.dirname(outputFilePath);
    let fileSystemWatcher = this.fileSystemWatchers.get(outputFileFolder);
    if (!fileSystemWatcher) {
      const outputFileExtname = path.extname(outputFilePath);
      const testResultsGlobPattern = path.join(outputFileFolder, `*${outputFileExtname}`).replace(/\\/g, '/');
      fileSystemWatcher = vscode.workspace.createFileSystemWatcher(testResultsGlobPattern);
      fileSystemWatcher.onDidCreate(async testResultsUri => {
        await this.updateTestResultsFromTestResultsJson(testResultsUri);
      });

      fileSystemWatcher.onDidChange(async testResultsUri => {
        await this.updateTestResultsFromTestResultsJson(testResultsUri);
      });
      this.fileSystemWatchers.set(outputFileFolder, fileSystemWatcher);
      this.disposables.push(fileSystemWatcher);
    }
  }

  private async updateTestResultsFromTestResultsJson(testResultsUri: URI) {
    try {
      const testResultsContent = await readFile(testResultsUri.fsPath);
      const testResults = JSON.parse(testResultsContent);
      lwcTestIndexer.updateTestResults(testResults);
    } catch (error) {
      console.error(error);
    }
  }

  public dispose() {
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
export const testResultsWatcher = new TestResultsWatcher();
