/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import { CompositeParametersGatherer, SfWorkspaceChecker } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../messages';
import { FlagParameter, PromptConfirmGatherer, SelectUsername, SfCommandlet, SfCommandletExecutor } from './util';

class OrgDeleteExecutor extends SfCommandletExecutor<{}> {
  private flag: string | undefined;

  constructor(flag?: string) {
    super();
    this.flag = flag;
  }

  public build(data: { choice?: string; username?: string }): Command {
    const builder = new SfCommandBuilder()
      .withDescription(nls.localize('org_delete_default_text'))
      .withArg('org:delete:scratch')
      .withArg('--no-prompt')
      .withLogName('org_delete_default');

    if (this.flag === '--target-org' && data.username) {
      builder
        .withDescription(nls.localize('org_delete_username_text'))
        .withLogName('org_delete_username')
        .withFlag(this.flag, data.username);
    }
    return builder.build();
  }
}

const workspaceChecker = new SfWorkspaceChecker();

export async function orgDelete(this: FlagParameter<string>) {
  const flag = this ? this.flag : undefined;

  const parameterGatherer = flag
    ? new CompositeParametersGatherer(
        new SelectUsername(),
        new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_delete_selected_org'))
      )
    : new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_delete_default_org'));

  const executor = new OrgDeleteExecutor(flag);
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);
  await commandlet.run();
}
