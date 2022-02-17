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
import {SOURCE_TRACKING_VERSION} from '../constants';
import { nls } from '../messages';
import {
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

export class ForceSourceStatusExecutor extends SfdxCommandletExecutor<{}> {
  private flag: SourceStatusFlags | undefined;
  private sourceTrackingVersion: SOURCE_TRACKING_VERSION | undefined;

  public constructor(flag?: SourceStatusFlags,
                     sourceTrackingVersion: SOURCE_TRACKING_VERSION = SOURCE_TRACKING_VERSION.BETA) {
    super();
    this.flag = flag;
    this.sourceTrackingVersion = sourceTrackingVersion;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_status_text'))
      .withArg('force:source:status')
      .withLogName('force_source_status');
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
  sourceStatusFlag: FlagParameter<SourceStatusFlags>,
  sourceTrackingVersion: SOURCE_TRACKING_VERSION) {
  // tslint:disable-next-line:no-invalid-this
  const flag = sourceStatusFlag ? sourceStatusFlag.flag : undefined;
  const executor = new ForceSourceStatusExecutor(flag, sourceTrackingVersion);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
