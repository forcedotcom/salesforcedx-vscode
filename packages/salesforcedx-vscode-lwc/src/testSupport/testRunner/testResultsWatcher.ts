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
