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
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class ForceSObjectDescribeAccountExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription('force:schema:sobject:describe')
      .withArg('force:schema:sobject:describe')
      .withFlag('-s', 'Account')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const executor = new ForceSObjectDescribeAccountExecutor();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export function forceSObjectDescribeAccount() {
  commandlet.run();
}
