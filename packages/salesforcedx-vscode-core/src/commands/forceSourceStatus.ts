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
  EmptyParametersGatherer,
  FlagParameter,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';
import { CommandVersion } from './util/sfdxCommandlet';

export enum SourceStatusFlags {
  Local = '--local',
  Remote = '--remote'
}

const statusCommand: CommandParams = {
  command: 'force:source:status',
  description: 'force_source_status_text',
  forceFlagDescription: '', // No 'force' option for status
  logName: 'force_source_status'
};

const statusCommandLegacy: CommandParams = {
  command: 'force:source:legacy:status',
  description: 'force_source_legacy_status_text',
  forceFlagDescription: '', // No 'force' option for status
  logName: 'force_source_legacy_status'
};

export class ForceSourceStatusExecutor extends SfdxCommandletExecutor<{}> {
  public command: string;
  private description: string;
  private logName: string;
  private flag: SourceStatusFlags | undefined;

  public constructor(flag?: SourceStatusFlags, params: CommandParams = statusCommand) {
    super();
    this.flag = flag;
    this.command =  params.command;
    this.description = params.description;
    this.logName = params.logName;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize(this.description))
      .withArg(this.command)
      .withLogName(this.logName);
    if (this.flag === SourceStatusFlags.Local) {
      builder.withArg(this.flag);
      builder.withDescription(nls.localize('force_source_status_local_text'));
      builder.withLogName('force_source_status_local');
    } else if (this.flag === SourceStatusFlags.Remote) {
      builder.withArg(this.flag);
      builder.withDescription(nls.localize('force_source_status_remote_text'));
      builder.withLogName('force_source_status_remote');
    }
    return builder.build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceSourceStatus(
  params: FlagParameter<SourceStatusFlags>
) {
  const {flag, commandVersion} = params;
  const command = commandVersion && commandVersion === CommandVersion.Legacy ? statusCommandLegacy : statusCommand;
  const executor = new ForceSourceStatusExecutor(flag, command);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
