/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import { ExtensionProviderService, sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import {
  ContinueResponse,
  LibraryCommandletExecutor,
  ParametersGatherer,
  SfCommandlet,
  notificationService
} from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../../channels';
import { getOrgRuntime } from '../../extensionProvider';
import { nls } from '../../messages';
import { buildOrgQuickPickItems, isOrgItem } from '../../orgPicker/orgList';
import { telemetryService } from '../../telemetry';
import { getFreshAuthorizations, updateConfigAndStateAggregatorsEffect } from '../../util/orgUtil';
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

/**
 * Raised when `AuthRemover.removeAuth` rejects for an org. Uses `Effect.tryPromise` so the core
 * rejection becomes a typed error ErrorHandlerService can render, not an unhandled defect.
 * @ExportTaggedError
 */
export class OrgLogoutError extends Schema.TaggedError<OrgLogoutError>()('OrgLogoutError', {
  username: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
}) {}

/**
 * Logs out a single org. `AuthRemover.removeAuth` already calls `unsetConfigValues` + `unsetAliases`
 * (node_modules/@salesforce/core/lib/org/authRemover.js L50-54), which unsets every global+local
 * config key matching the username/aliases — covering target-org AND target-dev-hub. No separate
 * alias/config-unset calls are needed here.
 */
const removeAuth = Effect.fn('orgLogoutAllCommand.removeAuth')(function* (username: string) {
  yield* Effect.annotateCurrentSpan('username', username);
  yield* Effect.tryPromise({
    try: () => AuthRemover.create().then(r => r.removeAuth(username)),
    catch: cause => new OrgLogoutError({ username, message: `Failed to log out of ${username}`, cause: String(cause) })
  });
});

/** Multi-select QuickPick + confirmation modal yielding the usernames to log out. */
const selectOrgsForLogout = Effect.fn('orgLogoutAllCommand.selectOrgs')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const { defaultConfig, freshAuthorizations } = yield* getFreshAuthorizations();

  const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig);

  const selections = yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('org_logout_select_orgs_placeholder'),
      canPickMany: true,
      matchOnDescription: true,
      matchOnDetail: true
    })
  ).pipe(Effect.flatMap(promptService.considerEmptySelectionAsCancellation));

  const targetAuthorizations = freshAuthorizations.filter(org =>
    selections.some(s => isOrgItem(s) && s.orgUsername === org.username)
  );

  if (targetAuthorizations.length === 0) {
    return yield* new api.services.UserCancellationError({});
  }

  const hasScratchOrSandbox = targetAuthorizations.some(org => org.isScratchOrg === true || org.isSandbox === true);
  const count = String(targetAuthorizations.length);
  const prompt = hasScratchOrSandbox
    ? nls.localize('org_logout_confirm_scratch_prompt', count)
    : nls.localize('org_logout_confirm_prompt', count);

  yield* promptService.confirmOrThrow({ message: prompt, confirmLabel: nls.localize('org_logout_scratch_logout') });

  return targetAuthorizations.map(org => org.username);
});

/**
 * Effect command for `sf.org.logout.all`: multi-pick orgs, confirm, then log each out.
 * Cancellation (empty selection / Esc / declined confirm) is an intentional no-op; every other
 * failure (project precondition, removeAuth, config refresh) propagates to ErrorHandlerService.
 */
export const orgLogoutAllCommand = Effect.fn('orgLogoutAllCommand')(
  function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    // precondition: fails with a typed FailedToResolveSfProjectError (rendered by ErrorHandlerService)
    // when there's no project.
    yield* api.services.ProjectService.getSfProject();

    const usernames = yield* selectOrgsForLogout();
    yield* Effect.forEach(usernames, removeAuth, { discard: true });
    yield* updateConfigAndStateAggregatorsEffect();
  },
  // Cancellation is intentional; swallow it. All other errors surface to ErrorHandlerService.
  Effect.catchTag('UserCancellationError', () => Effect.void)
);

const removeOrgAliases = Effect.fn('OrgLogout.removeOrgAliases')(function* (username: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const allAliasesOnDisk = yield* api.services.AliasService.getAliasesFromUsername(username);
  yield* api.services.AliasService.unsetAliases(allAliasesOnDisk);
});

const checkIsCurrentTargetOrg = Effect.fn('OrgLogout.checkIsCurrentTargetOrg')(function* (
  username: string,
  aliases: readonly string[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.ConfigService.isCurrentTargetOrg(username, aliases);
});

const doUnsetTargetOrg = Effect.fn('OrgLogout.doUnsetTargetOrg')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ConfigService.unsetTargetOrg();
});

export class OrgLogoutDefault extends LibraryCommandletExecutor<string> {
  private readonly orgAliases: readonly string[];

  constructor(aliases: readonly string[] = []) {
    super(nls.localize('org_logout_default_text'), 'org_logout_default', OUTPUT_CHANNEL);
    this.orgAliases = aliases;
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    try {
      const shouldUnset = await getOrgRuntime().runPromise(checkIsCurrentTargetOrg(response.data, this.orgAliases));
      const authRemover = await AuthRemover.create();
      await authRemover.removeAuth(response.data);
      // TODO(W-23069610 follow-up): removeAuth already runs unsetConfigValues + unsetAliases
      // (node_modules/@salesforce/core/lib/org/authRemover.js L50-54), so removeOrgAliases +
      // checkIsCurrentTargetOrg + doUnsetTargetOrg below are redundant. Remove this block when the
      // default path migrates to a services-based Effect command (mirror orgLogoutAllCommand).
      await getOrgRuntime().runPromise(removeOrgAliases(response.data));
      if (shouldUnset) {
        await getOrgRuntime().runPromise(doUnsetTargetOrg());
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      telemetryService.sendException('org_logout_default', `Error: name = ${err.name} message = ${err.message}`);
      return false;
    }
    return true;
  }
}

export const orgLogoutDefault = async () => {
  const { username, isScratch, aliases } = await getOrgRuntime().runPromise(resolveTargetOrg());
  if (username) {
    // confirm logout for scratch orgs due to special considerations:
    // https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_logout.htm
    const logoutCommandlet = new SfCommandlet(
      sfProjectPreconditionChecker,
      isScratch ? new ScratchOrgLogoutParamsGatherer(username, aliases[0]) : new SimpleGatherer<string>(username),
      new OrgLogoutDefault(aliases)
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
    aliases: orgInfo.aliases ?? []
  };
});
