/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../messages';
import { PromptConfirmGatherer, SfCommandlet, SfCommandletExecutor, SfWorkspaceChecker } from './util';

export class OrgListExecutor extends SfCommandletExecutor<{}> {
  public build(data: { choice?: string }): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_list_clean_text'))
      .withArg('org:list')
      .withArg('--clean')
      .withArg('--no-prompt')
      .withLogName('org_list_clean')
      .build();
  }
}

const workspaceChecker = new SfWorkspaceChecker();

export const orgList = (): void => {
  const parameterGatherer = new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_org_list_clean'));
  const executor = new OrgListExecutor();
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);
  void commandlet.run();
};
