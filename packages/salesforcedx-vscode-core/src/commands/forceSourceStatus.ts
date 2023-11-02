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

export enum SourceStatusFlags {
  Local = '--local',
  Remote = '--remote'
}

export const statusCommand: CommandParams = {
  command: 'force:source:status',
  description: {
    default: 'force_source_status_text',
    local: 'force_source_status_local_text',
    remote: 'force_source_status_remote_text'
  },
  logName: {
    default: 'force_source_status',
    local: 'force_source_status_local',
    remote: 'force_source_status_remote'
  }
};
export class ForceSourceStatusExecutor extends SfdxCommandletExecutor<{}> {
  private flag: SourceStatusFlags | undefined;

  public constructor(
    flag?: SourceStatusFlags,
    public params: CommandParams = statusCommand
  ) {
    super();
    this.flag = flag;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize(this.params.description.default))
      .withArg(this.params.command)
      .withLogName(this.params.logName.default);
    if (this.flag === SourceStatusFlags.Local) {
      builder.withArg(this.flag);
      builder.withDescription(nls.localize(this.params.description.local));
      builder.withLogName(this.params.logName.local);
    } else if (this.flag === SourceStatusFlags.Remote) {
      builder.withArg(this.flag);
      builder.withDescription(nls.localize(this.params.description.remote));
      builder.withLogName(this.params.logName.remote);
    }
    return builder.build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceSourceStatus(
  this: FlagParameter<SourceStatusFlags>
) {
  const { flag } = this || {};
  const executor = new ForceSourceStatusExecutor(flag, statusCommand);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
