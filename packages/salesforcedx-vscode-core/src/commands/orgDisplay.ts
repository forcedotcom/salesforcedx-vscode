/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils-vscode';
import { nls } from '../messages';
import {
  EmptyParametersGatherer,
  FlagParameter,
  SelectUsername,
  SfCommandlet,
  SfCommandletExecutor,
  SfWorkspaceChecker
} from './util';

export class OrgDisplay extends SfCommandletExecutor<{}> {
  private flag: string | undefined;

  public constructor(flag?: string) {
    super();
    this.flag = flag;
  }

  public build(data: { username?: string }): Command {
    const builder = new SfCommandBuilder()
      .withDescription(nls.localize('org_display_default_text'))
      .withArg('org:display')
      .withLogName('org_display_default');
    if (this.flag === '--target-org' && data.username) {
      builder.withDescription(nls.localize('org_display_username_text')).withFlag(this.flag, data.username);
    }
    return builder.build();
  }
}

const workspaceChecker = new SfWorkspaceChecker();

export async function orgDisplay(this: FlagParameter<string>) {
  // tslint:disable-next-line:no-invalid-this
  const flag = this ? this.flag : undefined;
  const parameterGatherer = flag ? new SelectUsername() : new EmptyParametersGatherer();
  const executor = new OrgDisplay(flag);
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);
  await commandlet.run();
}
