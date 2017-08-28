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
  GetUserInput,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker,
  UserInput
} from './commands';

class ForceDataSoqlQueryExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: UserInput): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_data_soql_query_text'))
      .withArg('force:data:soql:query')
      .withFlag('--query', `${data.input}`)
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new GetUserInput();

export async function forceDataSoqlQuery(explorerDir?: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceDataSoqlQueryExecutor()
  );
  commandlet.run();
}
