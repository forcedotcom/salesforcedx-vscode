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
import { BaseDeployExecutor, DeployType } from './baseDeployCommand';
import {
  CommandParams,
  EmptyParametersGatherer,
  FlagParameter,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';

export const pushCommand: CommandParams = {
  command: 'force:source:push',
  description: {
    default: 'force_source_push_default_org_text',
    forceoverwrite: 'force_source_push_force_default_org_text'
  },
  logName: { default: 'force_source_push_default_scratch_org' }
};

export class ForceSourcePushExecutor extends BaseDeployExecutor {
  private flag: string | undefined;

  public constructor(
    flag?: string,
    public params: CommandParams = pushCommand
  ) {
    super();
    this.flag = flag;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize(this.params.description.default))
      .withArg(this.params.command)
      .withJson()
      .withLogName(this.params.logName.default);
    if (this.flag === '--forceoverwrite') {
      builder.withArg(this.flag);
      builder.withDescription(
        nls.localize(this.params.description.forceoverwrite)
      );
    }
    return builder.build();
  }

  protected getDeployType() {
    return DeployType.Push;
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceSourcePush(this: FlagParameter<string>) {
  const { flag } = this || {};
  const executor = new ForceSourcePushExecutor(flag, pushCommand);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
