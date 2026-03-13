/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  FlagParameter,
  CompositeParametersGatherer,
  SfCommandlet,
  SfCommandletExecutor,
  CliCommandExecutor,
  TimingUtils,
  workspaceUtils,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { PromptConfirmGatherer } from '../parameterGatherers/promptConfirmGatherer';
import { SelectDeletableOrg } from '../parameterGatherers/selectDeletableOrg';
import { updateConfigAndStateAggregators } from '../util/orgUtil';

class OrgDeleteExecutor extends SfCommandletExecutor<{}> {
  private flag: string | undefined;

  constructor(flag?: string) {
    super();
    this.flag = flag;
  }

  public build(data: { choice?: string; username?: string; orgType?: 'scratch' | 'sandbox' }): Command {
    const deleteArg = data.orgType === 'sandbox' ? 'org:delete:sandbox' : 'org:delete:scratch';
    const builder = new SfCommandBuilder()
      .withDescription(nls.localize('org_delete_default_text'))
      .withArg(deleteArg)
      .withArg('--no-prompt')
      .withLogName('org_delete_default');

    if (this.flag === '--target-org' && data.username) {
      builder
        .withDescription(nls.localize('org_delete_username_text'))
        .withLogName('org_delete_username')
        .withFlag(this.flag, data.username);
    }
    return builder.build();
  }

  public execute(response: ContinueResponse<{ choice?: string; username?: string; orgType?: 'scratch' | 'sandbox' }>): void {
    const startTime = TimingUtils.getCurrentTime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath(),
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);

    // old rxjs doesn't like async functions in subscribe, but we use them and they seem to work.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    execution.processExitSubject.subscribe(async data => {
      this.logMetric(execution.command.logName, startTime);
      // Node child_process 'exit' emits (code, signal); RxJS fromEvent passes multiple args as an array
      const exitCode = Array.isArray(data) ? data[0] : data;
      if (exitCode === 0) {
        await updateConfigAndStateAggregators();
      }
    });
  }
}

export async function orgDelete(this: FlagParameter<string>) {
  const flag = this ? this.flag : undefined;

  const parameterGatherer = flag
    ? new CompositeParametersGatherer(
        new SelectDeletableOrg(),
        new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_delete_selected_org'))
      )
    : new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_delete_default_org'));

  const executor = new OrgDeleteExecutor(flag);
  const commandlet = new SfCommandlet(sfProjectPreconditionChecker, parameterGatherer, executor);
  await commandlet.run();
}
