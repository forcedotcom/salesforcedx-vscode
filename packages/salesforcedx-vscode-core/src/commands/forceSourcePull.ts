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
  CommandParams,
  CommandVersion,
  EmptyParametersGatherer,
  FlagParameter,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

const pullCommand: CommandParams = {
  command: 'force:source:pull',
  description: {
    default: 'force_source_pull_default_scratch_org_text',
    forceoverwrite: 'force_source_pull_force_default_scratch_org_text',
  },
  logName: 'force_source_pull_default_scratch_org'
};

const pullCommandLegacy: CommandParams = {
  command: 'force:source:legacy:pull',
  description: {
    default: 'force_source_legacy_pull_default_scratch_org_text',
    forceoverwrite: 'force_source_legacy_pull_force_default_scratch_org_text',
  },
  logName: 'force_source_legacy_pull_default_scratch_org'
};

export class ForceSourcePullExecutor extends SfdxCommandletExecutor<{}> {
  private flag: string | undefined;

  public constructor(flag?: string, public params: CommandParams = pullCommand) {
    super();
    this.flag = flag;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(
        nls.localize(this.params.description.default)
      )
      .withArg(this.params.command)
      .withLogName(this.params.logName);

    if (this.flag === '--forceoverwrite') {
      builder
        .withArg(this.flag)
        .withDescription(
          nls.localize(this.params.description.forceoverwrite)
        );
    }
    return builder.build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceSourcePull(params: FlagParameter<string>) {
  const {flag, commandVersion} = params;
  const command = commandVersion && commandVersion === CommandVersion.Legacy ? pullCommandLegacy : pullCommand;
  const executor = new ForceSourcePullExecutor(flag);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
