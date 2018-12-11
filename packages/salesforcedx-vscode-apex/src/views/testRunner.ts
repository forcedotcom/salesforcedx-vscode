// /*
//  * Copyright (c) 2017, salesforce.com, inc.
//  * All rights reserved.
//  * Licensed under the BSD 3-Clause license.
//  * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
//  */
import { TestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/';
import * as events from 'events';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { ReadableApexTestRunExecutor } from './readableApexTestRunExecutor';
import {
  ApexTestNode,
  ApexTestOutlineProvider,
  TestNode
} from './testOutlineProvider';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;

const EmptyParametersGatherer = sfdxCoreExports.EmptyParametersGatherer;
const SfdxCommandlet = sfdxCoreExports.SfdxCommandlet;
const SfdxWorkspaceChecker = sfdxCoreExports.SfdxWorkspaceChecker;
const channelService = sfdxCoreExports.channelService;
export class ApexTestRunner {
  private testOutline: ApexTestOutlineProvider;
  private eventsEmitter = new events.EventEmitter();
  constructor(testOutline: ApexTestOutlineProvider) {
    this.testOutline = testOutline;
    this.eventsEmitter.on('sfdx:update_selection', this.updateSelection);
  }

  public async showErrorMessage(test: TestNode) {
    let position: vscode.Range | number = test.location!.range;
    if (test instanceof ApexTestNode) {
      const errorMessage = test.errorMessage;
      if (errorMessage && errorMessage !== '') {
        const stackTrace = test.stackTrace;
        position =
          parseInt(
            stackTrace.substring(
              stackTrace.indexOf('line') + 4,
              stackTrace.indexOf(',')
            ),
            10
          ) - 1; // Remove one because vscode location is zero based
        channelService.appendLine('-----------------------------------------');
        channelService.appendLine(stackTrace);
        channelService.appendLine(errorMessage);
        channelService.appendLine('-----------------------------------------');
        channelService.showChannelOutput();
      }
    }
    if (test.location) {
      vscode.window.showTextDocument(test.location.uri).then(() => {
        this.eventsEmitter.emit('sfdx:update_selection', position);
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
        const startPos = new vscode.Position(
          line.lineNumber,
          line.firstNonWhitespaceCharacterIndex
        );
        editor.selection = new vscode.Selection(startPos, line.range.end);
        editor.revealRange(line.range); // Show selection
      }
    }
  }

  public getTempFolder(): string {
    if (vscode.workspace && vscode.workspace.workspaceFolders) {
      const apexDir = new TestRunner().getTempFolder(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'apex'
      );
      return apexDir;
    } else {
      throw new Error(nls.localize('cannot_determine_workspace'));
    }
  }

  public async runTestOrTestClass(test: TestNode) {
    const tmpFolder = this.getTempFolder();
    const builder = new ReadableApexTestRunExecutor(
      [test.name],
      false,
      tmpFolder
    );
    const commandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      new EmptyParametersGatherer(),
      builder
    );
    await commandlet.run();
  }

  public async runApexTests(): Promise<void> {
    const tmpFolder = this.getTempFolder();
    const builder = new ReadableApexTestRunExecutor(
      Array.from(this.testOutline.testStrings.values()),
      false,
      tmpFolder
    );
    const commandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      new EmptyParametersGatherer(),
      builder
    );
    await commandlet.run();
  }
}
