/*
 * Copyright (c) 2025, salesforce.com, inc.
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
import * as events from 'node:events';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { ApexLibraryTestRunExecutor } from '../commands';
import { nls } from '../messages';
import * as settings from '../settings';
import { apexTestRunCacheService } from '../testRunCache';
import { getLanguageClientStatus } from '../utils/testUtils';
import { ApexTestGroupNode, ApexTestNode, ApexTestOutlineProvider, TestNode } from './testOutlineProvider';

export enum TestRunType {
  All,
  Class,
  Method
}

export class ApexTestRunner {
  private testOutline: ApexTestOutlineProvider;
  private eventsEmitter: events.EventEmitter;
  constructor(testOutline: ApexTestOutlineProvider, eventsEmitter?: events.EventEmitter) {
    this.testOutline = testOutline;
    this.eventsEmitter = eventsEmitter ?? new events.EventEmitter();
    this.eventsEmitter.on('sf:update_selection', this.updateSelection);
  }

  public showErrorMessage(test: TestNode) {
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
      // Use the location's range directly for navigation
      const location = testNode.location;
      console.debug(
        `Navigating to ${location.uri.toString()} at ${location.range.start.line}:${location.range.start.character}`
      );
      vscode.window
        .showTextDocument(location.uri, {
          selection: location.range,
          preserveFocus: false
        })
        .then(() => {
          // Also emit the selection event for compatibility
          this.eventsEmitter.emit('sf:update_selection', position);
        });
    }
  }

  public updateSelection(index: vscode.Range | number) {
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
  }

  public async getTempFolder(): Promise<string> {
    if (vscode.workspace?.workspaceFolders) {
      const apexDir = await getTestResultsFolder(vscode.workspace.workspaceFolders[0].uri.fsPath, 'apex');
      return apexDir;
    } else {
      throw new Error(nls.localize('cannot_determine_workspace'));
    }
  }

  public async runAllApexTests(): Promise<void> {
    // Refresh only if the cache is empty (e.g., first run after activation)
    if (this.testOutline.testStrings.size === 0) {
      await this.testOutline.refresh();
    }
    const tests = Array.from(this.testOutline.testStrings.values());
    await this.runApexTests(tests, TestRunType.All);
  }

  public async runApexTests(tests: string[], testRunType: TestRunType) {
    // Only gate on Language Server when using LS discovery; API discovery should not be blocked by LS status
    const discoverySource = vscode.workspace
      .getConfiguration('salesforcedx-vscode-apex-testing')
      .get<'ls' | 'api'>('discoverySource', 'ls');
    if (discoverySource === 'ls') {
      const languageClientStatus = await getLanguageClientStatus();
      if (!languageClientStatus.isReady()) {
        if (languageClientStatus.failedToInitialize()) {
          vscode.window.showErrorMessage(languageClientStatus.getStatusMessage());
          return [];
        }
      }
    }

    const tmpFolder = await this.getTempFolder();
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
  }
}
