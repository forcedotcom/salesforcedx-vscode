/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import { ExtensionProviderService, sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import {
  type ContinueResponse,
  LibraryCommandletExecutor,
  type ParametersGatherer,
  SfCommandlet,
  notificationService,
  workspaceUtils
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
 * Logs out a single org via a shared `AuthRemover`. `AuthRemover.removeAuth` already calls
 * `unsetConfigValues` + `unsetAliases` (node_modules/@salesforce/core/lib/org/authRemover.js L50-54),
 * which unsets every global+local config key matching the username/aliases — covering target-org AND
 * target-dev-hub. No separate alias/config-unset calls are needed here. The `AuthRemover` is created
 * once in `orgLogoutAllCommand` and reused (each `.create()` does a full disk read of all org files).
 * The remover is built with an explicit `projectPath` so the local config is resolved from the
 * workspace rather than `process.cwd()` (which the extension host must not be relied on to set).
 */
const removeAuth = Effect.fn('orgLogoutAllCommand.removeAuth')(function* (authRemover: AuthRemover, username: string) {
  yield* Effect.annotateCurrentSpan('username', username);
  yield* Effect.tryPromise({
    try: () => authRemover.removeAuth(username),
    catch: cause => new OrgLogoutError({ username, message: `Failed to log out of ${username}`, cause: String(cause) })
  });
});

/** Multi-select QuickPick + confirmation modal yielding the usernames to log out. */
const selectOrgsForLogout = Effect.fn('orgLogoutAllCommand.selectOrgs')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const { defaultConfig, freshAuthorizations } = yield* getFreshAuthorizations();

  const items = buildOrgQuickPickItems(freshAuthorizations, defaultConfig);

  const selections = yield* Effect.tryPromise({
    try: () =>
      Promise.resolve(
        vscode.window.showQuickPick(items, {
          placeHolder: nls.localize('org_logout_select_orgs_placeholder'),
          canPickMany: true,
          matchOnDescription: true,
          matchOnDetail: true
        })
      ),
    catch: cause =>
      new OrgLogoutError({ username: 'unknown', message: 'Org selection QuickPick failed', cause: String(cause) })
  }).pipe(Effect.flatMap(promptService.considerEmptySelectionAsCancellation));

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
    // resolve the workspace path so AuthRemover unsets local config dir-explicitly (no process.cwd reliance)
    const { fsPath: projectPath } = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
    // One shared AuthRemover for all orgs: each .create() reloads ConfigAggregator + reads all org
    // files from disk (authRemover.js L92-97), so creating per-org would repeat that I/O N times.
    const authRemover = yield* Effect.tryPromise({
      // skipCache: the extension holds a long-lived cached ConfigAggregator; force a disk re-read
      // so removeAuth unsets the current target-org rather than a stale cached value.
      try: () => AuthRemover.create({ projectPath, skipCache: true }),
      catch: cause =>
        new OrgLogoutError({
          username: usernames[0],
          message: 'Failed to initialize AuthRemover',
          cause: String(cause)
        })
    });
    // Sequential (no concurrency): AuthRemover writes to shared on-disk config/alias/state files;
    // the library itself serializes removals to avoid a ConfigFile collision bug (authRemover.js L64-65).
    yield* Effect.forEach(usernames, username => removeAuth(authRemover, username), { discard: true });
    yield* updateConfigAndStateAggregatorsEffect();
  },
  // Cancellation is intentional; swallow it. All other errors surface to ErrorHandlerService.
  Effect.catchTag('UserCancellationError', () => Effect.void)
);

export class OrgLogoutDefault extends LibraryCommandletExecutor<string> {
  private readonly orgAliases: readonly string[];

  constructor(aliases: readonly string[] = []) {
    super(nls.localize('org_logout_default_text'), 'org_logout_default', OUTPUT_CHANNEL);
    this.orgAliases = aliases;
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    try {
      // check BEFORE removeAuth: after it unsets config the target-org is already gone
      const wasTargetOrg = await getOrgRuntime().runPromise(checkIsCurrentTargetOrg(response.data, this.orgAliases));
      // projectPath resolves local config from the workspace, not process.cwd(); skipCache forces a
      // disk re-read so removeAuth (unsetConfigValues + unsetAliases, authRemover.js L50-54) unsets the
      // current target-org rather than a stale cached value
      const authRemover = await AuthRemover.create({
        projectPath: workspaceUtils.getRootWorkspacePath(),
        skipCache: true
      });
      await authRemover.removeAuth(response.data);
      // removeAuth writes config.json but never clears the in-process defaultOrgRef; the config-file
      // watcher backstop is unreliable within the command window, so clear it here (W-23069610). Only
      // when the logged-out org was the target — logging out another org must not clear the ref.
      if (wasTargetOrg) {
        await getOrgRuntime().runPromise(clearTargetOrgRef());
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

const checkIsCurrentTargetOrg = Effect.fn('OrgLogout.checkIsCurrentTargetOrg')(function* (
  username: string,
  aliases: readonly string[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.ConfigService.isCurrentTargetOrg(username, aliases);
});

// unsetTargetOrg unsets local target-org + clears defaultOrgRef synchronously (configService.ts)
const clearTargetOrgRef = Effect.fn('OrgLogout.clearTargetOrgRef')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ConfigService.unsetTargetOrg();
});

const resolveTargetOrg = Effect.fn('OrgLogout.resolveTargetOrg')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());

  return {
    username: orgInfo.username,
    isScratch: orgInfo.isScratch ?? false,
    aliases: orgInfo.aliases ?? []
  };
});
