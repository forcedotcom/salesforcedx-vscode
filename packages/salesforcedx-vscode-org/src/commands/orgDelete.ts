/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover, Global } from '@salesforce/core';
import { ExtensionProviderService, sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  FlagParameter,
  LibraryCommandletExecutor,
  SfCommandlet,
  CliCommandExecutor,
  ContinueResponse,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { getOrgRuntime } from '../extensionProvider';
import { nls } from '../messages';
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

const unsetTargetOrgIfMatch = Effect.fn('OrgDelete.unsetTargetOrgIfMatch')(function* (
  username: string,
  aliases: readonly string[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const isTarget = yield* api.services.ConfigService.isCurrentTargetOrg(username, aliases);
  if (isTarget) yield* api.services.ConfigService.unsetTargetOrg();
});

const unsetTargetDevHubIfMatch = Effect.fn('OrgDelete.unsetTargetDevHubIfMatch')(function* (
  username: string,
  aliases: readonly string[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const isDevHub = yield* api.services.ConfigService.isCurrentTargetDevHub(username, aliases);
  if (isDevHub) yield* api.services.ConfigService.unsetTargetDevHub();
});

/** Checks if the auth file exists in .sfdx or .sf; sf org delete may already remove it (idempotent). */
const authFileExists = Effect.fn('OrgDelete.authFileExists')(function* (username: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const authFileName = `${username}.json`;
  const inSfdx = yield* api.services.FsService.fileOrFolderExists(path.join(Global.SFDX_DIR, authFileName));
  if (inSfdx) return true;
  return yield* api.services.FsService.fileOrFolderExists(path.join(Global.SF_DIR, authFileName));
});

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

    channelService.streamCommandOutput(execution);

    execution.processExitSubject.subscribe(data => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const exitCode = Array.isArray(data) ? data[0] : data;
      resolve(exitCode === 0);
    });
  });
};

class OrgDeleteExecutor extends LibraryCommandletExecutor<{ orgs: OrgToDelete[] }> {
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
        const aliases = await getOrgRuntime().runPromise(getAliasesForUsername(username));
        const success = await runDeleteCli(username, orgType);
        if (success) {
          // sf org delete scratch may already remove the auth file; only call removeAuth if file exists (idempotent)
          const authFileExistsResult = await getOrgRuntime().runPromise(authFileExists(username));
          if (authFileExistsResult) {
            await authRemover.removeAuth(username);
          }
          await getOrgRuntime().runPromise(removeOrgAliases(username));
          await getOrgRuntime().runPromise(unsetTargetOrgIfMatch(username, aliases));
          await getOrgRuntime().runPromise(unsetTargetDevHubIfMatch(username, aliases));
        } else {
          allSucceeded = false;
          channelService.appendLine(
            nls.localize('org_delete_failed_for_org', username, orgType === 'scratch' ? 'scratch org' : 'sandbox')
          );
        }
      }
      await updateConfigAndStateAggregators();
      return allSucceeded;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      telemetryService.sendException('org_delete_selected', `Error: name = ${err.name} message = ${err.message}`);
      channelService.appendLine(err.message);
      channelService.showChannelOutput();
      return false;
    }
  }
}

/** sf org delete can take longer than the default 30s simpleExec timeout. */
const DELETE_TIMEOUT = Duration.seconds(120);

class OrgNotDeletableError extends Schema.TaggedError<OrgNotDeletableError>()('OrgNotDeletableError', {
  message: Schema.String
}) {}

/**
 * Effect command for `sf.org.delete.default`: confirm, then delete the default org.
 * Picks `org:delete:sandbox` for sandbox defaults and `org:delete:scratch` otherwise
 * (the prior executor hardcoded scratch, which failed for sandbox defaults).
 */
export const orgDeleteDefaultCommand = Effect.fn('orgDeleteDefaultCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  yield* promptService.confirmOrThrow({
    message: nls.localize('parameter_gatherer_placeholder_delete_default_org'),
    confirmLabel: nls.localize('org_delete_default_text')
  });

  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  // Defensive guard: the UI when-clause (sf:default_org_deletable) hides this command for
  // non-scratch/non-sandbox orgs, but it remains callable via executeCommand. Without this
  // check a production default org would fall through to `org delete scratch`.
  if (orgInfo.isScratch !== true && orgInfo.isSandbox !== true) {
    return yield* new OrgNotDeletableError({ message: nls.localize('org_delete_default_not_deletable') });
  }
  const deleteSubcommand = orgInfo.isSandbox === true ? 'org delete sandbox' : 'org delete scratch';

  // pass --target-org so the delete resolves the default org by username rather than depending on
  // the extension-host cwd (simpleExec runs without a workspace cwd, unlike the picker-based runDeleteCli)
  const targetOrgFlag = orgInfo.username ? ` --target-org ${orgInfo.username}` : '';
  const terminalService = yield* api.services.TerminalService;
  const output = yield* terminalService.simpleExec({
    command: `sf ${deleteSubcommand}${targetOrgFlag} --no-prompt`,
    parse: identity,
    timeout: DELETE_TIMEOUT
  });

  const channel = yield* api.services.ChannelService;
  yield* channel.appendToChannel(output);
  yield* Effect.sync(() => {
    channelService.showChannelOutput();
  });

  yield* Effect.promise(() => updateConfigAndStateAggregators());
});

/** Picker-based delete (sf.org.delete.username). Default-org delete is handled by orgDeleteDefaultCommand. */
export async function orgDelete(this: FlagParameter<string>) {
  const commandlet = new SfCommandlet(sfProjectPreconditionChecker, new SelectDeletableOrg(), new OrgDeleteExecutor());
  await commandlet.run();
}
