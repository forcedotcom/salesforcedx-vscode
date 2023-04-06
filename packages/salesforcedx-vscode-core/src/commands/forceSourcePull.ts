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
  CommandParams,
  EmptyParametersGatherer,
  FlagParameter,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export const pullCommand: CommandParams = {
  command: 'force:source:pull',
  description: {
    default: 'force_source_pull_default_org_text',
    forceoverwrite: 'force_source_pull_force_default_org_text'
  },
  logName: { default: 'force_source_pull_default_scratch_org' }
};

export class ForceSourcePullExecutor extends SfdxCommandletExecutor<{}> {
  private flag: string | undefined;

  public constructor(
    flag?: string,
    public params: CommandParams = pullCommand
  ) {
    super();
    this.flag = flag;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize(this.params.description.default))
      .withArg(this.params.command)
      .withLogName(this.params.logName.default);

    if (this.flag === '--forceoverwrite') {
      builder
        .withArg(this.flag)
        .withDescription(nls.localize(this.params.description.forceoverwrite));
    }
    return builder.build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceSourcePull(this: FlagParameter<string>) {
  const { flag } = this || {};
  const executor = new ForceSourcePullExecutor(flag, pullCommand);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
