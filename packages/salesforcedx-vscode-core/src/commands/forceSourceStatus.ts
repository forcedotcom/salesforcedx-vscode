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
import { CommandVersion } from './util/sfdxCommandlet';
import {
  EmptyParametersGatherer,
  FlagParameter,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export enum SourceStatusFlags {
  Local = '--local',
  Remote = '--remote',
}

export class ForceSourceStatusExecutor extends SfdxCommandletExecutor<{}> {
  public command: string;
  private flag: SourceStatusFlags | undefined;
  private description: string;
  private logName: string;

  public constructor(flag?: SourceStatusFlags, cmdVersion?: CommandVersion) {
    super();
    this.flag = flag;
    this.command = `force:source:${cmdVersion? cmdVersion : CommandVersion.Default}:status`;
    this.description = ['force_source_status', cmdVersion, 'text'].filter(Boolean).join('_');
    this.logName = ['force_source_status', cmdVersion].filter(Boolean).join('_');
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
  this: FlagParameter<SourceStatusFlags>
) {
  // tslint:disable-next-line:no-invalid-this
  const flag = this ? this.flag: undefined;
  const cmdVersion = this ? this.commandVersion : undefined;
  const executor = new ForceSourceStatusExecutor(flag, cmdVersion);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
