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
import { nls } from '../messages';
<<<<<<< HEAD
=======
// import { ApexTestOutlineProvider } from './testOutlineProvider';

>>>>>>> 0b191077e2eeff8dfc521ac238f19337a0bc3050
const ForceApexTestRunCodeActionExecutor = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports.ForceApexTestRunCodeActionExecutor;

export class ReadableApexTestRunExecutor extends (ForceApexTestRunCodeActionExecutor as {
  new (test: string, shouldGetCodeCoverage: boolean): any;
}) {
  private outputToJson: string;
<<<<<<< HEAD
=======
  // private apexTestOutline: ApexTestOutlineProvider;
>>>>>>> 0b191077e2eeff8dfc521ac238f19337a0bc3050

  public constructor(
    tests: string[],
    shouldGetCodeCoverage: boolean,
    outputToJson: string
<<<<<<< HEAD
  ) {
    super(tests.join(','), shouldGetCodeCoverage);
    this.outputToJson = outputToJson;
=======
    // apexTestOutline: ApexTestOutlineProvider
  ) {
    super(tests.join(','), shouldGetCodeCoverage);
    this.outputToJson = outputToJson;
    // this.apexTestOutline = apexTestOutline;
>>>>>>> 0b191077e2eeff8dfc521ac238f19337a0bc3050
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
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    super.attachExecution(
      execution,
      cancellationTokenSource,
      cancellationToken
    );
  }
}
