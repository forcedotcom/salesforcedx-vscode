/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { buildOrgQuickPickItems, isOrgItem } from '../../orgPicker/orgList';
import { getFreshAuthorizations, updateConfigAndStateAggregatorsEffect } from '../../util/orgUtil';

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
 * Logs out a single org via an `AuthRemover`. `AuthRemover.removeAuth` already calls
 * `unsetConfigValues` + `unsetAliases` (node_modules/@salesforce/core/lib/org/authRemover.js L50-54),
 * which unsets every global+local config key matching the username/aliases — covering target-org AND
 * target-dev-hub. No separate alias/config-unset calls are needed here. See `createAuthRemover` for
 * how the remover itself is built (shared per command, explicit `projectPath`, `skipCache`).
 */
const removeAuth = Effect.fn('orgLogoutAllCommand.removeAuth')(function* (authRemover: AuthRemover, username: string) {
  yield* Effect.annotateCurrentSpan('username', username);
  yield* Effect.tryPromise({
    try: () => authRemover.removeAuth(username),
    catch: cause => new OrgLogoutError({ username, message: `Failed to log out of ${username}`, cause: String(cause) })
  });
});

/**
 * Builds one `AuthRemover` per command (not per org): each `.create()` reloads ConfigAggregator + reads
 * all org files from disk (authRemover.js L92-97), so per-org creation repeats that I/O. `projectPath`
 * resolves local config from the workspace rather than `process.cwd()` (the extension host must not be
 * relied on to set it); `skipCache` forces a disk re-read so removeAuth unsets the current target-org
 * rather than a stale cached value. `seedUsername` labels the failure if `.create()` rejects.
 */
const createAuthRemover = Effect.fn('orgLogout.createAuthRemover')(function* (
  projectPath: string,
  seedUsername: string
) {
  return yield* Effect.tryPromise({
    try: () => AuthRemover.create({ projectPath, skipCache: true }),
    catch: cause =>
      new OrgLogoutError({ username: seedUsername, message: 'Failed to initialize AuthRemover', cause: String(cause) })
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
    const authRemover = yield* createAuthRemover(projectPath, usernames[0]);
    // Sequential (no concurrency): AuthRemover writes to shared on-disk config/alias/state files;
    // the library itself serializes removals to avoid a ConfigFile collision bug (authRemover.js L64-65).
    yield* Effect.forEach(usernames, username => removeAuth(authRemover, username), { discard: true });
    yield* updateConfigAndStateAggregatorsEffect();
  },
  // Cancellation is intentional; swallow it. All other errors surface to ErrorHandlerService.
  Effect.catchTag('UserCancellationError', () => Effect.void)
);

/**
 * Effect command for `sf.org.logout.default`: log out the current default org.
 * No default org is an intentional no-op (info message). Scratch orgs require a confirm modal
 * (declining is a no-op cancellation). Every other failure propagates to ErrorHandlerService.
 */
export const orgLogoutDefaultCommand = Effect.fn('orgLogoutDefaultCommand')(
  function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    // precondition: typed FailedToResolveSfProjectError (rendered by ErrorHandlerService) when no project
    yield* api.services.ProjectService.getSfProject();

    const { username, isScratch, aliases } = yield* resolveTargetOrg();
    if (!username) {
      return yield* Effect.sync(
        () => void vscode.window.showInformationMessage(nls.localize('org_logout_no_default_org'))
      );
    }

    if (isScratch) {
      // confirm logout for scratch orgs due to special considerations:
      // https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_logout.htm
      const promptService = yield* api.services.PromptService;
      yield* promptService.confirmOrThrow({
        message: nls.localize('org_logout_scratch_prompt', aliases[0] ?? username),
        confirmLabel: nls.localize('org_logout_scratch_logout')
      });
    }

    // check BEFORE removeAuth: after it unsets config the target-org is already gone
    const wasTargetOrg = yield* api.services.ConfigService.isCurrentTargetOrg(username, aliases);

    const { fsPath: projectPath } = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
    const authRemover = yield* createAuthRemover(projectPath, username);
    yield* removeAuth(authRemover, username);
    yield* updateConfigAndStateAggregatorsEffect();

    // removeAuth writes config.json but updateConfigAndStateAggregatorsEffect swallows the post-logout
    // getConnection failure and never clears the in-process defaultOrgRef; clear it here deterministically
    // (W-23069610). Only when the logged-out org was the target — logging out another org must not clear it.
    // unsetTargetOrg unsets local target-org + clears defaultOrgRef synchronously (configService.ts).
    if (wasTargetOrg) {
      yield* api.services.ConfigService.unsetTargetOrg();
    }
  },
  // Declined scratch confirm is intentional; swallow it. All other errors surface to ErrorHandlerService.
  Effect.catchTag('UserCancellationError', () => Effect.void)
);

const resolveTargetOrg = Effect.fn('OrgLogout.resolveTargetOrg')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());

  return {
    username: orgInfo.username,
    isScratch: orgInfo.isScratch ?? false,
    aliases: orgInfo.aliases ?? []
  };
});
