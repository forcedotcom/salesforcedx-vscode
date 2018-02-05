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
import { nls } from '../messages';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export class ForceApexTestRunCodeActionExecutor extends SfdxCommandletExecutor<{}> {
  private test: string;

  public constructor(test: string) {
    super();
    this.test = test || '';
  }

  public build(data: {}): Command {
    // inspect test value to determine description text
    const description = this.test.includes('.')
      ? 'force_apex_test_run_codeAction_testMethod_description_text'
      : 'force_apex_test_run_codeAction_all_tests_description_text';
    return new SfdxCommandBuilder()
      .withDescription(nls.localize(description, this.test))
      .withArg('force:apex:test:run')
      .withFlag('--tests', this.test)
      .withFlag('--resultformat', 'human')
      .withArg('--synchronous')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
export function forceApexTestRunCodeAction(test: string) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceApexTestRunCodeActionExecutor(test)
  );
  commandlet.run();
}
