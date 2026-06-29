/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { nls } from '../messages';
import { displayRemainingOrgs, removeExpiredAndDeletedOrgs, updateConfigAndStateAggregators } from '../util/orgUtil';

/** @ExportTaggedError */
export class OrgListCleanError extends Schema.TaggedError<OrgListCleanError>()('OrgListCleanError', {
  message: Schema.String
}) {}

/**
 * Effect command for `sf.org.list.clean` ("SFDX: Remove Deleted and Expired Orgs"): modal-confirm,
 * remove expired/deleted org auths, flush aggregator caches, then display the remaining-orgs table.
 */
export const orgListCleanCommand = Effect.fn('orgListCleanCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  yield* promptService.confirmOrThrow({
    message: nls.localize('parameter_gatherer_placeholder_org_list_clean'),
    confirmLabel: nls.localize('org_list_clean_text')
  });

  const removedOrgs = yield* Effect.tryPromise({
    try: () => removeExpiredAndDeletedOrgs(),
    catch: error =>
      new OrgListCleanError({
        message: nls.localize('org_list_clean_general_error', error instanceof Error ? error.message : String(error))
      })
  });

  const channel = yield* api.services.ChannelService;
  yield* channel.appendToChannel(
    removedOrgs.length > 0
      ? nls.localize('org_list_clean_success_message', removedOrgs.length)
      : nls.localize('org_list_clean_no_orgs_message')
  );

  // Flush ConfigAggregator + StateAggregator so the org picker doesn't show just-removed orgs,
  // and so the table below reflects post-flush state.
  yield* Effect.promise(() => updateConfigAndStateAggregators());

  yield* Effect.promise(() => displayRemainingOrgs());
});
