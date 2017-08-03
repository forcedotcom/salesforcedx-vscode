/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';

export function forceApexTestRun(testClass?: string) {
  if (testClass) {
    runTestClass(testClass);
  } else {
    vscode.workspace.findFiles('**/*.testSuite-meta.xml', '').then(files => {
      const fileItems: vscode.QuickPickItem[] = files.map(file => {
        return {
          label: path
            .basename(file.toString())
            .replace('.testSuite-meta.xml', ''),
          description: file.fsPath
        };
      });

      fileItems.push({
        label: 'All tests',
        description: 'Runs all tests in the current workspace'
      });

      vscode.window.showQuickPick(fileItems).then(selection => {
        if (selection) {
          if (selection.label === 'All tests') {
            runAllTests();
          } else {
            runTestSuite(selection.label);
          }
        }
      });
    });
  }
}

function runTestClass(testClass: string) {
  const cancellationTokenSource = new vscode.CancellationTokenSource();
  const cancellationToken = cancellationTokenSource.token;
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_test_run_text'))
      .withArg('force:apex:test:run')
      .withFlag('--classnames', `${testClass}`)
      .withFlag('--resultformat', 'human')
      .build(),
    { cwd: vscode.workspace.rootPath }
  ).execute(cancellationToken);

  channelService.streamCommandOutput(execution);
  notificationService.reportCommandExecutionStatus(
    execution,
    cancellationToken
  );
  CancellableStatusBar.show(execution, cancellationTokenSource);
  taskViewService.addCommandExecution(execution, cancellationTokenSource);
}

function runAllTests() {
  const cancellationTokenSource = new vscode.CancellationTokenSource();
  const cancellationToken = cancellationTokenSource.token;
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_test_run_text'))
      .withArg('force:apex:test:run')
      .withFlag('--resultformat', 'human')
      .build(),
    { cwd: vscode.workspace.rootPath }
  ).execute(cancellationToken);

  channelService.streamCommandOutput(execution);
  notificationService.reportCommandExecutionStatus(
    execution,
    cancellationToken
  );
  CancellableStatusBar.show(execution, cancellationTokenSource);
  taskViewService.addCommandExecution(execution, cancellationTokenSource);
}

function runTestSuite(testSuiteName: string) {
  const cancellationTokenSource = new vscode.CancellationTokenSource();
  const cancellationToken = cancellationTokenSource.token;
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_test_run_text'))
      .withArg('force:apex:test:run')
      .withFlag('--suitenames', `${testSuiteName}`)
      .withFlag('--resultformat', 'human')
      .build(),
    { cwd: vscode.workspace.rootPath }
  ).execute(cancellationToken);

  channelService.streamCommandOutput(execution);
  notificationService.reportCommandExecutionStatus(
    execution,
    cancellationToken
  );
  CancellableStatusBar.show(execution, cancellationTokenSource);
  taskViewService.addCommandExecution(execution, cancellationTokenSource);
}
