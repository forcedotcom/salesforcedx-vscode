/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class TestsSelector implements ParametersGatherer<vscode.QuickPickItem> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<vscode.QuickPickItem>
  > {
    const files = await vscode.workspace.findFiles('**/*.testSuite-meta.xml');
    const fileItems = files.map(file => {
      return {
        label: path
          .basename(file.toString())
          .replace('.testSuite-meta.xml', ''),
        description: file.fsPath
      };
    });

    fileItems.push({
      label: nls.localize('force_apex_test_run_all_test_label'),
      description: nls.localize('force_apex_test_run_all_tests_desription_text')
    });

    const selection = await vscode.window.showQuickPick(fileItems);
    return selection
      ? { type: 'CONTINUE', data: selection }
      : { type: 'CANCEL' };
  }
}

class ForceApexTestRunExecutor extends SfdxCommandletExecutor<
  vscode.QuickPickItem
> {
  public build(data: vscode.QuickPickItem): Command {
    if (data.label === nls.localize('force_apex_test_run_all_test_label')) {
      return new SfdxCommandBuilder()
        .withDescription(nls.localize('force_apex_test_run_text'))
        .withArg('force:apex:test:run')
        .withFlag('--resultformat', 'human')
        .build();
    } else {
      return new SfdxCommandBuilder()
        .withDescription(nls.localize('force_apex_test_run_text'))
        .withArg('force:apex:test:run')
        .withFlag('--suitenames', `${data.label}`)
        .withFlag('--resultformat', 'human')
        .build();
    }
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new TestsSelector();

export function forceApexTestRun() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceApexTestRunExecutor()
  );
  commandlet.run();
}
