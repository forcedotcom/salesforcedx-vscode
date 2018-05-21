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
  EmptyParametersGatherer,
  FlagParameter,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export enum SourceStatusFlags {
  Local = '--local',
  Remote = '--remote'
}

export class ForceSourceStatusExecutor extends SfdxCommandletExecutor<{}> {
  private flag: SourceStatusFlags | undefined;

  public constructor(flag?: SourceStatusFlags) {
    super();
    this.flag = flag;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_status_text'))
      .withArg('force:source:status');
    if (this.flag === SourceStatusFlags.Local) {
      builder.withArg(this.flag);
      builder.withDescription(nls.localize('force_source_status_local_text'));
    } else if (this.flag === SourceStatusFlags.Remote) {
      builder.withArg(this.flag);
      builder.withDescription(nls.localize('force_source_status_remote_text'));
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
  const flag = this ? this.flag : undefined;
  const executor = new ForceSourceStatusExecutor(flag);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
