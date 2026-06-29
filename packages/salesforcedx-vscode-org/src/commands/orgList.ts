/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { nls } from '../messages';
import {
  displayRemainingOrgs,
  findRemovableOrgs,
  removeExpiredAndDeletedOrgs,
  updateConfigAndStateAggregators
} from '../util/orgUtil';

/** @ExportTaggedError */
export class OrgListCleanError extends Schema.TaggedError<OrgListCleanError>()('OrgListCleanError', {
  message: Schema.String
}) {}

/**
 * Effect command for `sf.org.list.clean` ("SFDX: Remove Deleted and Expired Orgs"): scan for
 * expired/deleted org auths; if none, toast and stop (no pointless confirm). Otherwise modal-confirm,
 * remove the auths, toast which orgs were removed, flush aggregator caches, then display the remaining-orgs table.
 */
export const orgListCleanCommand = Effect.fn('orgListCleanCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;

  const removable = yield* Effect.tryPromise({
    try: () => findRemovableOrgs(),
    catch: error =>
      new OrgListCleanError({
        message: nls.localize('org_list_clean_general_error', error instanceof Error ? error.message : String(error))
      })
  });

  // Nothing to remove: tell the user instead of asking them to confirm a no-op.
  if (removable.length === 0) {
    yield* channel.appendToChannel(nls.localize('org_list_clean_no_orgs_message'));
    yield* Effect.sync(
      () => void notificationService.showInformationMessage(nls.localize('org_list_clean_no_orgs_message'))
    );
    return;
  }

  const promptService = yield* api.services.PromptService;
  yield* promptService.confirmOrThrow({
    message: nls.localize('parameter_gatherer_placeholder_org_list_clean'),
    confirmLabel: nls.localize('org_list_clean_confirm_label')
  });

  const removedOrgs = yield* Effect.tryPromise({
    try: () => removeExpiredAndDeletedOrgs(removable),
    catch: error =>
      new OrgListCleanError({
        message: nls.localize('org_list_clean_general_error', error instanceof Error ? error.message : String(error))
      })
  });

  const successMessage = nls.localize('org_list_clean_success_message', removedOrgs.length, removedOrgs.join(', '));
  yield* channel.appendToChannel(successMessage);
  yield* Effect.sync(() => void notificationService.showInformationMessage(successMessage));

  // Flush ConfigAggregator + StateAggregator so the org picker doesn't show just-removed orgs,
  // and so the table below reflects post-flush state.
  yield* Effect.promise(() => updateConfigAndStateAggregators());

  yield* Effect.promise(() => displayRemainingOrgs());
});
