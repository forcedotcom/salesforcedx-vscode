/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  EmptyParametersGatherer,
  SfCommandlet,
  SfWorkspaceChecker,
  getTestResultsFolder
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { ApexLibraryTestRunExecutor } from '../commands';
import { languageClientManager } from '../languageUtils';
import { nls } from '../messages';
import * as settings from '../settings';
import { apexTestRunCacheService } from '../testRunCache';
import { ApexTestGroupNode, ApexTestNode, ApexTestOutlineProvider, TestNode } from './testOutlineProvider';

export enum TestRunType {
  All,
  Class,
  Method
}

export const runAllApexTests = async (testOutline: ApexTestOutlineProvider): Promise<void> =>
  runApexTests(Array.from(testOutline.getTestStrings()), TestRunType.All);

export const showErrorMessage = async (test: TestNode): Promise<void> => {
  // if it's a failing group, use the first failing test.  Otherwise, use the failing test itself
  const testNode =
    test instanceof ApexTestGroupNode && test.contextValue === 'apexTestGroup_Fail'
      ? (test.children.find(testCase => testCase.contextValue === 'apexTest_Fail') ?? test)
      : test;

  if (testNode instanceof ApexTestNode && testNode.errorInfo) {
    const stackTrace = testNode.errorInfo.stackTrace ?? '';
    channelService.appendLine('-----------------------------------------');
    channelService.appendLine(stackTrace);
    channelService.appendLine(testNode.errorInfo.message ?? '');
    channelService.appendLine('-----------------------------------------');
    channelService.showChannelOutput();
  }

  if (testNode.location) {
    const position =
      testNode instanceof ApexTestNode && testNode.errorInfo
        ? parseInt(
            testNode.errorInfo.stackTrace?.substring(
              testNode.errorInfo.stackTrace?.indexOf('line') + 4,
              testNode.errorInfo.stackTrace?.indexOf(',') ?? 0
            ) ?? '',
            10
          ) - 1
        : testNode.location.range;
    await vscode.window.showTextDocument(testNode.location.uri);
    await updateSelection(position);
  }
};

export const runApexTests = async (tests: string[], testRunType: TestRunType): Promise<void> => {
  const languageClientStatus = languageClientManager.getStatus();
  if (!languageClientStatus.isReady()) {
    if (languageClientStatus.failedToInitialize()) {
      vscode.window.showErrorMessage(languageClientStatus.getStatusMessage());
      return;
    }
  }

  const tmpFolder = await getTempFolder();
  const getCodeCoverage = settings.retrieveTestCodeCoverage();
  if (testRunType === TestRunType.Class) {
    await apexTestRunCacheService.setCachedClassTestParam(tests[0]);
  } else if (testRunType === TestRunType.Method) {
    await apexTestRunCacheService.setCachedMethodTestParam(tests[0]);
  }
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new EmptyParametersGatherer(),
    new ApexLibraryTestRunExecutor(tests, tmpFolder, getCodeCoverage)
  );
  await commandlet.run();
};

const getTempFolder = async (): Promise<string> => {
  if (vscode.workspace?.workspaceFolders) {
    const apexDir = await getTestResultsFolder(vscode.workspace.workspaceFolders[0].uri.fsPath, 'apex');
    return apexDir;
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }
};

const updateSelection = async (index: vscode.Range | number): Promise<void> => {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    if (index instanceof vscode.Range) {
      editor.selection = new vscode.Selection(index.start, index.end);
      editor.revealRange(index); // Show selection
    } else {
      const line = editor.document.lineAt(index);
      const startPos = new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex);
      editor.selection = new vscode.Selection(startPos, line.range.end);
      editor.revealRange(line.range); // Show selection
    }
  }
};
