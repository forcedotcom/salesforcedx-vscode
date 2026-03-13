/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import { ExtensionProviderService, sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  FlagParameter,
  LibraryCommandletExecutor,
  SfCommandlet,
  SfCommandletExecutor,
  CliCommandExecutor,
  ContinueResponse,
  TimingUtils,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { AllServicesLayer } from '../extensionProvider';
import { nls } from '../messages';
import { PromptConfirmGatherer } from '../parameterGatherers/promptConfirmGatherer';
import { OrgToDelete, SelectDeletableOrg } from '../parameterGatherers/selectDeletableOrg';
import { telemetryService } from '../telemetry';
import { updateConfigAndStateAggregators } from '../util/orgUtil';

const getAliasesForUsername = Effect.fn('OrgDelete.getAliasesForUsername')(function* (username: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.AliasService.getAliasesFromUsername(username);
});

const removeOrgAliases = Effect.fn('OrgDelete.removeOrgAliases')(function* (username: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const aliases = yield* api.services.AliasService.getAliasesFromUsername(username);
  yield* api.services.AliasService.unsetAliases(aliases);
});

const unsetTargetOrgIfMatch = Effect.fn('OrgDelete.unsetTargetOrgIfMatch')(
  function* (username: string, aliases: readonly string[]) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const isTarget = yield* api.services.ConfigService.isCurrentTargetOrg(username, aliases);
    if (isTarget) yield* api.services.ConfigService.unsetTargetOrg();
  }
);

const unsetTargetDevHubIfMatch = Effect.fn('OrgDelete.unsetTargetDevHubIfMatch')(
  function* (username: string, aliases: readonly string[]) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const isDevHub = yield* api.services.ConfigService.isCurrentTargetDevHub(username, aliases);
    if (isDevHub) yield* api.services.ConfigService.unsetTargetDevHub();
  }
);

/** Runs sf org:delete:scratch or org:delete:sandbox for a single org and resolves when done. */
const runDeleteCli = (username: string, orgType: 'scratch' | 'sandbox'): Promise<boolean> => {
  const deleteArg = orgType === 'sandbox' ? 'org:delete:sandbox' : 'org:delete:scratch';
  const command = new SfCommandBuilder()
    .withDescription(nls.localize('org_delete_username_text'))
    .withArg(deleteArg)
    .withArg('--no-prompt')
    .withFlag('--target-org', username)
    .withLogName('org_delete_username')
    .build();

  return new Promise<boolean>(resolve => {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const execution = new CliCommandExecutor(command, {
      cwd: workspaceUtils.getRootWorkspacePath(),
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationTokenSource.token);

    execution.processExitSubject.subscribe(data => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const exitCode = Array.isArray(data) ? data[0] : data;
      resolve(exitCode === 0);
    });
  });
};

export class OrgDeleteExecutor extends LibraryCommandletExecutor<{ orgs: OrgToDelete[] }> {
  constructor() {
    super(nls.localize('org_delete_username_text'), 'org_delete_selected', OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<{ orgs: OrgToDelete[] }>): Promise<boolean> {
    const { orgs } = response.data;
    try {
      const authRemover = await AuthRemover.create();
      let allSucceeded = true;
      for (const { username, orgType } of orgs) {
        // Fetch aliases before cleanup so they can be used for config matching
        const aliases = await getAliasesForUsername(username).pipe(Effect.provide(AllServicesLayer), Effect.runPromise);
        const success = await runDeleteCli(username, orgType);
        if (success) {
          await authRemover.removeAuth(username);
          await removeOrgAliases(username).pipe(Effect.provide(AllServicesLayer), Effect.runPromise);
          await unsetTargetOrgIfMatch(username, aliases).pipe(Effect.provide(AllServicesLayer), Effect.runPromise);
          await unsetTargetDevHubIfMatch(username, aliases).pipe(Effect.provide(AllServicesLayer), Effect.runPromise);
        } else {
          allSucceeded = false;
        }
      }
      await updateConfigAndStateAggregators();
      return allSucceeded;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      telemetryService.sendException('org_delete_selected', `Error: name = ${err.name} message = ${err.message}`);
      return false;
    }
  }
}

/** Executor for deleting the default org (no picker). */
class OrgDeleteDefaultExecutor extends SfCommandletExecutor<{}> {
  public build(_data: {}): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_delete_default_text'))
      .withArg('org:delete:scratch')
      .withArg('--no-prompt')
      .withLogName('org_delete_default')
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
    execution.processExitSubject.subscribe(async data => {
      this.logMetric(execution.command.logName, startTime);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const exitCode = Array.isArray(data) ? data[0] : data;
      if (exitCode === 0) {
        await updateConfigAndStateAggregators();
      }
    });
  }
}

export async function orgDelete(this: FlagParameter<string>) {
  const flag = this ? this.flag : undefined;

  if (flag === '--target-org') {
    const commandlet = new SfCommandlet(
      sfProjectPreconditionChecker,
      new SelectDeletableOrg(),
      new OrgDeleteExecutor()
    );
    await commandlet.run();
  } else {
    const commandlet = new SfCommandlet(
      sfProjectPreconditionChecker,
      new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_delete_default_org')),
      new OrgDeleteDefaultExecutor()
    );
    await commandlet.run();
  }
}
