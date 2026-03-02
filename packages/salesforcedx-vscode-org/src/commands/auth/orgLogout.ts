/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  ContinueResponse,
  EmptyParametersGatherer,
  ParametersGatherer,
  LibraryCommandletExecutor,
  SfCommandlet,
  SfCommandletExecutor,
  SfWorkspaceChecker,
  notificationService,
  CliCommandExecutor,
  TimingUtils,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../../channels';
import { AllServicesLayer } from '../../extensionProvider';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';
import { updateConfigAndStateAggregators } from '../../util/orgUtil';
import { ScratchOrgLogoutParamsGatherer } from './authParamsGatherer';
// SimpleGatherer - need to inline this small utility
class SimpleGatherer<T> implements ParametersGatherer<T> {
  private data: T;
  constructor(data: T) {
    this.data = data;
  }
  public gather(): Promise<ContinueResponse<T>> {
    return Promise.resolve({ type: 'CONTINUE', data: this.data });
  }
}

export class OrgLogoutAll extends SfCommandletExecutor<{}> {
  public static withoutShowingChannel(): OrgLogoutAll {
    const instance = new OrgLogoutAll();
    instance.showChannelOutput = false;
    return instance;
  }

  public build(_data: {}): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_logout_all_text'))
      .withArg('org:logout')
      .withArg('--all')
      .withArg('--no-prompt')
      .withLogName('org_logout')
      .build();
  }

  public execute(response: ContinueResponse<{}>): void {
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

export const orgLogoutAll = async () => {
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), new EmptyParametersGatherer(), new OrgLogoutAll());
  await commandlet.run();
};

class OrgLogoutDefault extends LibraryCommandletExecutor<string> {
  constructor() {
    super(nls.localize('org_logout_default_text'), 'org_logout_default', OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    try {
      await (await AuthRemover.create()).removeAuth(response.data);
    } catch (e) {
      telemetryService.sendException('org_logout_default', `Error: name = ${e.name} message = ${e.message}`);
      return false;
    }
    return true;
  }
}

export const orgLogoutDefault = async () => {
  const { username, isScratch, alias } = await resolveTargetOrg().pipe(
    Effect.provide(AllServicesLayer),
    Effect.runPromise
  );
  if (username) {
    // confirm logout for scratch orgs due to special considerations:
    // https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_logout.htm
    const logoutCommandlet = new SfCommandlet(
      new SfWorkspaceChecker(),
      isScratch ? new ScratchOrgLogoutParamsGatherer(username, alias) : new SimpleGatherer<string>(username),
      new OrgLogoutDefault()
    );
    await logoutCommandlet.run();
  } else {
    void notificationService.showInformationMessage(nls.localize('org_logout_no_default_org'));
  }
};

const resolveTargetOrg = Effect.fn('OrgLogout.resolveTargetOrg')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());

  return {
    username: orgInfo.username,
    isScratch: orgInfo.isScratch ?? false,
    alias: orgInfo.aliases?.[0]
  };
});
