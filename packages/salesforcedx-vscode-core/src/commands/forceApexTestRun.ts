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
import * as fs from 'fs';
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

export enum TestType {
  All,
  Suite,
  Class
}

export interface ApexTestQuickPickItem extends vscode.QuickPickItem {
  type: TestType;
}

export class TestsSelector
  implements ParametersGatherer<ApexTestQuickPickItem> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexTestQuickPickItem>
  > {
    const testSuites = await vscode.workspace.findFiles(
      '**/*.testSuite-meta.xml'
    );
    const fileItems = testSuites.map(testSuite => {
      return {
        label: path
          .basename(testSuite.toString())
          .replace('.testSuite-meta.xml', ''),
        description: testSuite.fsPath,
        type: TestType.Suite
      };
    });

    const apexClasses = await vscode.workspace.findFiles('**/*.cls');
    apexClasses.forEach(apexClass => {
      const fileContent = fs.readFileSync(apexClass.fsPath).toString();
      if (fileContent && fileContent.toLowerCase().includes('@istest')) {
        fileItems.push({
          label: path.basename(apexClass.toString()).replace('.cls', ''),
          description: apexClass.fsPath,
          type: TestType.Class
        });
      }
    });

    fileItems.push({
      label: nls.localize('force_apex_test_run_all_test_label'),
      description: nls.localize(
        'force_apex_test_run_all_tests_desription_text'
      ),
      type: TestType.All
    });

    const selection = (await vscode.window.showQuickPick(
      fileItems
    )) as ApexTestQuickPickItem;
    return selection
      ? { type: 'CONTINUE', data: selection }
      : { type: 'CANCEL' };
  }
}

export class ForceApexTestRunExecutor extends SfdxCommandletExecutor<
  ApexTestQuickPickItem
> {
  public build(data: ApexTestQuickPickItem): Command {
    if (data.type === TestType.Suite) {
      return new SfdxCommandBuilder()
        .withDescription(nls.localize('force_apex_test_run_text'))
        .withArg('force:apex:test:run')
        .withFlag('--suitenames', `${data.label}`)
        .withFlag('--resultformat', 'human')
        .build();
    } else if (data.type === TestType.Class) {
      return new SfdxCommandBuilder()
        .withDescription(nls.localize('force_apex_test_run_text'))
        .withArg('force:apex:test:run')
        .withFlag('--classnames', `${data.label}`)
        .withFlag('--resultformat', 'human')
        .withArg('--synchronous')
        .build();
    } else {
      return new SfdxCommandBuilder()
        .withDescription(nls.localize('force_apex_test_run_text'))
        .withArg('force:apex:test:run')
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
