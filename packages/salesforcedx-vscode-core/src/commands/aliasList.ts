/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../messages';
import { EmptyParametersGatherer, SfCommandlet, SfCommandletExecutor, SfWorkspaceChecker } from './util';

export class AliasList extends SfCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('alias_list_text'))
      .withArg('alias:list')
      .withLogName('alias_list')
      .build();
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const executor = new AliasList();
const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);

export const aliasList = async (): Promise<void> => {
  await commandlet.run();
};
