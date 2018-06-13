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
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { SfdxCoreSettings } from '../settings/sfdxCoreSettings';
import {
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
        'force_apex_test_run_all_tests_description_text'
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

export class ForceApexTestRunCommandFactory {
  private _data: ApexTestQuickPickItem;
  private _getCodeCoverage: boolean;
  private builder: SfdxCommandBuilder = new SfdxCommandBuilder();
  private testRunExecutorCommand: Command;

  constructor(data: ApexTestQuickPickItem, getCodeCoverage: boolean) {
    this._data = data;
    this._getCodeCoverage = getCodeCoverage;
  }

  public constructExecutorCommand(): Command {
    this.builder = this.builder
      .withDescription(nls.localize('force_apex_test_run_text'))
      .withArg('force:apex:test:run');

    switch (this._data.type) {
      case TestType.Suite:
        this.builder = this.builder
          .withFlag('--suitenames', `${this._data.label}`);
        break;
      case TestType.Class:
        this.builder = this.builder
          .withFlag('--classnames', `${this._data.label}`)
          .withArg('--synchronous');
        break;
      default:
        break;
    }

    if (this._getCodeCoverage) {
      this.builder = this.builder
        .withArg('--codecoverage');
    }

    this.builder = this.builder
      .withFlag('--resultformat', 'human')
      .withFlag('--loglevel', 'error');

    this.testRunExecutorCommand = this.builder.build();
    return this.testRunExecutorCommand;
  }

}

export class ForceApexTestRunExecutor extends SfdxCommandletExecutor<
  ApexTestQuickPickItem
  > {
  public build(data: ApexTestQuickPickItem): Command {
    const getCodeCoverage: boolean = SfdxCoreSettings.getInstance()
      .getConfiguration().get('retrieve-test-code-coverage') as boolean;
    const factory: ForceApexTestRunCommandFactory = new ForceApexTestRunCommandFactory(data, getCodeCoverage);
    return factory.constructExecutorCommand();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new TestsSelector();

export async function forceApexTestRun() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceApexTestRunExecutor()
  );
  await commandlet.run();
}
