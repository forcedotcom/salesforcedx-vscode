/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder,
  SourceTrackingService,
  StatusOutputRowType
} from '@salesforce/salesforcedx-utils-vscode';
import { PersistentStorageService } from '../conflict';
import { FORCE_SOURCE_PULL_LOG_NAME } from '../constants';
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
  logName: { default: FORCE_SOURCE_PULL_LOG_NAME }
};

export class ForceSourcePullExecutor extends SfdxCommandletExecutor<{}> {
  private flag: string | undefined;
  private remoteChanges?: StatusOutputRowType[];

  public async cacheRemoteChanges() {
    const remoteStatus = await SourceTrackingService.getRemoteStatus();
    this.remoteChanges = remoteStatus;
  }

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
      .withJson()
      .withLogName(this.params.logName.default);

    if (this.flag === '--forceoverwrite') {
      builder
        .withArg(this.flag)
        .withDescription(nls.localize(this.params.description.forceoverwrite));
    }
    return builder.build();
  }

  protected getRemoteChanges(): StatusOutputRowType[] | undefined {
    return this.remoteChanges;
  }

  // protected updateCache(): void {
  //   const remoteChanges = this.getRemoteChanges();
  //   if (remoteChanges) {
  //     PersistentStorageService.updateCacheAfterPushPull(remoteChanges);
  //   }
  // }

  /**
   * @description Pass the pulled source to PersistentStorageService for
   * updating of timestamps, so that conflict detection will behave as expected
   * @param pullResult that comes from stdOut after cli push operation
   */
  protected updateCache(pullResult: any): void {
    const pulledSource = pullResult.result.pulledSource;

    const instance = PersistentStorageService.getInstance();
    instance.setPropertiesForFilesPushPull(pulledSource);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceSourcePull(this: FlagParameter<string>) {
  const { flag } = this || {};
  const executor = new ForceSourcePullExecutor(flag, pullCommand);
  await executor.cacheRemoteChanges();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
