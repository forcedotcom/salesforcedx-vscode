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
  CompositeParametersGatherer,
  FlagParameter,
  PromptConfirmGatherer,
  SelectUsername,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export class ForceOrgDeleteExecutor extends SfdxCommandletExecutor<{}> {
  private flag: string | undefined;

  public constructor(flag?: string) {
    super();
    this.flag = flag;
  }

  public build(data: { choice?: string; username?: string }): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_org_delete_default_text'))
      .withArg('force:org:delete')
      .withArg('--noprompt')
      .withLogName('force_org_delete_default');

    if (this.flag === '--targetusername' && data.username) {
      builder
        .withDescription(nls.localize('force_org_delete_username_text'))
        .withFlag(this.flag, data.username);
    }
    return builder.build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceOrgDelete(this: FlagParameter<string>) {
  // tslint:disable-next-line:no-invalid-this
  const flag = this ? this.flag : undefined;

  const parameterGatherer = flag
    ? new CompositeParametersGatherer(
        new SelectUsername(),
        new PromptConfirmGatherer()
      )
    : new PromptConfirmGatherer();

  const executor = new ForceOrgDeleteExecutor(flag);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
