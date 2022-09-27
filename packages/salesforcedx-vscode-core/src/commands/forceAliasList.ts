/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../messages';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export class ForceAliasList extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_alias_list_text'))
      .withArg('force:alias:list')
      .withLogName('force_alias_list')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const executor = new ForceAliasList();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export async function forceAliasList() {
  await commandlet.run();
}
