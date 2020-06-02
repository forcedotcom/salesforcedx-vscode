/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CliCommandExecutor,
  Command
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { ForceApexTestRunCodeActionExecutor } from '../commands';
import { nls } from '../messages';

export class ReadableApexTestRunExecutor extends (ForceApexTestRunCodeActionExecutor as {
  new (test: string, shouldGetCodeCoverage: boolean): any;
}) {
  private outputToJson: string;

  public constructor(
    tests: string[],
    shouldGetCodeCoverage: boolean,
    outputToJson: string
  ) {
    super(tests.join(','), shouldGetCodeCoverage);
    this.outputToJson = outputToJson;
  }

  public build(data: {}): Command {
    this.builder = this.builder
      .withDescription(nls.localize('force_apex_test_run_description_text'))
      .withArg('force:apex:test:run')
      .withFlag('--tests', this.test)
      .withFlag('--resultformat', 'human')
      .withFlag('--outputdir', this.outputToJson)
      .withFlag('--loglevel', 'error');

    if (this.shouldGetCodeCoverage) {
      this.builder = this.builder.withArg('--codecoverage');
    }
    return this.builder.build();
  }

  public execute(response: ContinueResponse<{}>) {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.workspaceFolders![0].uri.fsPath
    }).execute(cancellationToken);

    super.attachExecution(
      execution,
      cancellationTokenSource,
      cancellationToken
    );
  }
}
