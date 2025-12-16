/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  FlagParameter,
  CompositeParametersGatherer,
  SfCommandlet,
  SfCommandletExecutor,
  SfWorkspaceChecker,
  CliCommandExecutor,
  TimingUtils,
  workspaceUtils,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { updateConfigAndStateAggregators } from '../util';
import { PromptConfirmGatherer } from '../parameterGatherers/promptConfirmGatherer';
import { SelectUsername } from '../parameterGatherers/selectUsername';

class OrgDeleteExecutor extends SfCommandletExecutor<{}> {
  private flag: string | undefined;

  constructor(flag?: string) {
    super();
    this.flag = flag;
  }

  public build(data: { choice?: string; username?: string }): Command {
    const builder = new SfCommandBuilder()
      .withDescription(nls.localize('org_delete_default_text'))
      .withArg('org:delete:scratch')
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

  public execute(response: ContinueResponse<{ choice?: string; username?: string }>): void {
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
    execution.processExitSubject.subscribe(async exitCode => {
      this.logMetric(execution.command.logName, startTime);
      // Only update state aggregators on successful completion (exit code 0)
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
        new SelectUsername(),
        new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_delete_selected_org'))
      )
    : new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_delete_default_org'));

  const executor = new OrgDeleteExecutor(flag);
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), parameterGatherer, executor);
  await commandlet.run();
}
