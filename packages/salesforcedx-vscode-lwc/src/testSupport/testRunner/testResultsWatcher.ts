/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { LwcJestTestResults } from '../types';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getRuntime } from '../../services/runtime';
import { lwcTestIndexer } from '../testIndexer';

const updateTestResultsFromTestResultsJson = Effect.fn('updateTestResultsFromTestResultsJson')(function* (
  testResultsUri: URI
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const testResultsContent = yield* api.services.FsService.readFile(testResultsUri.fsPath);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns any; shape validated by updateTestResults
  const testResults: LwcJestTestResults = JSON.parse(testResultsContent);
  lwcTestIndexer.updateTestResults(testResults);
});

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
  public getTempFolder(workspaceFolder: vscode.WorkspaceFolder) {
    const folder = path.join(workspaceFolder.uri.fsPath, '.sfdx', 'tools', 'testresults', 'lwc');
    return getRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        yield* api.services.FsService.createDirectory(folder);
        return folder;
      })
    );
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
      const testResultsGlobPattern = path.join(outputFileFolder, `*${outputFileExtname}`).replaceAll('\\', '/');
      fileSystemWatcher = vscode.workspace.createFileSystemWatcher(testResultsGlobPattern);
      fileSystemWatcher.onDidCreate(testResultsUri => {
        void getRuntime().runPromise(updateTestResultsFromTestResultsJson(testResultsUri));
      });

      fileSystemWatcher.onDidChange(testResultsUri => {
        void getRuntime().runPromise(updateTestResultsFromTestResultsJson(testResultsUri));
      });
      this.fileSystemWatchers.set(outputFileFolder, fileSystemWatcher);
      this.disposables.push(fileSystemWatcher);
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
