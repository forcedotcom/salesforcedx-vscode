/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { buildOrgQuickPickItems, isOrgItem } from '../../orgPicker/orgList';
import { getFreshAuthorizations, logoutOrg, updateConfigAndStateAggregatorsEffect } from '../../util/orgUtil';

/**
 * Raised when the CLI cannot log out an org.
 * @ExportTaggedError
 */
export class OrgLogoutError extends Schema.TaggedError<OrgLogoutError>()('OrgLogoutError', {
  username: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
}) {}

const removeAuth = Effect.fn('orgLogout.removeAuth')(function* (username: string) {
  yield* logoutOrg(username).pipe(
    Effect.mapError(
      error => new OrgLogoutError({ username, message: `Failed to log out of ${username}`, cause: error.message })
    )
  );
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
 * failure (project precondition, CLI logout, config refresh) propagates to ErrorHandlerService.
 */
export const orgLogoutAllCommand = Effect.fn('orgLogoutAllCommand')(
  function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    // precondition: fails with a typed FailedToResolveSfProjectError (rendered by ErrorHandlerService)
    // when there's no project.
    yield* api.services.ProjectService.getSfProject();

    const usernames = yield* selectOrgsForLogout();
    // Sequential: each CLI invocation writes shared auth, alias, and config files.
    yield* Effect.forEach(usernames, removeAuth, { discard: true });
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

    // Check before logout: the CLI may unset the target-org config.
    const wasTargetOrg = yield* api.services.ConfigService.isCurrentTargetOrg(username, aliases);

    yield* removeAuth(username);
    yield* updateConfigAndStateAggregatorsEffect();

    // The CLI unsets the project's target-org. The failed post-logout connection refresh
    // does not clear the in-process ref; reset it without writing config again from the extension-host cwd.
    // Only clear it when the logged-out org was the target.
    if (wasTargetOrg) {
      yield* api.services.ClearDefaultOrgRef();
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
