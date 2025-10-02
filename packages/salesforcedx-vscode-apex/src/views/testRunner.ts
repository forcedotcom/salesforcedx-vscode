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
  let testNode = test;
  let position: vscode.Range | number = test.location!.range;
  if (testNode instanceof ApexTestGroupNode) {
    if (test.contextValue === 'apexTestGroup_Fail') {
      const failedTest = test.children.find(testCase => testCase.contextValue === 'apexTest_Fail');
      if (failedTest) {
        testNode = failedTest;
      }
    }
  }
  if (testNode instanceof ApexTestNode) {
    const errorMessage = testNode.errorMessage;
    if (errorMessage && errorMessage !== '') {
      const stackTrace = testNode.stackTrace;
      position = parseInt(stackTrace.substring(stackTrace.indexOf('line') + 4, stackTrace.indexOf(',')), 10) - 1; // Remove one because vscode location is zero based
      channelService.appendLine('-----------------------------------------');
      channelService.appendLine(stackTrace);
      channelService.appendLine(errorMessage);
      channelService.appendLine('-----------------------------------------');
      channelService.showChannelOutput();
    }
  }

  if (testNode.location) {
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
